import type { SupabaseClient } from '@supabase/supabase-js';

import type { HanapPost, HanapRepository } from '../../ports/hanap';
import type { UtcDateTime } from '../../types/date-time';
import type { ModerationStatus } from '../../types/entities';
import { err, ok } from '../../types/result';
import { toAppError } from './errors';
import { ensureSignedIn } from './session';

interface HanapRow {
  readonly id: string;
  readonly author_id: string;
  readonly body: string;
  readonly max_php: number | null;
  readonly status: 'open' | 'found';
  readonly moderation_status: ModerationStatus;
  readonly created_at: string;
  readonly author: { readonly handle: string } | readonly { readonly handle: string }[] | null;
}

const columns =
  'id, author_id, body, max_php, status, moderation_status, created_at, author:profiles(handle)';

function fromRow(row: HanapRow, viewerId: string | null): HanapPost {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return {
    id: row.id,
    authorHandle: (author as { handle?: string } | null)?.handle ?? 'someone',
    body: row.body,
    maxPhp: row.max_php,
    status: row.status,
    moderation: row.moderation_status,
    createdAt: row.created_at as UtcDateTime,
    mine: viewerId !== null && row.author_id === viewerId,
  };
}

/**
 * Hanap posts stored in Supabase (`hanap_posts`). Who may see or change what is decided by the
 * database's row-level security; this adapter only translates. A new post is screened by the
 * `moderate-content` function straight away, as comments are.
 */
export function createSupabaseHanapRepository(client: SupabaseClient): HanapRepository {
  async function viewerId(): Promise<string | null> {
    const { data } = await client.auth.getSession();
    return data.session?.user.id ?? null;
  }

  return {
    async list() {
      const [{ data, error }, viewer] = await Promise.all([
        client
          .from('hanap_posts')
          .select(columns)
          .order('created_at', { ascending: false })
          .limit(100),
        viewerId(),
      ]);
      if (error) return err(toAppError(error, 'load_hanap', 'hanap'));
      return ok((data as unknown as HanapRow[]).map((row) => fromRow(row, viewer)));
    },

    async post({ body, maxPhp }) {
      const signedIn = await ensureSignedIn(client);
      if (!signedIn.ok) return err(signedIn.error);
      const { data, error } = await client
        .from('hanap_posts')
        .insert({ body, max_php: maxPhp })
        .select(columns)
        .single();
      if (error) return err(toAppError(error, 'publish_hanap', 'hanap'));
      const row = data as unknown as HanapRow;
      // A provider that can't decide yet leaves it pending, seen only by its author.
      const screened = await client.functions.invoke<{ status?: ModerationStatus }>(
        'moderate-content',
        { body: { type: 'hanap', id: row.id } },
      );
      return ok(
        fromRow(
          { ...row, moderation_status: screened.data?.status ?? row.moderation_status },
          signedIn.value,
        ),
      );
    },

    async setFound(id, found) {
      const { data, error } = await client
        .from('hanap_posts')
        .update({ status: found ? 'found' : 'open' })
        .eq('id', id)
        .select('id');
      if (error) return err(toAppError(error, 'update_hanap', 'hanap'));
      return data.length > 0
        ? ok(undefined)
        : err({ kind: 'authorization', code: 'not_found_or_denied' });
    },

    async remove(id) {
      const { data, error } = await client.from('hanap_posts').delete().eq('id', id).select('id');
      if (error) return err(toAppError(error, 'update_hanap', 'hanap'));
      return data.length > 0
        ? ok(undefined)
        : err({ kind: 'authorization', code: 'not_found_or_denied' });
    },
  };
}
