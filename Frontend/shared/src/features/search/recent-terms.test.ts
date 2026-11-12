import { maxRecentSearches, withRecentSearch } from './recent-terms';

describe('withRecentSearch', () => {
  it('puts the newest term first and keeps each term once, ignoring case', () => {
    expect(withRecentSearch(['Jordan', 'Polaroid'], 'polaroid')).toEqual(['polaroid', 'Jordan']);
  });

  it('tidies the term and ignores one too short to mean anything', () => {
    expect(withRecentSearch([], '  Nike   windbreaker ')).toEqual(['Nike windbreaker']);
    const recents = ['Jordan'];
    expect(withRecentSearch(recents, ' a ')).toBe(recents);
  });

  it('keeps only the newest few', () => {
    const many = Array.from({ length: maxRecentSearches }, (_, index) => `term ${index}`);
    const next = withRecentSearch(many, 'fresh');
    expect(next).toHaveLength(maxRecentSearches);
    expect(next[0]).toBe('fresh');
    expect(next).not.toContain(`term ${maxRecentSearches - 1}`);
  });
});
