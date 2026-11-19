import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type { MeetupLocationRepository, SharedPosition } from '../../ports/meetup-location';
import type { UtcDateTime } from '../../types/date-time';
import type { MessageId, UserId } from '../../types/ids';
import { err, ok } from '../../types/result';
import { toAppError } from './errors';
import { requireSignedIn } from './session';

interface PositionRow {
  readonly user_id: string;
  readonly lat: number;
  readonly lng: number;
  readonly accuracy_m: number | null;
  readonly updated_at: string;
}

/**
 * Live location at agreed meetups, in Supabase (`meetup_locations`, written only through
 * `share_meetup_location` and `stop_sharing_meetup_location`). The database decides who may
 * share and see; changes arrive over Realtime, which applies the same rule to each one.
 */
export function createSupabaseMeetupLocations(client: SupabaseClient): MeetupLocationRepository {
  return {
    async share(meetupId, position) {
      const { error } = await client.rpc('share_meetup_location', {
        meetup: meetupId,
        lat: position.lat,
        lng: position.lng,
        accuracy_m: position.accuracyM,
      });
      return error ? err(toAppError(error, 'share_location', 'location')) : ok(undefined);
    },

    async stop(meetupId) {
      const { error } = await client.rpc('stop_sharing_meetup_location', { meetup: meetupId });
      return error ? err(toAppError(error, 'share_location', 'location')) : ok(undefined);
    },

    async positions(meetupId) {
      const viewer = await requireSignedIn(client);
      if (!viewer.ok) return viewer;
      const { data, error } = await client
        .from('meetup_locations')
        .select('user_id, lat, lng, accuracy_m, updated_at')
        .eq('meetup_id', meetupId);
      if (error) return err(toAppError(error, 'share_location', 'location'));
      return ok(
        (data as PositionRow[]).map((row): SharedPosition => ({
          userId: row.user_id as UserId,
          mine: row.user_id === viewer.value,
          lat: row.lat,
          lng: row.lng,
          accuracyM: row.accuracy_m,
          updatedAt: row.updated_at as UtcDateTime,
        })),
      );
    },

    watch(meetupId: MessageId, onChange) {
      let channel: RealtimeChannel | undefined = client
        .channel(`meetup-location:${meetupId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meetup_locations',
            filter: `meetup_id=eq.${meetupId}`,
          },
          () => onChange(),
        )
        .subscribe();
      return () => {
        if (channel) void client.removeChannel(channel);
        channel = undefined;
      };
    },
  };
}
