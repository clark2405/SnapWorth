import type { UtcDateTime } from '../types/date-time';
import type { AppError } from '../types/errors';
import type { MessageId, UserId } from '../types/ids';
import type { Result } from '../types/result';
import type { LivePosition } from './location';
import type { Unsubscribe } from './platform';

/** Someone's shared position at a meetup: theirs or the viewer's own (`mine`). */
export interface SharedPosition {
  readonly userId: UserId;
  readonly mine: boolean;
  readonly lat: number;
  readonly lng: number;
  readonly accuracyM: number | null;
  readonly updatedAt: UtcDateTime;
}

/**
 * Live location at an agreed meetup. Once both people have confirmed it, either can share where
 * they are so they can find each other at the spot. The Supabase implementation leaves who may
 * share and see to the database: only the two people, only an agreed meetup, only a fresh
 * position, never across a block.
 */
export interface MeetupLocationRepository {
  /** Shares (or moves) the viewer's position for a meetup. */
  share(meetupId: MessageId, position: LivePosition): Promise<Result<void, AppError>>;
  /** Stops sharing: the viewer's position is deleted. Stopping twice is harmless. */
  stop(meetupId: MessageId): Promise<Result<void, AppError>>;
  /** The fresh positions shared for a meetup, the viewer's own included. */
  positions(meetupId: MessageId): Promise<Result<readonly SharedPosition[], AppError>>;
  /** Calls `onChange` when a position for the meetup changes. */
  watch(meetupId: MessageId, onChange: () => void): Unsubscribe;
}
