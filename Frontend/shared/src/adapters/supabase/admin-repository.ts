import type { SupabaseClient } from '@supabase/supabase-js';

import type { AdminRepository, ModerationEntry, ReviewCase, ReviewKind } from '../../ports/admin';
import type { UtcDateTime } from '../../types/date-time';
import type { ModerationStatus } from '../../types/entities';
import { err, ok } from '../../types/result';
import { toAppError } from './errors';
import { createSupabaseScanPhotos, type ScanPhotoStore } from './photo-storage';

/** A row of `admin_review_queue()`. */
interface ReviewRow {
  readonly kind: ReviewKind;
  readonly target_id: string;
  readonly status: ModerationStatus | null;
  readonly body: string;
  readonly author_handle: string;
  readonly author_avatar_url: string | null;
  readonly flag_ref: string | null;
  readonly report_count: number;
  readonly report_reasons: readonly string[] | null;
  readonly flagged_at: string;
  readonly context: string | null;
  readonly title: string | null;
  readonly photo_path: string | null;
}

function fromRow(row: ReviewRow, photoLinks: Readonly<Record<string, string>>): ReviewCase {
  return {
    id: `${row.kind}:${row.target_id}`,
    kind: row.kind,
    targetId: row.target_id,
    status: row.status,
    title: row.title,
    body: row.body,
    photoUrl: row.photo_path ? (photoLinks[row.photo_path] ?? null) : null,
    authorHandle: row.author_handle,
    authorAvatarUrl: row.author_avatar_url,
    flagRef: row.flag_ref,
    reportCount: row.report_count,
    reportReasons: row.report_reasons ?? [],
    flaggedAt: row.flagged_at as UtcDateTime,
    context: row.context,
  };
}

interface OverviewRow {
  readonly open_cases: number;
  readonly reports_this_week: number;
  readonly suspended_accounts: number;
  readonly new_accounts_this_week: number;
  readonly posts_this_week: number;
  readonly decisions_this_week: number;
}

interface PersonRow {
  readonly id: string;
  readonly handle: string;
  readonly display_name: string | null;
  readonly avatar_url: string | null;
  readonly joined_at: string;
  readonly post_count: number;
  readonly comment_count: number;
  readonly listing_count: number;
  readonly reports_against: number;
  readonly removed_count: number;
  readonly suspended: boolean;
  readonly suspended_until: string | null;
  readonly suspension_reason: string | null;
  readonly is_admin: boolean;
}

interface HistoryRow {
  readonly id: string;
  readonly kind: string;
  readonly target_id: string;
  readonly decision: string;
  readonly note: string | null;
  readonly decided_at: string;
  readonly decided_by_handle: string;
  readonly target_label: string | null;
}

/**
 * The review queue in Supabase. It's read and decided only through `admin_review_queue()` and
 * `admin_review_decide()`, which check the caller is an admin and write who decided and when. This
 * adapter only translates: anyone else gets the database's refusal, as an `authorization` error.
 * A listing's or post's photo is in the private `scan-photos` bucket: the database lets an admin
 * read the photos of what is held or pending, so a link is signed for each as the signed-in admin.
 * A photo that can't be linked just isn't shown.
 */
export function createSupabaseAdminRepository(
  client: SupabaseClient,
  photos: ScanPhotoStore = createSupabaseScanPhotos(client),
): AdminRepository {
  return {
    async queue() {
      const { data, error } = await client.rpc('admin_review_queue');
      if (error) return err(toAppError(error, 'load_moderation_queue', 'review'));
      const rows = data as ReviewRow[];
      const photoLinks = await photos.links(
        rows.flatMap((row) => (row.photo_path ? [row.photo_path] : [])),
      );
      return ok(rows.map((row) => fromRow(row, photoLinks)));
    },

    async overview() {
      const { data, error } = await client.rpc('admin_overview');
      if (error) return err(toAppError(error, 'load_moderation_queue', 'review'));
      const row = ((data ?? []) as OverviewRow[])[0];
      return ok({
        openCases: row?.open_cases ?? 0,
        reportsThisWeek: row?.reports_this_week ?? 0,
        suspendedAccounts: row?.suspended_accounts ?? 0,
        newAccountsThisWeek: row?.new_accounts_this_week ?? 0,
        postsThisWeek: row?.posts_this_week ?? 0,
        decisionsThisWeek: row?.decisions_this_week ?? 0,
      });
    },

    async people(search) {
      const term = search.trim().replace(/^@/, '');
      const { data, error } = await client.rpc('admin_find_people', { search: term || null });
      if (error) return err(toAppError(error, 'load_moderation_queue', 'review'));
      return ok(
        ((data ?? []) as PersonRow[]).map((row) => ({
          id: row.id,
          handle: row.handle,
          displayName: row.display_name?.trim() || null,
          avatarUrl: row.avatar_url,
          joinedAt: row.joined_at as UtcDateTime,
          postCount: row.post_count,
          commentCount: row.comment_count,
          listingCount: row.listing_count,
          reportsAgainst: row.reports_against,
          removedCount: row.removed_count,
          suspended: row.suspended,
          suspendedUntil: (row.suspended_until as UtcDateTime | null) ?? null,
          suspensionReason: row.suspension_reason,
          isAdmin: row.is_admin,
        })),
      );
    },

    async suspend(personId, input) {
      const { error } = await client.rpc('admin_suspend_account', {
        target: personId,
        reason: input.reason,
        days: input.days,
        take_down: input.takeDown,
      });
      if (error) return err(toAppError(error, 'resolve_moderation_case', 'review'));
      return ok(undefined);
    },

    async reinstate(personId) {
      const { error } = await client.rpc('admin_reinstate_account', { target: personId });
      if (error) return err(toAppError(error, 'resolve_moderation_case', 'review'));
      return ok(undefined);
    },

    async history() {
      const { data, error } = await client.rpc('admin_moderation_history', { max_rows: 100 });
      if (error) return err(toAppError(error, 'load_moderation_queue', 'review'));
      return ok(
        ((data ?? []) as HistoryRow[]).map((row) => ({
          id: row.id,
          kind: row.kind as ModerationEntry['kind'],
          targetId: row.target_id,
          decision: row.decision as ModerationEntry['decision'],
          note: row.note,
          decidedAt: row.decided_at as UtcDateTime,
          decidedBy: row.decided_by_handle,
          targetLabel: row.target_label,
        })),
      );
    },

    async decide({ kind, targetId }, decision) {
      const { error } = await client.rpc('admin_review_decide', {
        item_kind: kind,
        item_id: targetId,
        decision,
      });
      if (error) return err(toAppError(error, 'resolve_moderation_case', 'review'));
      return ok(undefined);
    },
  };
}
