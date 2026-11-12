import type { SupabaseClient } from '@supabase/supabase-js';

import type { AdminRepository, ReviewCase, ReviewKind } from '../../ports/admin';
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
