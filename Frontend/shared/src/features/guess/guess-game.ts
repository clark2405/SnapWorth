import type { ImageSourcePropType } from 'react-native';

import type { VoteChoice } from '../../types';
import { formatPeso } from '../preview/peso';
import { previewListings, previewListingWorth, type PreviewListing } from '../preview/sample-data';

/** One thing to guess: a listing, what the AI says it's worth, and what voters make of its price. */
export interface GuessItem {
  readonly id: string;
  readonly title: string;
  readonly photo: ImageSourcePropType | null;
  readonly photoLabel: string;
  /** The answer: the AI's estimate. */
  readonly worth: number;
  readonly low: number;
  readonly high: number;
  readonly askingPrice: number;
  /** What voters make of the asking price; null while nobody has voted on it. */
  readonly verdict: VoteChoice | null;
  readonly verdictShare: number | null;
}

/** How many things a day's game has. */
export const roundsPerDay = 5;
/** The most points one guess can earn. */
export const pointsPerRound = 100;
/** A day's score that earns the Sharp eye badge: on average within about a tenth of the worth. */
export const sharpEyeScore = 400;

/**
 * The listings the game can draw from: the Market's (sample listings until they're stored in
 * Supabase), each with the AI's estimate. A listing without one is left out.
 */
export function guessPool(
  listings: readonly PreviewListing[] = previewListings,
  worths: typeof previewListingWorth = previewListingWorth,
): readonly GuessItem[] {
  return listings.flatMap((listing) => {
    const worth = worths[listing.id];
    if (!worth) return [];
    return [
      {
        id: listing.id,
        title: listing.title,
        photo: listing.photo,
        photoLabel: listing.photoLabel,
        worth: worth.estimate,
        low: worth.low,
        high: worth.high,
        askingPrice: listing.askingPrice,
        verdict: listing.verdict,
        verdictShare: listing.verdictShare,
      },
    ];
  });
}

/** A day as the game knows it, in the phone's own time zone: "2026-11-04". */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A small, steady random-number generator, so a day always deals the same things. */
function seededRandom(seed: string): () => number {
  // FNV-1a, to turn the day into a number, then mulberry32.
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** The day's things to guess: the same for everyone that day, different the next. */
export function dailyItems(day: string, pool: readonly GuessItem[] = guessPool()): GuessItem[] {
  const random = seededRandom(`guess-the-worth:${day}`);
  const deck = [...pool];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1));
    [deck[index], deck[pick]] = [deck[pick]!, deck[index]!];
  }
  return deck.slice(0, roundsPerDay);
}

/** An amount as typed ("2,500", "₱ 2500"), or 0 when it isn't one. */
export function guessAmount(text: string): number {
  const amount = Number(text.replace(/[₱,\s]/g, ''));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
}

/**
 * Points for a guess: 100 when it's on the worth, falling in step with how far off it is, to
 * none at half the worth away or more. Within 5% still counts as spot on.
 */
export function guessPoints(guess: number, worth: number): number {
  const off = Math.abs(guess - worth) / worth;
  if (off <= 0.05) return pointsPerRound;
  return Math.max(0, Math.round(pointsPerRound * (1 - off / 0.5)));
}

/** One guess, as kept. */
export interface Guess {
  readonly itemId: string;
  readonly amount: number;
  readonly points: number;
}

/** A day's game: its guesses so far, in the order the things came. */
export interface DayGame {
  readonly day: string;
  readonly guesses: readonly Guess[];
}

export const dayScore = (game: DayGame): number =>
  game.guesses.reduce((total, guess) => total + guess.points, 0);

export const dayFinished = (game: DayGame): boolean => game.guesses.length >= roundsPerDay;

/** The day before, as a day key. */
function dayBefore(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return dayKey(new Date(year!, month! - 1, date! - 1));
}

/**
 * How many days in a row have been played to the end, counting back from today, or from
 * yesterday when today's isn't finished yet (the streak isn't lost until the day is over).
 */
export function streak(games: readonly DayGame[], today: string): number {
  const finished = new Set(games.filter(dayFinished).map((game) => game.day));
  let day = finished.has(today) ? today : dayBefore(today);
  let count = 0;
  while (finished.has(day)) {
    count += 1;
    day = dayBefore(day);
  }
  return count;
}

/** How many finished days earned the Sharp eye badge. */
export const sharpEyes = (games: readonly DayGame[]): number =>
  games.filter((game) => dayFinished(game) && dayScore(game) >= sharpEyeScore).length;

/** How far a guess was from the worth, in words: "₱250 over", "₱100 under", "spot on". */
export function offByLabel(guess: number, worth: number): string {
  if (guess === worth) return 'spot on';
  return guess > worth ? `${formatPeso(guess - worth)} over` : `${formatPeso(worth - guess)} under`;
}

/** A square per guess for sharing a score without giving the answers away. */
const square = (points: number) => (points >= 90 ? '🟩' : points >= 60 ? '🟨' : '🟥');

/** A day's score, ready to paste anywhere: no prices, so it spoils nothing. */
export function shareText(game: DayGame): string {
  const squares = game.guesses.map((guess) => square(guess.points)).join('');
  return `SnapWorth · Guess the worth ${game.day}\n${dayScore(game)}/${
    roundsPerDay * pointsPerRound
  } ${squares}`;
}
