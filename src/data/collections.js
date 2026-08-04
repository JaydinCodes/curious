export const collections = Object.freeze([
  Object.freeze({
    slug: 'best-computing-topics',
    title: 'Best Computing Topics',
    eyebrow: 'Curated computing path',
    description:
      'A guided route below frameworks and libraries: networks, cryptography, compilers, operating systems, databases, distributed systems, machine learning, memory and numerical representation.',
    codes: Object.freeze([
      'COMP.01',
      'COMP.02',
      'COMP.03',
      'COMP.04',
      'COMP.05',
      'COMP.06',
      'COMP.07',
      'COMP.08',
      'COMP.09',
      'COMP.10',
      'COMP.11',
      'COMP.12',
      'COMP.13',
    ]),
  }),
  Object.freeze({
    slug: 'best-topics-for-developers',
    title: 'Best Topics for Developers',
    eyebrow: 'A developer’s deeper curriculum',
    description:
      'Fourteen topics that make day-to-day software work easier to reason about: the Internet, DNS, cryptography, compilers, scheduling, transactions, consensus, compression, memory, floating point, graph theory, time synchronisation, evidence reading and safe system change.',
    codes: Object.freeze([
      'COMP.01',
      'COMP.02',
      'COMP.04',
      'COMP.05',
      'COMP.06',
      'COMP.07',
      'COMP.08',
      'COMP.11',
      'COMP.12',
      'COMP.13',
      'MATH.11',
      'INFR.12',
      'RSCH.04',
      'PRAX.06',
    ]),
  }),
]);

export function getCollection(slug) {
  return collections.find(collection => collection.slug === slug) || null;
}
