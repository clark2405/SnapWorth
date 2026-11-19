import type { MeetupLocationRepository, SharedPosition } from '../../ports/meetup-location';
import type { UtcDateTime } from '../../types/date-time';
import type { MessageId, UserId } from '../../types/ids';
import { ok } from '../../types/result';

/**
 * Live location on this device alone, for a build with no Supabase project: the viewer's own
 * position is kept in memory while they share it, so the meetup card behaves as it would. The
 * other person, being played by the device, never shares theirs.
 */
export function createLocalMeetupLocations(viewer: UserId): MeetupLocationRepository {
  const shared = new Map<MessageId, SharedPosition>();
  const listeners = new Map<MessageId, Set<() => void>>();
  const changed = (meetupId: MessageId) => listeners.get(meetupId)?.forEach((each) => each());

  return {
    async share(meetupId, position) {
      shared.set(meetupId, {
        userId: viewer,
        mine: true,
        lat: position.lat,
        lng: position.lng,
        accuracyM: position.accuracyM,
        updatedAt: new Date().toISOString() as UtcDateTime,
      });
      changed(meetupId);
      return ok(undefined);
    },
    async stop(meetupId) {
      shared.delete(meetupId);
      changed(meetupId);
      return ok(undefined);
    },
    async positions(meetupId) {
      const mine = shared.get(meetupId);
      return ok(mine ? [mine] : []);
    },
    watch(meetupId, onChange) {
      const set = listeners.get(meetupId) ?? new Set();
      set.add(onChange);
      listeners.set(meetupId, set);
      return () => set.delete(onChange);
    },
  };
}
