import { readFileSync } from 'node:fs';

import {
  sections,
  topics,
} from '../src/data/catalog.js';
import {
  formatLabel,
  getTotalMinutes,
} from '../src/curation-model.js';
import {
  topicCodeFromSlug,
  topicPath,
} from '../src/topic-url.js';
import {
  injectSocialMetadata,
  requestOrigin,
} from '../src/server/html.js';

const template = readFileSync(
  new URL('../topic.html', import.meta.url),
  'utf8',
);
const curation = JSON.parse(
  readFileSync(
    new URL('../curated-links.json', import.meta.url),
    'utf8',
  ),
);

export async function GET(request) {
  const url = new URL(request.url);
  const code = topicCodeFromSlug(url.searchParams.get('slug'));
  const topic = topics.find(item => item.code === code);

  if (!topic) {
    return new Response('Topic not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const section = sections.find(item => item.k === topic.c);
  const entry = curation[topic.code] || null;
  const minutes = getTotalMinutes(entry);
  const origin = requestOrigin(request);
  const canonical = `${origin}${topicPath(topic)}`;
  const image = `${origin}/api/og?code=${encodeURIComponent(topic.code)}`;
  const title = `${topic.t} · The Curiosity Catalog`;
  const description = topic.h;

  const html = injectSocialMetadata(template, {
    title,
    description,
    canonical,
    image,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      name: topic.t,
      description: topic.h,
      url: canonical,
      educationalLevel: formatLabel(entry?.difficulty || 'unrated'),
      timeRequired: minutes > 0 ? `PT${minutes}M` : undefined,
      about: section?.name,
      provider: {
        '@type': 'Organization',
        name: 'The Curiosity Catalog',
        url: origin,
      },
    },
  });

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
