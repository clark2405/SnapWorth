import type { UtcDateTime } from '../types/date-time';
import type { ModerationStatus } from '../types/entities';
import type { AppError } from '../types/errors';
import type { Result } from '../types/result';

/**
 * A hanap: what someone is looking for ("Nike windbreaker, size M") and the most they'll pay.
 * It's public writing, so it's moderated: others only see it once approved and while it's
 * open; its author always sees their own, with where moderation got to.
 */
export interface HanapPost {
  readonly id: string;
  readonly authorHandle: string;
  readonly body: string;
  /** The most they'll pay, in whole pesos, when they said. */
  readonly maxPhp: number | null;
  readonly status: 'open' | 'found';
  readonly moderation: ModerationStatus;
  readonly createdAt: UtcDateTime;
  readonly mine: boolean;
}

export interface NewHanap {
  readonly body: string;
  readonly maxPhp: number | null;
}

/** Where hanap posts are kept: Supabase, or this device without a project. */
export interface HanapRepository {
  /** Everyone's open, approved posts and all of the viewer's own, newest first. */
  list(): Promise<Result<readonly HanapPost[], AppError>>;
  /** Posts one, screened before others can see it. */
  post(hanap: NewHanap): Promise<Result<HanapPost, AppError>>;
  /** Marks the viewer's own post found (closed) or open again. */
  setFound(id: string, found: boolean): Promise<Result<void, AppError>>;
  remove(id: string): Promise<Result<void, AppError>>;
}
