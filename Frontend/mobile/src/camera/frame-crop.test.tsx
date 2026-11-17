import { cropToFrame } from './frame-crop';

const screen = { width: 400, height: 800 };

it('maps the frame into a photo that is wider than the screen', () => {
  // A 3:4 photo (1500 × 2000) covering a 1:2 screen: scaled by 0.4 to 600 × 800, so 100pt of
  // the photo hangs off each side.
  const crop = cropToFrame(
    { width: 1500, height: 2000 },
    screen,
    { x: 100, y: 300, width: 200, height: 200 },
    0,
  );
  expect(crop).toEqual({ originX: 500, originY: 750, width: 500, height: 500 });
});

it('leaves room around the frame, and never runs past the photo', () => {
  const crop = cropToFrame(
    { width: 1500, height: 2000 },
    screen,
    { x: 0, y: 0, width: 400, height: 800 },
    0.1,
  );
  expect(crop).toEqual({ originX: 150, originY: 0, width: 1200, height: 2000 });
});

it('gives up rather than guess when it has nothing to go on', () => {
  expect(cropToFrame({ width: 0, height: 0 }, screen, { x: 0, y: 0, width: 10, height: 10 })).toBe(
    null,
  );
  expect(
    cropToFrame({ width: 100, height: 100 }, screen, { x: 0, y: 0, width: 0, height: 10 }),
  ).toBe(null);
});
