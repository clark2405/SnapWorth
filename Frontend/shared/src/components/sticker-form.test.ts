import { tokens } from '../design/tokens';
import {
  blendForms,
  cubicBezier,
  formAt,
  mixInk,
  outlinePath,
  outlinePoints,
  printStrength,
  stickerForm,
} from './sticker-form';

const ink = tokens.holo.ink;
const light = tokens.holo.sheen;
/** The colour halfway between two six-digit hex colours, worked out by hand. */
const halfway = (a: string, b: string) =>
  `#${[1, 3, 5]
    .map((i) =>
      Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

const at = (degrees: number) => Math.round((degrees / 360) * outlinePoints) % outlinePoints;

it('draws every shape with the same number of points, so any can turn into any other', () => {
  for (const shape of ['tag', 'scallop', 'coin'] as const) {
    expect(stickerForm(shape, 120, ink).radii).toHaveLength(outlinePoints);
  }
});

it('traces each shape where it really is', () => {
  const coin = stickerForm('coin', 100, ink);
  expect(new Set(coin.radii)).toEqual(new Set([50]));
  // A tag 150 wide: its far end is half its width out, its nose's tip too.
  const tag = stickerForm('tag', 150, ink);
  expect(tag.radii[at(0)]).toBeCloseTo(75, 0);
  expect(tag.radii[at(180)]).toBeCloseTo(75, 0);
  expect(tag.radii[at(90)]).toBeCloseTo(45, 0);
  // A scallop reaches its full size at a bump and dips between bumps.
  const scallop = stickerForm('scallop', 120, ink);
  expect(scallop.radii[0]).toBeCloseTo(60, 1);
  expect(scallop.radii[4]).toBeLessThan(55);
});

it('blends outline, colour and print', () => {
  const coin = stickerForm('coin', 100, ink);
  const tag = stickerForm('tag', 150, light);
  const half = blendForms(coin, tag, 0.5);
  expect(half.radii[at(0)]).toBeCloseTo((50 + 75) / 2, 0);
  expect(half.ink.toLowerCase()).toBe(halfway(ink, light).toLowerCase());
  expect(blendForms(coin, tag, 1).radii).toEqual(tag.radii);
  expect(outlinePath(coin.radii, 0, 0)).toMatch(/^M50\.0 0\.0 L/);
});

it('never shows two shapes’ print at once', () => {
  // The leaving print is gone by halfway; the arriving print starts after it.
  expect(printStrength(1, 0, 0.5)).toBe(0);
  expect(printStrength(0, 1, 0.5)).toBe(0);
  expect(printStrength(0, 1, 0.75)).toBeCloseTo(0.5);
  const coin = stickerForm('coin', 100, ink);
  const tag = stickerForm('tag', 150, ink);
  expect(formAt(tag, coin, 0.5)).toMatchObject({ tag: 0, coin: 0 });
});

it('mixes only colours it can read, and switches others halfway', () => {
  expect(mixInk(ink, light, 0.5).toLowerCase()).toBe(halfway(ink, light).toLowerCase());
  expect(mixInk(ink, light, 0).toLowerCase()).toBe(ink.toLowerCase());
  expect(mixInk('red', 'blue', 0.4)).toBe('red');
  expect(mixInk('red', 'blue', 0.6)).toBe('blue');
});

it('follows a timing curve from start to end', () => {
  const linear = cubicBezier(0.25, 0.25, 0.75, 0.75);
  expect(linear(0.3)).toBeCloseTo(0.3, 2);
  const ease = cubicBezier(0.4, 0, 0.2, 1);
  expect(ease(0)).toBe(0);
  expect(ease(1)).toBe(1);
  expect(ease(0.5)).toBeGreaterThan(0.5);
});
