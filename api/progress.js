// api/progress.js — the sync endpoint for the Curiosity Catalog.
//
//   GET  /api/progress?code=<32 hex>  -> { done, touched, pins, streak, updatedAt }
//   POST /api/progress                -> upserts that record; body is the same shape + code
//
// Storage is Upstash Redis via the Vercel Marketplace (the successor to
// Vercel KV, which was folded into Upstash in December 2024). The record is
// stored as one JSON string per sync code under "cc:<code>".
//
// Access model: the sync code is a bearer secret. It is 128 bits of
// client-generated randomness, so it cannot be guessed or enumerated; an
// unknown code returns an empty record rather than an error, so the endpoint
// never confirms whether a code exists. There is deliberately no other auth:
// anyone who has the code can read and overwrite that one record, and nothing
// else. That is the whole security model — appropriate for a personal list of
// finished topics, not for anything sensitive.
//
// Conflict model: the server is plain last-write-wins on the whole record.
// The client is required to pull + merge (union) before pushing, which is
// what actually prevents one device from clobbering another. updatedAt is
// stored for display only — it never decides whose marks survive.

import { Redis } from '@upstash/redis';

const CODE_RE = /^[a-f0-9]{32}$/;
const TOPIC_RE = /^[A-Z]{2,6}\.\d{2,3}$/;
const DAY_MS = 86400000;
const MAX_BODY = 64 * 1024; // a full 217-topic record is ~15 KB; 64 KB is generous
const MAX_KEYS = 2048;
const MAX_PINS = 3;
const RATE_LIMIT = 100; // requests per IP per minute

let redis = null;
function client() {
  // The Upstash marketplace integration injects UPSTASH_REDIS_REST_*;
  // stores migrated from Vercel KV kept the KV_REST_API_* names. Accept both.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

export function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase().replace(/[-\s]/g, '');
  return CODE_RE.test(code) ? code : null;
}

// Reduce any client-supplied record to exactly the shape we store. Run on
// writes, and again on reads as defence in depth.
export function sanitizeRecord(input) {
  const src = input && typeof input === 'object' ? input : {};
  const now = Date.now();

  const done = {};
  if (src.done && typeof src.done === 'object') {
    for (const k of Object.keys(src.done).slice(0, MAX_KEYS)) {
      if (TOPIC_RE.test(k) && src.done[k]) done[k] = 1;
    }
  }

  const touched = {};
  if (src.touched && typeof src.touched === 'object') {
    for (const k of Object.keys(src.touched).slice(0, MAX_KEYS)) {
      const v = Number(src.touched[k]);
      if (TOPIC_RE.test(k) && Number.isFinite(v) && v > 0) {
        touched[k] = Math.min(Math.floor(v), now + DAY_MS);
      }
    }
  }

  let pins = {};
  if (src.pins && typeof src.pins === 'object') {
    for (const k of Object.keys(src.pins).slice(0, MAX_KEYS)) {
      const v = Number(src.pins[k]);
      if (TOPIC_RE.test(k) && Number.isFinite(v) && v > 0) {
        pins[k] = Math.min(Math.floor(v), now + DAY_MS);
      }
    }
    const newest = Object.keys(pins).sort((a, b) => pins[b] - pins[a]).slice(0, MAX_PINS);
    pins = Object.fromEntries(newest.map(k => [k, pins[k]]));
  }

  let streak = null;
  const s = src.streak;
  if (s && typeof s === 'object' && typeof s.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.lastDay)) {
    const current = Number.isInteger(s.current) && s.current >= 0 && s.current < 100000 ? s.current : 0;
    const best = Number.isInteger(s.best) && s.best >= 0 && s.best < 100000 ? s.best : 0;
    streak = { current, best: Math.max(best, current), lastDay: s.lastDay };
  }

  const at = Number(src.updatedAt);
  const updatedAt = Number.isFinite(at) && at > 0 ? Math.min(Math.floor(at), now + DAY_MS) : null;

  return { done, touched, pins, streak, updatedAt };
}

const EMPTY = { done: {}, touched: {}, pins: {}, streak: null, updatedAt: null };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

// Best-effort per-IP throttle using the same Redis. Fails open: losing rate
// limiting is better than losing sync.
async function allow(db, request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const key = `cc:rl:${ip}:${Math.floor(Date.now() / 60000)}`;
    const n = await db.incr(key);
    if (n === 1) await db.expire(key, 90);
    return n <= RATE_LIMIT;
  } catch {
    return true;
  }
}

export async function GET(request) {
  const db = client();
  if (!db) return json({ error: 'sync not configured' }, 503);

  const code = normalizeCode(new URL(request.url).searchParams.get('code'));
  if (!code) return json({ error: 'bad code' }, 400);
  if (!(await allow(db, request))) return json({ error: 'rate limited' }, 429);

  let raw;
  try {
    raw = await db.get('cc:' + code);
  } catch {
    return json({ error: 'store unavailable' }, 502);
  }
  if (raw == null) return json(EMPTY);

  let rec = raw;
  if (typeof raw === 'string') {
    try { rec = JSON.parse(raw); } catch { rec = null; }
  }
  return json(sanitizeRecord(rec));
}

export async function POST(request) {
  const db = client();
  if (!db) return json({ error: 'sync not configured' }, 503);
  if (!(await allow(db, request))) return json({ error: 'rate limited' }, 429);

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY) return json({ error: 'too large' }, 413);

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'too large' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const code = normalizeCode(body && body.code);
  if (!code) return json({ error: 'bad code' }, 400);

  const rec = sanitizeRecord(body);
  if (rec.updatedAt == null) rec.updatedAt = Date.now();

  try {
    await db.set('cc:' + code, JSON.stringify(rec));
  } catch {
    return json({ error: 'store unavailable' }, 502);
  }
  return json({ ok: true, updatedAt: rec.updatedAt });
}
