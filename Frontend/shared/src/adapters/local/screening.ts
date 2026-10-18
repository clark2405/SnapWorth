/**
 * The development rule set from the backend's `rules` moderation provider, for the on-device
 * store: holds off-platform contact, scam accusations, insults and links. A stand-in that keeps
 * the moderation path visible before a backend is configured; real screening happens on the
 * server.
 */
const rules: readonly RegExp[] = [
  /\b(dm|pm|text|viber|whats\s?app|telegram)\s+me\b/i,
  /(?:\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}/,
  /\b(scam(?:mer|ming)?|fraud)\b/i,
  /\b(idiot|stupid|moron|loser|shut up)\b/i,
  /\bhttps?:\/\/|www\./i,
];

export function screenWithRules(body: string): 'approved' | 'held' {
  return rules.some((rule) => rule.test(body)) ? 'held' : 'approved';
}
