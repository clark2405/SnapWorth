import type { SupabaseClient } from '@supabase/supabase-js';

import type { FeedPost, FeedRepository, PublishFeedPostInput } from '../../ports/feed';
import type { MarketCategory } from '../../ports/marketplace';
import type { UtcDateTime } from '../../types/date-time';
import type { ModerationStatus, VoteChoice, VoteCounts } from '../../types/entities';
import { err, ok } from '../../types/result';
import { toAppError } from './errors';
import { createSupabaseScanPhotos, type ScanPhotoStore } from './photo-storage';
import { accountIdOf } from './account';
import { requireSignedIn } from './session';

interface ProfileJoin {
  readonly id: string;
  readonly handle: string;
  readonly avatar_url?: string | null;
}

interface ListingJoin {
  readonly id: string;
  readonly slug: string;
  readonly asking_php: number;
  readonly photo_path?: string | null;
}

interface FeedPostRow {
  readonly id: string;
  readonly slug: string;
  readonly owner_id: string;
  readonly title?: string | null;
  readonly category?: MarketCategory | null;
  readonly body: string;
  readonly estimate_php: number | null;
  readonly scan_id?: string | null;
  readonly listing_id?: string | null;
  readonly photo_path?: string | null;
  readonly too_high_count?: number | null;
  readonly just_right_count?: number | null;
  readonly too_low_count?: number | null;
  readonly moderation_status: ModerationStatus;
  readonly created_at: string;
  readonly author?: ProfileJoin | readonly ProfileJoin[] | null;
  readonly listing?: ListingJoin | readonly ListingJoin[] | null;
}

interface VoteRow {
  readonly post_id: string;
  readonly choice: VoteChoice;
  readonly updated_at: string;
  readonly post?:
    | { readonly id: string; readonly slug: string }
    | readonly { readonly id: string; readonly slug: string }[]
    | null;
}

const postColumns =
  'id, slug, owner_id, title, category, body, estimate_php, scan_id, listing_id, photo_path, too_high_count, just_right_count, too_low_count, moderation_status, created_at, author:profiles!feed_posts_owner_id_fkey(id, handle, avatar_url), listing:listings!feed_posts_listing_id_fkey(id, slug, asking_php, photo_path)';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unwrapJoin<T>(joined: T | readonly T[] | null | undefined): T | null {
  if (!joined) return null;
  return Array.isArray(joined) ? (joined[0] ?? null) : (joined as T);
}

function effectivePhotoPath(row: FeedPostRow): string | null {
  if (row.photo_path) return row.photo_path;
  const listing = unwrapJoin(row.listing);
  return listing?.photo_path ?? null;
}

function toFeedPost(
  row: FeedPostRow,
  viewerId: string | null,
  photoUrls: Readonly<Record<string, string>>,
): FeedPost {
  const author = unwrapJoin(row.author);
  const listing = unwrapJoin(row.listing);
  const path = effectivePhotoPath(row);
  const resolvedPhotoUrl = path ? (photoUrls[path] ?? null) : null;
  const title = row.title?.trim() || row.body;

  return {
    id: row.id,
    slug: row.slug,
    title,
    category: row.category ?? null,
    body: row.body,
    estimate: row.estimate_php,
    photoUrl: resolvedPhotoUrl,
    photoLabel: title,
    votes: {
      too_high: row.too_high_count ?? 0,
      just_right: row.just_right_count ?? 0,
      too_low: row.too_low_count ?? 0,
    },
    moderationStatus: row.moderation_status,
    createdAt: new Date(row.created_at).toISOString() as UtcDateTime,
    author: {
      userId: author?.id ?? row.owner_id,
      handle: author?.handle ?? 'collector',
      avatarUrl: author?.avatar_url ?? null,
    },
    scanId: row.scan_id ?? null,
    listing: listing
      ? {
          id: listing.id,
          slug: listing.slug,
          askingPrice: listing.asking_php,
        }
      : null,
    isMine: viewerId !== null && row.owner_id === viewerId,
  };
}

export interface SupabaseFeedRepositoryOptions {
  readonly scanPhotos?: ScanPhotoStore;
}

/**
 * Community price-check posts and votes stored in Supabase (`feed_posts` and `votes`).
 * New posts are screened immediately through the `moderate-content` Edge Function.
 */
export function createSupabaseFeedRepository(
  client: SupabaseClient,
  options: SupabaseFeedRepositoryOptions = {},
): FeedRepository {
  const scanPhotos = options.scanPhotos ?? createSupabaseScanPhotos(client);

  async function viewerId(): Promise<string | null> {
    const { data } = await client.auth.getSession();
    return accountIdOf(data.session);
  }

  async function resolvePhotoUrls(
    rows: readonly FeedPostRow[],
  ): Promise<Readonly<Record<string, string>>> {
    const paths = [...new Set(rows.map(effectivePhotoPath).filter((p): p is string => Boolean(p)))];
    if (paths.length === 0) return {};
    return scanPhotos.links(paths);
  }

  async function findPostRow(idOrSlug: string): Promise<FeedPostRow | null> {
    const column = uuidPattern.test(idOrSlug) ? 'id' : 'slug';
    const { data, error } = await client
      .from('feed_posts')
      .select(postColumns)
      .eq(column, idOrSlug)
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as FeedPostRow;
  }

  return {
    async list() {
      const [{ data, error }, viewer] = await Promise.all([
        client
          .from('feed_posts')
          .select(postColumns)
          .order('created_at', { ascending: false })
          .limit(100),
        viewerId(),
      ]);
      if (error) return err(toAppError(error, 'load_post'));
      const rows = (data ?? []) as unknown as FeedPostRow[];
      const photoUrls = await resolvePhotoUrls(rows);
      return ok(rows.map((row) => toFeedPost(row, viewer, photoUrls)));
    },

    async getByIdOrSlug(idOrSlug) {
      const trimmed = idOrSlug.trim();
      if (!trimmed) return ok(null);
      const [row, viewer] = await Promise.all([findPostRow(trimmed), viewerId()]);
      if (!row) return ok(null);
      const photoUrls = await resolvePhotoUrls([row]);
      return ok(toFeedPost(row, viewer, photoUrls));
    },

    async publish(input: PublishFeedPostInput) {
      const signedIn = await requireSignedIn(client);
      if (!signedIn.ok) return err(signedIn.error);
      const userId = signedIn.value;

      const body = input.body.trim();
      if (body.length === 0) return err({ kind: 'validation', code: 'empty_body' });
      if (body.length > 280) return err({ kind: 'validation', code: 'too_long' });

      const scanId = input.scanId && uuidPattern.test(input.scanId) ? input.scanId : null;
      const photoPath = input.photoPath ?? (scanId ? `${userId}/${scanId}.jpg` : null);

      let listingUuid: string | null = null;
      if (input.listingId) {
        if (uuidPattern.test(input.listingId)) {
          listingUuid = input.listingId;
        } else {
          const { data: listingData } = await client
            .from('listings')
            .select('id')
            .eq('slug', input.listingId)
            .maybeSingle();
          listingUuid = (listingData as { id?: string } | null)?.id ?? null;
        }
      }

      const { data, error } = await client
        .from('feed_posts')
        .insert({
          title: input.title.trim(),
          body,
          category: input.category ?? null,
          scan_id: scanId,
          listing_id: listingUuid,
          photo_path: photoPath,
        })
        .select(postColumns)
        .single();
      if (error) return err(toAppError(error, 'submit_comment'));

      const row = data as unknown as FeedPostRow;
      const screened = await client.functions.invoke<{ status?: ModerationStatus }>(
        'moderate-content',
        { body: { type: 'post', id: row.id } },
      );
      const updatedRow: FeedPostRow = {
        ...row,
        moderation_status: screened.data?.status ?? row.moderation_status,
      };
      const photoUrls = await resolvePhotoUrls([updatedRow]);
      return ok(toFeedPost(updatedRow, userId, photoUrls));
    },

    async remove(idOrSlug) {
      const signedIn = await requireSignedIn(client);
      if (!signedIn.ok) return err(signedIn.error);
      const column = uuidPattern.test(idOrSlug) ? 'id' : 'slug';
      const { data, error } = await client
        .from('feed_posts')
        .delete()
        .eq(column, idOrSlug)
        .select('id');
      if (error) return err(toAppError(error, 'delete_comment'));
      return (data ?? []).length > 0
        ? ok(undefined)
        : err({ kind: 'authorization', code: 'not_found_or_denied' });
    },

    async listVotes() {
      const viewer = await viewerId();
      if (!viewer) return ok([]);
      const { data, error } = await client
        .from('votes')
        .select('post_id, choice, updated_at, post:feed_posts!votes_post_id_fkey(id, slug)')
        .eq('user_id', viewer)
        .order('updated_at', { ascending: false });
      if (error) return err(toAppError(error, 'load_post'));
      const rows = (data ?? []) as unknown as VoteRow[];
      return ok(
        rows.flatMap((row) => {
          const post = unwrapJoin(row.post);
          if (!post) return [];
          return [
            {
              postId: post.id,
              postSlug: post.slug,
              choice: row.choice,
              castAt: new Date(row.updated_at).toISOString() as UtcDateTime,
            },
          ];
        }),
      );
    },

    async setVote(postIdOrSlug, choice) {
      const signedIn = await requireSignedIn(client);
      if (!signedIn.ok) return err(signedIn.error);
      const userId = signedIn.value;

      const target = await findPostRow(postIdOrSlug);
      if (!target) {
        return err({ kind: 'authorization', code: 'not_found_or_denied' });
      }

      if (choice === null) {
        const { error } = await client
          .from('votes')
          .delete()
          .eq('post_id', target.id)
          .eq('user_id', userId);
        if (error) return err(toAppError(error, 'submit_comment'));
      } else {
        // Change the person's vote if they have one, else add it. Not an upsert: its DO UPDATE
        // would also rewrite post_id and user_id, which the table's grants refuse (42501). The
        // update needs no user_id because the row policy only lets people change their own.
        const changeVote = () =>
          client.from('votes').update({ choice }).eq('post_id', target.id).select('post_id');
        const changed = await changeVote();
        if (changed.error) return err(toAppError(changed.error, 'submit_comment'));
        if ((changed.data ?? []).length === 0) {
          const added = await client.from('votes').insert({ post_id: target.id, choice });
          if (added.error?.code === '23505') {
            // Another tab voted between the two statements: change that vote instead.
            const raced = await changeVote();
            if (raced.error) return err(toAppError(raced.error, 'submit_comment'));
          } else if (added.error) {
            return err(toAppError(added.error, 'submit_comment'));
          }
        }
      }

      const { data: refreshed } = await client
        .from('feed_posts')
        .select('too_high_count, just_right_count, too_low_count')
        .eq('id', target.id)
        .maybeSingle();
      const counts = refreshed as {
        readonly too_high_count?: number | null;
        readonly just_right_count?: number | null;
        readonly too_low_count?: number | null;
      } | null;
      const votes: VoteCounts = {
        too_high: counts?.too_high_count ?? target.too_high_count ?? 0,
        just_right: counts?.just_right_count ?? target.just_right_count ?? 0,
        too_low: counts?.too_low_count ?? target.too_low_count ?? 0,
      };
      return ok({ votes, choice });
    },
  };
}
