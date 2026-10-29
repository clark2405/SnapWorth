import type { StickerShape } from './BackdropPrint';

/**
 * A backdrop sticker as something that can turn into any other: its outline as the distance
 * from its centre at evenly spaced angles, the same count for every shape, so one shape blends
 * into the next point by point (a scallop puffs into a coin, a coin stretches into a tag) instead
 * of one fading out as another fades in. Its colour blends the same way. The small print on it
 * (a tag's eyelet, a coin's ring and ₱) belongs to one shape, so it fades with `tag` and `coin`.
 *
 * Every function here is a worklet, so the apps blend on the UI thread and the web in a frame
 * loop, from the same numbers.
 */
export interface StickerForm {
  readonly radii: readonly number[];
  readonly ink: string;
  /** How strongly the tag's eyelet shows, and where it sits. */
  readonly tag: number;
  readonly eyeletX: number;
  readonly eyeletR: number;
  /** How strongly the coin's ring and ₱ show, and the coin's size. */
  readonly coin: number;
  readonly coinSize: number;
}

/** Points around the outline: 8 to each of a scallop's 14 bumps, so its dips land on a point. */
export const outlinePoints = 112;
const scallopBumps = 14;
/** Room every sticker's drawing gets, centred: wide enough for the largest at full size. */
export const stickerCanvas = 190;

/** How far a ray from the centre at `angle` travels before leaving the convex `polygon`. */
function polygonReach(polygon: readonly (readonly [number, number])[], angle: number) {
  'worklet';
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let reach = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i] ?? [0, 0];
    const [bx, by] = polygon[(i + 1) % polygon.length] ?? [0, 0];
    const ex = bx - ax;
    const ey = by - ay;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / denominator;
    const u = (ax * dy - ay * dx) / denominator;
    if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) reach = Math.max(reach, t);
  }
  return reach;
}

/** A tag `w` by `h` around its centre, nose to the left, its far corners rounded. */
function tagPolygon(w: number, h: number) {
  'worklet';
  const nose = w * 0.2;
  const r = h * 0.1;
  const left = -w / 2;
  const right = w / 2;
  const top = -h / 2;
  const bottom = h / 2;
  const points: [number, number][] = [[left + nose, top]];
  // The rounded corners, a few points each.
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    points.push([right - r + Math.cos(a) * r, top + r + Math.sin(a) * r]);
  }
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    points.push([right - r + Math.cos(a) * r, bottom - r + Math.sin(a) * r]);
  }
  points.push([left + nose, bottom], [left, 0]);
  return points;
}

/** The scallop's edge: the outermost of its bumps along each ray. */
function scallopReach(outer: number, angle: number) {
  'worklet';
  const step = Math.sin(Math.PI / scallopBumps);
  const ring = outer / (1 + step);
  const bump = ring * step;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let reach = ring;
  for (let i = 0; i < scallopBumps; i++) {
    const a = (i / scallopBumps) * Math.PI * 2;
    const cx = Math.cos(a) * ring;
    const cy = Math.sin(a) * ring;
    const along = dx * cx + dy * cy;
    const across = cx * cx + cy * cy - along * along;
    const room = bump * bump - across;
    if (room >= 0) reach = Math.max(reach, along + Math.sqrt(room));
  }
  return reach;
}

/** A sticker's form at rest, as drawn in a place. */
export function stickerForm(shape: StickerShape, size: number, ink: string): StickerForm {
  'worklet';
  const h = shape === 'tag' ? Math.round(size * 0.6) : size;
  const polygon = shape === 'tag' ? tagPolygon(size, h) : null;
  const radii: number[] = [];
  for (let i = 0; i < outlinePoints; i++) {
    const angle = (i / outlinePoints) * Math.PI * 2;
    radii.push(
      polygon
        ? polygonReach(polygon, angle)
        : shape === 'scallop'
          ? scallopReach(size / 2, angle)
          : size / 2,
    );
  }
  return {
    radii,
    ink,
    tag: shape === 'tag' ? 1 : 0,
    eyeletX: -size / 2 + size * 0.17,
    eyeletR: h * 0.09,
    coin: shape === 'coin' ? 1 : 0,
    coinSize: size,
  };
}

function channel(hex: string, at: number) {
  'worklet';
  return parseInt(hex.slice(at, at + 2), 16);
}

/** `a` blended toward `b`. Colours that aren't six-digit hex switch over halfway. */
export function mixInk(a: string, b: string, t: number): string {
  'worklet';
  if (a === b) return a;
  const hex = /^#[0-9a-f]{6}$/i;
  if (!hex.test(a) || !hex.test(b)) return t < 0.5 ? a : b;
  let out = '#';
  for (const at of [1, 3, 5]) {
    const value = Math.round(channel(a, at) + (channel(b, at) - channel(a, at)) * t);
    out += value.toString(16).padStart(2, '0');
  }
  return out;
}

/** The form `t` of the way from `a` to `b`. */
export function blendForms(a: StickerForm, b: StickerForm, t: number): StickerForm {
  'worklet';
  const mix = (x: number, y: number) => x + (y - x) * t;
  const radii: number[] = [];
  for (let i = 0; i < outlinePoints; i++) radii.push(mix(a.radii[i] ?? 0, b.radii[i] ?? 0));
  return {
    radii,
    ink: mixInk(a.ink, b.ink, t),
    tag: mix(a.tag, b.tag),
    // Details keep the geometry of whichever shape they belong to.
    eyeletX: b.tag > 0 ? b.eyeletX : a.eyeletX,
    eyeletR: b.tag > 0 ? b.eyeletR : a.eyeletR,
    coin: mix(a.coin, b.coin),
    coinSize: b.coin > 0 ? b.coinSize : a.coinSize,
  };
}

/** The outline as path data, around (`cx`, `cy`). */
export function outlinePath(radii: readonly number[], cx: number, cy: number): string {
  'worklet';
  let d = '';
  for (let i = 0; i < radii.length; i++) {
    const angle = (i / radii.length) * Math.PI * 2;
    const r = radii[i] ?? 0;
    d += `${i === 0 ? 'M' : 'L'}${(cx + Math.cos(angle) * r).toFixed(1)} ${(cy + Math.sin(angle) * r).toFixed(1)} `;
  }
  return `${d}Z`;
}

/**
 * How strongly a shape's small print shows `t` of the way through a change: print that's going
 * leaves in the first half, print that's coming arrives in the second.
 */
export function printStrength(from: number, to: number, t: number): number {
  'worklet';
  const k = to > from ? Math.max(0, t * 2 - 1) : Math.min(1, t * 2);
  return from + (to - from) * k;
}

/**
 * The form on screen `t` of the way through a change: the outline and colour blended, the print
 * at the strength `printStrength` gives it. A change that starts mid-way starts from this.
 */
export function formAt(a: StickerForm, b: StickerForm, t: number): StickerForm {
  'worklet';
  return {
    ...blendForms(a, b, t),
    tag: printStrength(a.tag, b.tag, t),
    coin: printStrength(a.coin, b.coin, t),
  };
}

/** A CSS `cubic-bezier` timing curve as a function, for a change drawn frame by frame. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  const slope = (a: number, b: number, s: number) =>
    3 * a * (1 - s) * (1 - s) + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s * s;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Find where the curve reaches `x`, then read its height there.
    let s = x;
    for (let i = 0; i < 6; i++) {
      const d = slope(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      s -= (at(x1, x2, s) - x) / d;
    }
    s = Math.min(1, Math.max(0, s));
    return at(y1, y2, s);
  };
}
