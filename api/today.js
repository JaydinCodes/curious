import { topics } from '../src/data/catalog.js';
import { getTopicOfDay } from '../src/topic-of-day.js';
import { topicPath } from '../src/topic-url.js';

export async function GET(request) {
  const topic = getTopicOfDay(topics);

  if (!topic) {
    return new Response('No topic available', { status: 404 });
  }

  return Response.redirect(
    new URL(topicPath(topic), request.url),
    302,
  );
}
