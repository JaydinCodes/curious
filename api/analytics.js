import { Redis } from '@upstash/redis';

import {
  analyticsKeys,
  sanitizeAnalyticsEvent,
} from '../src/analytics-model.js';
import { utcDateKey } from '../src/topic-of-day.js';

const MAX_BODY = 4 * 1024;
const DAILY_TTL_SECONDS = 400 * 24 * 60 * 60;

let redis = null;

function client() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

function response(status = 204, headers = {}) {
  return new Response(null, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export async function POST(request) {
  const declaredLength = Number(
    request.headers.get('content-length') || 0,
  );

  if (declaredLength > MAX_BODY) return response(413);

  let input;

  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return response(413);
    input = JSON.parse(text);
  } catch {
    return response(400);
  }

  const event = sanitizeAnalyticsEvent(input);
  if (!event) return response(400);

  const db = client();

  // Analytics must never break the learning experience. A missing store is a
  // silent no-op rather than an application error.
  if (!db) {
    return response(204, { 'x-analytics-status': 'disabled' });
  }

  const keys = analyticsKeys(event, utcDateKey());

  try {
    for (const key of keys) {
      const count = await db.incr(key);

      if (count === 1 && key.includes(':day:')) {
        await db.expire(key, DAILY_TTL_SECONDS);
      }
    }
  } catch {
    return response(204, { 'x-analytics-status': 'unavailable' });
  }

  return response();
}
