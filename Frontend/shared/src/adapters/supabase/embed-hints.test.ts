import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards a bug the mocked-client tests can't see. `feed_posts` and `listings` each reach
 * `profiles` twice: by their owner foreign key and, many-to-many, through `votes` and
 * `saved_listings`. PostgREST refuses an embed it can't resolve to one path (PGRST201), so
 * `author:profiles(...)` returned an error and Feed, Market, listings and Search came up empty on
 * the live project while every jest test stayed green. Every embed of those relations in a
 * select string must name its foreign key with `!`.
 */
const dir = __dirname;
const sources = readdirSync(dir)
  .filter((name) => name.endsWith('.ts') && !name.includes('.test.'))
  .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));

// An embed is `table(` or `alias:table(` inside a select string, optionally `table!fk(`.
const embedPattern = /(?:\b[a-z_]+:)?\b([a-z_]+)(!\w+)?\(/g;
const embeddedRelations = ['profiles', 'listings', 'feed_posts'];

function embedsIn(text: string): { relation: string; hint: string | undefined }[] {
  const found: { relation: string; hint: string | undefined }[] = [];
  // Only quoted strings, so function calls like `.from('x')` or `ok(` are not mistaken for embeds.
  for (const literal of text.match(/'[^'\n]*'/g) ?? []) {
    for (const match of literal.matchAll(embedPattern)) {
      const relation = match[1];
      if (relation && embeddedRelations.includes(relation)) {
        found.push({ relation, hint: match[2] });
      }
    }
  }
  return found;
}

describe('PostgREST embeds in the Supabase adapters', () => {
  it('finds the embeds this guard is about', () => {
    const all = sources.flatMap((source) => embedsIn(source.text));
    expect(all.length).toBeGreaterThanOrEqual(7);
  });

  it.each(sources.map((source) => [source.name, source.text] as const))(
    '%s names a foreign key on every profiles, listings and feed_posts embed',
    (_name, text) => {
      for (const embed of embedsIn(text)) {
        expect(embed.hint).toMatch(/^!\w+_fkey$/);
      }
    },
  );

  it('uses the foreign keys the live schema reports for the two ambiguous relations', () => {
    const feed = sources.find((s) => s.name === 'feed-repository.ts')?.text ?? '';
    const market = sources.find((s) => s.name === 'marketplace-repository.ts')?.text ?? '';
    expect(feed).toContain('author:profiles!feed_posts_owner_id_fkey(');
    expect(market).toContain('seller:profiles!listings_seller_id_fkey(');
  });
});
