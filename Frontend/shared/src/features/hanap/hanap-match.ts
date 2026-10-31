/**
 * Whether a listing answers a hanap: every word that names the thing ("nike", "windbreaker") is
 * in its title, and it's at or under the budget when there is one. Words that only describe the
 * hunt ("looking for", "size", "under") don't count, nor does anything shorter than three letters.
 */

const fillers = new Set([
  'and',
  'any',
  'for',
  'from',
  'hanap',
  'lang',
  'looking',
  'need',
  'please',
  'pls',
  'size',
  'the',
  'under',
  'with',
  'want',
  'wanted',
]);

/** The words in a hanap that name the thing wanted, lowercased. */
export function hanapWords(body: string): readonly string[] {
  return [
    ...new Set(
      body
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length >= 3 && !fillers.has(word) && !/^\d+$/.test(word)),
    ),
  ];
}

/** A word of the title counts when one starts with the other: "jacket" finds "jackets". */
function wordIn(title: readonly string[], word: string): boolean {
  return title.some((part) => part.startsWith(word) || (part.length >= 4 && word.startsWith(part)));
}

export function matchesHanap(
  hanap: { readonly body: string; readonly maxPhp: number | null },
  listing: { readonly title: string; readonly askingPrice: number },
): boolean {
  const words = hanapWords(hanap.body);
  if (words.length === 0) return false;
  if (hanap.maxPhp !== null && listing.askingPrice > hanap.maxPhp) return false;
  const title = listing.title.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return words.every((word) => wordIn(title, word));
}

/** Reads a budget as typed ("1500", "₱1,500"), or null for none. */
export function parseBudget(text: string): number | null {
  const plain = text.replace(/[₱,\s]/g, '');
  if (!/^\d+$/.test(plain)) return null;
  const amount = Number(plain);
  return amount >= 1 && amount <= 10_000_000 ? amount : null;
}
