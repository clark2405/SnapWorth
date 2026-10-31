import { hanapWords, matchesHanap, parseBudget } from './hanap-match';

const listing = (title: string, askingPrice: number) => ({ title, askingPrice });

it('keeps only the words that name the thing', () => {
  expect(hanapWords('Looking for a Nike windbreaker, size M, under 1500 pls')).toEqual([
    'nike',
    'windbreaker',
  ]);
});

it('matches a listing with every word, at or under the budget', () => {
  const hanap = { body: 'Nike windbreaker', maxPhp: 2500 };
  expect(matchesHanap(hanap, listing('Retro Nike Teal Windbreaker', 2400))).toBe(true);
  expect(matchesHanap(hanap, listing('Retro Nike Teal Windbreaker', 2600))).toBe(false);
  expect(matchesHanap(hanap, listing('90s Colour-Block Windbreaker', 1950))).toBe(false);
});

it('finds plurals and leaves the budget open when there is none', () => {
  expect(
    matchesHanap({ body: 'jackets', maxPhp: null }, listing('Black Puffer Jacket', 9000)),
  ).toBe(true);
});

it('never matches a hanap with nothing to look for', () => {
  expect(matchesHanap({ body: 'pls po', maxPhp: null }, listing('Anything at all', 10))).toBe(
    false,
  );
});

it('reads a budget however it was typed', () => {
  expect(parseBudget('₱1,500')).toBe(1500);
  expect(parseBudget('')).toBeNull();
  expect(parseBudget('cheap')).toBeNull();
  expect(parseBudget('0')).toBeNull();
});
