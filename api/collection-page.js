import { readFileSync } from 'node:fs';

import {
  getCollection,
} from '../src/data/collections.js';
import {
  collectionPath,
} from '../src/topic-url.js';
import {
  injectSocialMetadata,
  requestOrigin,
} from '../src/server/html.js';

const template = readFileSync(
  new URL('../collection.html', import.meta.url),
  'utf8',
);

export async function GET(request) {
  const url = new URL(request.url);
  const slug = String(url.searchParams.get('slug') || '')
    .trim()
    .toLowerCase();
  const collection = getCollection(slug);

  if (!collection) {
    return new Response('Collection not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const origin = requestOrigin(request);
  const canonical = `${origin}${collectionPath(collection)}`;
  const image = `${origin}/api/og?collection=${encodeURIComponent(collection.slug)}`;
  const title = `${collection.title} · The Curiosity Catalog`;

  const html = injectSocialMetadata(template, {
    title,
    description: collection.description,
    canonical,
    image,
    type: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: collection.title,
      description: collection.description,
      url: canonical,
      isPartOf: {
        '@type': 'WebSite',
        name: 'The Curiosity Catalog',
        url: origin,
      },
      numberOfItems: collection.codes.length,
    },
  });

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
