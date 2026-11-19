import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import type { LivePosition, PositionWatchPort } from '../../ports/location';
import type { MeetupLocationRepository, SharedPosition } from '../../ports/meetup-location';
import type { MessageId } from '../../types/ids';
import { distanceMeters } from './meetup-map-geo';

/** How long one share lasts before it stops by itself. */
export const shareForMs = 60 * 60 * 1000;
/** A moving phone's position goes out at most this often, or after moving this far. */
const sendEveryMs = 10_000;
const sendAfterMeters = 15;
/** Positions are asked for again this often, in case a change over Realtime was missed. */
const refreshEveryMs = 30_000;

export type ShareOutcome = 'sharing' | 'denied' | 'unavailable';

interface Sharing {
  readonly meetupId: MessageId;
  /** When it stops by itself, in milliseconds since the epoch. */
  readonly until: number;
}

interface MeetupLocationContextValue {
  readonly repository: MeetupLocationRepository | null;
  readonly sharing: Sharing | null;
  /** Why sharing stopped on its own (refused by the server), if it did. */
  readonly problem: { readonly meetupId: MessageId; readonly message: string } | null;
  readonly start: (meetupId: MessageId) => Promise<ShareOutcome>;
  readonly stop: (meetupId: MessageId) => Promise<void>;
}

const nobody: MeetupLocationContextValue = {
  repository: null,
  sharing: null,
  problem: null,
  start: async () => 'unavailable',
  stop: async () => undefined,
};

const MeetupLocationContext = createContext<MeetupLocationContextValue>(nobody);

/**
 * Sharing the phone's position at an agreed meetup, for the whole app: one meetup at a time, so
 * it carries on while the person moves between screens. It follows the phone while the app is
 * open, pauses in the background (an app can't be followed there without asking for much more),
 * picks up again on return, and stops by itself after an hour.
 */
export function MeetupLocationProvider({
  repository,
  watcher,
  children,
}: {
  readonly repository: MeetupLocationRepository;
  readonly watcher: PositionWatchPort;
  readonly children: ReactNode;
}) {
  const [sharing, setSharing] = useState<Sharing | null>(null);
  const [problem, setProblem] = useState<MeetupLocationContextValue['problem']>(null);
  const following = useRef<(() => void) | null>(null);
  const lastSent = useRef<{ readonly at: number; readonly position: LivePosition } | null>(null);
  const current = useRef<Sharing | null>(null);
  current.current = sharing;

  const unfollow = useCallback(() => {
    following.current?.();
    following.current = null;
  }, []);

  const end = useCallback(
    async (meetupId: MessageId) => {
      if (current.current?.meetupId !== meetupId) return;
      unfollow();
      current.current = null;
      setSharing(null);
      lastSent.current = null;
      await repository.stop(meetupId);
    },
    [repository, unfollow],
  );

  const send = useCallback(
    async (meetupId: MessageId, position: LivePosition) => {
      const now = Date.now();
      const last = lastSent.current;
      if (
        last &&
        now - last.at < sendEveryMs &&
        distanceMeters(last.position, position) < sendAfterMeters
      ) {
        return;
      }
      lastSent.current = { at: now, position };
      const result = await repository.share(meetupId, position);
      if (!result.ok && current.current?.meetupId === meetupId) {
        // The server said no (blocked, the meetup gone, the other account deleted): stop for good
        // rather than keep asking. Offline is different: the next move tries again.
        if (result.error.kind !== 'offline') {
          unfollow();
          current.current = null;
          setSharing(null);
          setProblem({
            meetupId,
            message:
              result.error.kind === 'conflict'
                ? 'You can’t share your location in this conversation any more.'
                : 'Couldn’t share your location. Try again in a moment.',
          });
        } else {
          lastSent.current = null;
        }
      }
    },
    [repository, unfollow],
  );

  const follow = useCallback(
    async (meetupId: MessageId): Promise<ShareOutcome> => {
      unfollow();
      const watch = await watcher.watch((position) => void send(meetupId, position));
      if (watch.status !== 'granted') return watch.status;
      // Stopped (or moved to another meetup) while permission was being asked for.
      if (current.current?.meetupId !== meetupId) {
        watch.stop();
        return 'sharing';
      }
      following.current = watch.stop;
      return 'sharing';
    },
    [send, unfollow, watcher],
  );

  const start = useCallback(
    async (meetupId: MessageId): Promise<ShareOutcome> => {
      const previous = current.current;
      if (previous && previous.meetupId !== meetupId) await end(previous.meetupId);
      const next = { meetupId, until: Date.now() + shareForMs };
      current.current = next;
      setSharing(next);
      setProblem(null);
      lastSent.current = null;
      const outcome = await follow(meetupId);
      if (outcome !== 'sharing' && current.current?.meetupId === meetupId) {
        current.current = null;
        setSharing(null);
      }
      return outcome;
    },
    [end, follow],
  );

  // An hour on, it stops by itself.
  useEffect(() => {
    if (!sharing) return;
    const timer = setTimeout(() => void end(sharing.meetupId), sharing.until - Date.now());
    return () => clearTimeout(timer);
  }, [end, sharing]);

  // In the background the phone can't be followed; on return it's picked up again.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = current.current;
      if (!active) return;
      if (state === 'active') {
        if (Date.now() >= active.until) void end(active.meetupId);
        else void follow(active.meetupId);
      } else {
        unfollow();
      }
    });
    return () => subscription.remove();
  }, [end, follow, unfollow]);

  useEffect(() => unfollow, [unfollow]);

  const value = useMemo(
    () => ({ repository, sharing, problem, start, stop: end }),
    [end, problem, repository, sharing, start],
  );
  return <MeetupLocationContext.Provider value={value}>{children}</MeetupLocationContext.Provider>;
}

/**
 * Live location at one agreed meetup: who's sharing where (kept current), whether the viewer is
 * sharing, and the means to start and stop. With `enabled` false (not agreed yet) nothing is
 * asked for. Outside a provider nothing can be shared (`available` is false).
 */
export function useMeetupLocation(meetupId: MessageId, enabled: boolean) {
  const context = useContext(MeetupLocationContext);
  const { repository } = context;
  const [positions, setPositions] = useState<readonly SharedPosition[]>([]);
  // Moves on every refresh, so "updated 2 min ago" stays true.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || !repository) {
      setPositions([]);
      return;
    }
    let live = true;
    const load = async () => {
      const result = await repository.positions(meetupId);
      if (!live) return;
      if (result.ok) setPositions(result.value);
      setNow(Date.now());
    };
    void load();
    const unsubscribe = repository.watch(meetupId, () => void load());
    const timer = setInterval(() => void load(), refreshEveryMs);
    return () => {
      live = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, [enabled, meetupId, repository]);

  const sharing = context.sharing?.meetupId === meetupId ? context.sharing : null;
  return {
    available: repository !== null,
    positions,
    theirs: positions.find((position) => !position.mine) ?? null,
    sharing,
    problem: context.problem?.meetupId === meetupId ? context.problem.message : null,
    now,
    start: () => context.start(meetupId),
    stop: () => context.stop(meetupId),
  };
}

/** "120 m", "1.4 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

/** "just now", "3 min ago". */
export function formatUpdated(updatedAt: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(updatedAt)) / 60_000);
  return minutes < 1 ? 'just now' : `${minutes} min ago`;
}
