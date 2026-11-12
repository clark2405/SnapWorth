import type { CommentStore, ModerationStatus } from './moderate.ts';

/** The slice of the Supabase client moderation uses; the tests stand in for it. */
export interface ModerationDb {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
      };
    };
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string,
      ): { eq(column: string, value: string): PromiseLike<{ error: unknown }> };
    };
  };
}

/** What can be screened: the table it lives in, the columns that hold its words, how to read them. */
export interface Target {
  readonly table: string;
  readonly columns: string;
  readonly textOf: (row: Record<string, unknown>) => string;
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * Every target has `moderation_status`, `moderation_ref` and `moderated_at`. Comments, Hanap posts
 * and feed posts carry their words in `body`; a listing's are its title and description, screened
 * together so neither can carry what the other would be held for.
 */
export function targetFor(type: unknown): Target | null {
  switch (type) {
    case 'comment':
      return { table: 'comments', columns: 'body', textOf: (row) => text(row.body) };
    case 'hanap':
      return { table: 'hanap_posts', columns: 'body', textOf: (row) => text(row.body) };
    case 'post':
      return { table: 'feed_posts', columns: 'body', textOf: (row) => text(row.body) };
    case 'listing':
      return {
        table: 'listings',
        columns: 'title, description',
        textOf: (row) => [text(row.title), text(row.description)].filter(Boolean).join('\n\n'),
      };
    default:
      return null;
  }
}

/** Reads a target's words and status, and settles it. Only a still-pending row can be settled. */
export function storeFor(db: ModerationDb, target: Target): CommentStore {
  return {
    async get(id) {
      const { data, error } = await db
        .from(target.table)
        .select(`${target.columns}, moderation_status`)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data
        ? { body: target.textOf(data), status: data.moderation_status as ModerationStatus }
        : null;
    },
    async settle(id, status, ref) {
      const { error } = await db
        .from(target.table)
        .update({
          moderation_status: status,
          moderation_ref: ref,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('moderation_status', 'pending');
      if (error) throw error;
    },
  };
}
