import { readFileSync } from 'node:fs';

import { ImageResponse } from '@vercel/og';
import React from 'react';

import {
  sections,
  topics,
} from '../src/data/catalog.js';
import {
  getCollection,
} from '../src/data/collections.js';
import {
  formatLabel,
  formatMinutes,
  getTotalMinutes,
} from '../src/curation-model.js';

const curation = JSON.parse(
  readFileSync(
    new URL('../curated-links.json', import.meta.url),
    'utf8',
  ),
);

const SECTION_COLOURS = Object.freeze({
  mind: '#9C6B92',
  prax: '#8A7BB8',
  math: '#4F8FA8',
  cosm: '#5A80B8',
  vita: '#7E9C5E',
  engn: '#B8873D',
  infr: '#A2743F',
  comp: '#59A08C',
  ling: '#C08A5A',
  theo: '#C2A03C',
  art: '#C25F63',
  musc: '#7C6BC4',
  scrn: '#4E9BB5',
  make: '#B07A46',
  sprt: '#6FA34B',
  hist: '#B6704F',
  rsch: '#8D9BA8',
  econ: '#A85F6B',
});

const el = React.createElement;

function topicPayload(code) {
  const topic = topics.find(item => item.code === code);
  if (!topic) return null;

  const section = sections.find(item => item.k === topic.c);
  const entry = curation[topic.code] || null;
  const minutes = getTotalMinutes(entry);

  return {
    eyebrow: `${topic.code} · ${section?.name || 'Topic'}`,
    title: topic.t,
    description: topic.h,
    meta: [
      formatLabel(entry?.difficulty || 'unrated'),
      minutes > 0 ? `${formatMinutes(minutes)} learning path` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    colour: SECTION_COLOURS[topic.c] || '#B8873D',
  };
}

function collectionPayload(slug) {
  const collection = getCollection(slug);
  if (!collection) return null;

  return {
    eyebrow: collection.eyebrow,
    title: collection.title,
    description: collection.description,
    meta: `${collection.codes.length} curated topics`,
    colour: '#E0AE5F',
  };
}

function buildCard(payload) {
  const titleSize = payload.title.length > 55 ? 58 : 72;

  return el(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '68px 76px',
        background: '#12211C',
        color: '#E8E2CF',
        fontFamily: 'Arial, sans-serif',
        border: `18px solid ${payload.colour}`,
      },
    },
    el(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '1020px',
        },
      },
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '10px 16px',
            border: `2px solid ${payload.colour}`,
            color: payload.colour,
            fontSize: '22px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          },
        },
        payload.eyebrow,
      ),
      el(
        'div',
        {
          style: {
            display: 'flex',
            marginTop: '34px',
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            fontSize: `${titleSize}px`,
            lineHeight: 1.03,
            letterSpacing: '-2px',
          },
        },
        payload.title,
      ),
      el(
        'div',
        {
          style: {
            display: 'flex',
            marginTop: '24px',
            maxWidth: '940px',
            color: '#AFC0B7',
            fontSize: '27px',
            lineHeight: 1.35,
          },
        },
        payload.description.length > 190
          ? `${payload.description.slice(0, 187)}…`
          : payload.description,
      ),
    ),
    el(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#E0AE5F',
          fontSize: '22px',
          letterSpacing: '1px',
        },
      },
      el('span', null, payload.meta),
      el('span', null, 'THE CURIOSITY CATALOG'),
    ),
  );
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code')?.trim().toUpperCase();
  const collectionSlug = url.searchParams.get('collection')
    ?.trim()
    .toLowerCase();
  const payload = code
    ? topicPayload(code)
    : collectionPayload(collectionSlug);

  if (!payload) {
    return new Response('Preview not found', { status: 404 });
  }

  const image = new ImageResponse(buildCard(payload), {
    width: 1200,
    height: 630,
  });

  image.headers.set(
    'cache-control',
    'public, s-maxage=86400, stale-while-revalidate=604800',
  );

  return image;
}
