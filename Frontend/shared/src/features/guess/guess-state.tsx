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

import type { DeviceStore } from '../history/device-store';
import { toPreviewListing, useMarketplace } from '../marketplace/marketplace-state';
import { previewListingWorth } from '../preview/sample-data';
import { useBackendMode } from '../session/backend-mode';
import {
  dailyItems,
  dayKey,
  guessPoints,
  guessPool,
  roundsPerDay,
  sharpEyes,
  streak,
  type DayGame,
  type GuessItem,
} from './guess-game';

const storageKey = 'snapworth.guess-the-worth.v1';
/** Old days kept for the streak and the badge count; a few months is plenty. */
const keptDays = 120;

export interface GuessGame {
  readonly status: 'loading' | 'ready';
  readonly today: string;
  /** Today's things to guess. */
  readonly items: readonly GuessItem[];
  /**
   * Whether there's a game today. With a Supabase project the game is only the Market's real
   * listings that carry an AI estimate, and needs enough of them to deal a day.
   */
  readonly available: boolean;
  /** Today's game so far. */
  readonly game: DayGame;
  readonly streak: number;
  /** Finished days that earned the Sharp eye badge. */
  readonly sharpEyes: number;
  /** Guesses the next of today's things. Once a thing is guessed, it can't be guessed again. */
  readonly guess: (amount: number) => void;
}

interface GuessStore {
  readonly status: 'loading' | 'ready';
  readonly games: readonly DayGame[];
  readonly setGames: (change: (current: readonly DayGame[]) => readonly DayGame[]) => void;
}

const GuessContext = createContext<GuessStore | null>(null);

function useGuessStore(store: DeviceStore | null): GuessStore {
  const [games, setGamesState] = useState<readonly DayGame[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready'>(store ? 'loading' : 'ready');
  const touched = useRef(false);

  useEffect(() => {
    if (!store) return;
    let active = true;
    void store
      .getItem(storageKey)
      .then((saved) => {
        if (!active) return;
        if (!touched.current && saved) setGamesState(JSON.parse(saved) as DayGame[]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setStatus('ready');
      });
    return () => {
      active = false;
    };
  }, [store]);

  // Only the player's own guesses are saved; loading writes nothing.
  useEffect(() => {
    if (store && touched.current) {
      void store.setItem(storageKey, JSON.stringify(games)).catch(() => undefined);
    }
  }, [games, store]);

  const setGames = useCallback((change: (current: readonly DayGame[]) => readonly DayGame[]) => {
    touched.current = true;
    setGamesState((current) => change(current).slice(-keptDays));
  }, []);
  return { status, games, setGames };
}

/**
 * Guess the worth's days, kept on this device: a guess is the player's own, and the game needs
 * no account. The composition root supplies the store.
 */
export function GuessProvider({
  store,
  children,
}: {
  readonly store: DeviceStore;
  readonly children: ReactNode;
}) {
  const value = useGuessStore(store);
  return <GuessContext.Provider value={value}>{children}</GuessContext.Provider>;
}

/**
 * Today's Guess the worth. Outside a provider (a screen rendered on its own, as in tests) the
 * game lives only as long as the screen. `now` is for tests.
 */
export function useGuessGame(now: () => Date = () => new Date()): GuessGame {
  const context = useContext(GuessContext);
  const fallback = useGuessStore(null);
  const { status, games, setGames } = context ?? fallback;
  const { listings } = useMarketplace();
  const mode = useBackendMode();
  const today = dayKey(now());
  const { items, available } = useMemo(() => {
    // The sample listings' worths only stand in on a device with no Supabase project.
    const worths: Record<
      string,
      { readonly estimate: number; readonly low: number; readonly high: number }
    > = mode === 'device' ? { ...previewListingWorth } : {};
    for (const listing of listings) {
      if (
        typeof listing.estimatePhp === 'number' &&
        typeof listing.estimateLowPhp === 'number' &&
        typeof listing.estimateHighPhp === 'number'
      ) {
        worths[listing.id] = {
          estimate: listing.estimatePhp,
          low: listing.estimateLowPhp,
          high: listing.estimateHighPhp,
        };
      }
    }
    const pool = guessPool(listings.map(toPreviewListing), worths);
    if (pool.length >= roundsPerDay) return { items: dailyItems(today, pool), available: true };
    return mode === 'device'
      ? { items: dailyItems(today, guessPool()), available: true }
      : { items: [], available: false };
  }, [listings, mode, today]);
  const game = games.find((entry) => entry.day === today) ?? { day: today, guesses: [] };

  const guess = useCallback(
    (amount: number) =>
      setGames((current) => {
        const saved = current.find((entry) => entry.day === today);
        const guesses = saved?.guesses ?? [];
        const item = items[guesses.length];
        if (!item || guesses.length >= roundsPerDay) return current;
        const next: DayGame = {
          day: today,
          guesses: [
            ...guesses,
            { itemId: item.id, amount, points: guessPoints(amount, item.worth) },
          ],
        };
        return saved
          ? current.map((entry) => (entry.day === today ? next : entry))
          : [...current, next];
      }),
    [items, setGames, today],
  );

  return {
    status,
    today,
    items,
    available,
    game,
    streak: streak(games, today),
    sharpEyes: sharpEyes(games),
    guess,
  };
}
