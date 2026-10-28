import { useSyncExternalStore } from 'react';

/**
 * Signing in closes the screen into Worthy's tag, stamps it, and opens it again onto the app.
 * The sign-in screen starts it (`closeIntoTag`) as the request goes out, waits for both the
 * request and the tag, moves on to the app behind the tag, and opens it (`openFromTag`). A
 * failed sign-in opens it again where it was (`cancelHandoff`). The overlay drawing it is
 * `SignInHandoff`, mounted once at the root of each app.
 */
export interface HandoffState {
  readonly id: number;
  readonly stage: 'closing' | 'opening';
  /** Shown as "Hi, <name>" on the tag; null until known. */
  readonly name: string | null;
  /** The price-gun stamp across the tag, such as WELCOME BACK. */
  readonly stamp: string;
  /** The small print above the greeting: SIGNED IN, or for a guest, what they're doing instead. */
  readonly eyebrow: string;
  /** Under the tag while the app gets ready. */
  readonly waiting: string;
}

export interface HandoffOptions {
  readonly stamp: string;
  readonly name?: string | null;
  readonly eyebrow?: string;
  readonly waiting?: string;
}

let state: HandoffState | null = null;
let overlays = 0;
let resolveClosed: (() => void) | null = null;
const listeners = new Set<() => void>();

function set(next: HandoffState | null) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** A tag that never reports back (an overlay unmounted mid-way) can't hold sign-in up for longer. */
const closeTimeoutMs = 3000;

/**
 * Starts closing the screen into the tag. Resolves once the tag is closed and stamped, or at once
 * where there's no overlay to draw it (reduced motion, tests), so sign-in is never held up.
 */
export function closeIntoTag(options: HandoffOptions) {
  if (overlays === 0) return Promise.resolve();
  resolveClosed?.();
  set({
    id: (state?.id ?? 0) + 1,
    stage: 'closing',
    stamp: options.stamp,
    name: options.name ?? null,
    eyebrow: options.eyebrow ?? 'Signed in',
    waiting: options.waiting ?? 'Signing you in',
  });
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, closeTimeoutMs);
    resolveClosed = () => {
      clearTimeout(timeout);
      resolveClosed = null;
      resolve();
    };
  });
}

/** Names the person on the tag, once the sign-in has said who they are. */
export function setHandoffName(name: string | null | undefined) {
  if (state && name) set({ ...state, name });
}

/** Opens the tag onto whatever screen is now beneath it: the app after a sign-in. */
export function openFromTag() {
  if (state) set({ ...state, stage: 'opening' });
}

/** Opens the tag back onto the sign-in screen, for a sign-in that didn't go through. */
export const cancelHandoff = openFromTag;

/** The first word of a name, for the tag's greeting. */
export function firstNameOf(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const first = name.trim().split(/\s+/)[0];
  return first ? first : null;
}

// For the overlay.
export function markClosed() {
  resolveClosed?.();
}
export function endHandoff() {
  set(null);
}
export function registerHandoffOverlay() {
  overlays += 1;
  return () => {
    overlays -= 1;
  };
}
export function useHandoffState(): HandoffState | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
    () => state,
  );
}

/** Where the tag stands on a screen `width` × `height`: upright, centred, Worthy's proportions. */
export interface TagFrame {
  readonly cx: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function tagFrameFor(width: number, height: number): TagFrame {
  const tagWidth = Math.min(width * 0.44, 190);
  const tagHeight = tagWidth * 1.37;
  return { cx: width / 2, top: height / 2 - tagHeight / 2, width: tagWidth, height: tagHeight };
}

/**
 * The tag's outline as nine points (flattened x, y): pointed top, square shoulders, softly cut
 * foot. The screen's own rectangle is the same nine points, so one shape morphs into the other.
 */
export function tagPoints({ cx, top, width: w, height: h }: TagFrame): number[] {
  const half = w / 2;
  return [
    cx,
    top,
    cx + half,
    top + 0.321 * h,
    cx + half,
    top + 0.911 * h,
    cx + half - 0.018 * w,
    top + 0.979 * h,
    cx + half - 0.068 * w,
    top + h,
    cx - half + 0.068 * w,
    top + h,
    cx - half + 0.018 * w,
    top + 0.979 * h,
    cx - half,
    top + 0.911 * h,
    cx - half,
    top + 0.321 * h,
  ];
}

export function screenPoints(width: number, height: number): number[] {
  return [
    width / 2,
    0,
    width,
    0,
    width,
    height,
    width,
    height,
    width,
    height,
    0,
    height,
    0,
    height,
    0,
    height,
    0,
    0,
  ];
}

/** The outline part-way from `from` (at 0) to `to` (at 1), as SVG path data. */
export function morphPath(from: readonly number[], to: readonly number[], t: number): string {
  'worklet';
  let d = '';
  for (let i = 0; i < from.length; i += 2) {
    const x = (from[i] ?? 0) + ((to[i] ?? 0) - (from[i] ?? 0)) * t;
    const y = (from[i + 1] ?? 0) + ((to[i + 1] ?? 0) - (from[i + 1] ?? 0)) * t;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `${d}Z`;
}
