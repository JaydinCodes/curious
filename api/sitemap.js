import { topics } from '../src/data/catalog.js';
import { collections } from '../src/data/collections.js';
import {
  collectionPath,
  topicPath,
} from '../src/topic-url.js';
import { requestOrigin } from '../src/server/html.js';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(request) {
  const origin = requestOrigin(request);
  const urls = [
    `${origin}/`,
    ...collections.map(collection =>
      `${origin}${collectionPath(collection)}`,
    ),
    ...topics.map(topic => `${origin}${topicPath(topic)}`),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
