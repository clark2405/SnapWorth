/** How many recent terms are kept. */
export const maxRecentSearches = 8;

/** Puts a term first in the recent list: trimmed, once (ignoring case), and only the newest few. */
export function withRecentSearch(recents: readonly string[], term: string): readonly string[] {
  const clean = term.trim().replace(/\s+/g, ' ');
  if (clean.length < 2) return recents;
  return [clean, ...recents.filter((entry) => entry.toLowerCase() !== clean.toLowerCase())].slice(
    0,
    maxRecentSearches,
  );
}
