import type { ReviewCase, ReviewKind } from '../../ports/admin';
import type { UtcDateTime } from '../../types/date-time';
import { previewHeldContent } from '../preview/sample-data';

const minutesPer = { m: 1, h: 60, d: 1440 } as const;

/** "3h ago" → the time that long before `now`. */
function agoToIso(ago: string, now: number): UtcDateTime {
  const match = /(\d+)\s*([mhd])/.exec(ago);
  const minutes = match ? Number(match[1]) * minutesPer[match[2] as keyof typeof minutesPer] : 0;
  return new Date(now - minutes * 60_000).toISOString() as UtcDateTime;
}

/** The sample cases a device with no backend starts its review queue with. */
export function buildPreviewReviewCases(now: number = Date.now()): readonly ReviewCase[] {
  return previewHeldContent.map((entry) => {
    const kind: ReviewKind = entry.kind;
    return {
      id: `${kind}:${entry.id}`,
      kind,
      targetId: entry.id,
      status: kind === 'conversation' ? null : 'held',
      title: entry.title ?? null,
      body: entry.body,
      photoUrl: null,
      authorHandle: entry.author.handle,
      authorAvatarUrl: null,
      flagRef: entry.flagRef ?? null,
      reportCount: entry.reports,
      reportReasons: entry.reportReasons ?? [],
      flaggedAt: agoToIso(entry.heldAgo, now),
      context: entry.context ?? null,
    };
  });
}
