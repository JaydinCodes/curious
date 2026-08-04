import { Redis } from '@upstash/redis';

const url =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  throw new Error(
    'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN before running this report.',
  );
}

const redis = new Redis({ url, token });
const prefix = 'cc:analytics:v1:all:event:';
const keys = await redis.keys(`${prefix}*`);
const rows = [];

for (const key of keys) {
  const value = Number(await redis.get(key)) || 0;
  const label = key.slice(prefix.length);
  rows.push({ metric: decodeURIComponent(label), count: value });
}

rows.sort((left, right) =>
  right.count - left.count || left.metric.localeCompare(right.metric),
);

const eventTotals = rows.filter(row => !row.metric.includes(':'));
const dimensions = rows.filter(row => row.metric.includes(':'));

console.log('\nEvent totals');
console.table(eventTotals);

console.log('\nTop dimensions');
console.table(dimensions.slice(0, 50));

console.log(
  '\nPrivacy note: these are aggregate counters. No visitor, cookie, IP, session, note, URL or raw search term is stored.',
);
