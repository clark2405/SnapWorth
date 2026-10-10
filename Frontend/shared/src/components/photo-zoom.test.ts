import {
  clampOffset,
  doubleTapZoom,
  maxZoom,
  offsetAround,
  pinchZoom,
  settledZoom,
} from './photo-zoom';

const width = 400;

/** Where a point `d` from the centre ends up on screen, for an offset and zoom. */
const project = (d: number, offset: number, zoom: number) => width / 2 + offset + zoom * d;

describe('photo zoom', () => {
  it('keeps the tapped spot under the finger when zooming in', () => {
    const tap = 300;
    const offset = offsetAround(tap, width, 0, 1, doubleTapZoom);
    expect(project(tap - width / 2, offset, doubleTapZoom)).toBeCloseTo(tap);
  });

  it('keeps the spot between the fingers still through a pinch on a zoomed photo', () => {
    const focus = 120;
    const startOffset = 40;
    const startZoom = 2;
    // The content under the fingers before the pinch carries on.
    const under = (focus - width / 2 - startOffset) / startZoom;
    const offset = offsetAround(focus, width, startOffset, startZoom, 3);
    expect(project(under, offset, 3)).toBeCloseTo(focus);
  });

  it('never lets a zoomed photo leave a gap at the screen edge', () => {
    expect(clampOffset(500, 2, width)).toBe(200);
    expect(clampOffset(-500, 2, width)).toBe(-200);
    expect(clampOffset(50, 2, width)).toBe(50);
    // At its full size, or smaller, it sits centred.
    expect(clampOffset(30, 1, width)).toBe(0);
    expect(clampOffset(30, 0.8, width)).toBe(0);
  });

  it('gives a little past the limits while pinching and settles inside them', () => {
    expect(pinchZoom(1, 0.5)).toBe(0.8);
    expect(pinchZoom(3, 2)).toBe(maxZoom);
    expect(settledZoom(0.8)).toBe(1);
    expect(settledZoom(2.2)).toBe(2.2);
    expect(settledZoom(9)).toBe(maxZoom);
  });
});
