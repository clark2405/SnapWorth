import {
  genieColumns,
  genieIndices,
  geniePoints,
  genieRows,
  genieTextures,
  type GenieGeometry,
} from './genie-mesh';

const panel: GenieGeometry = {
  x: 16,
  y: 200,
  width: 360,
  height: 420,
  targetX: 348,
  targetY: 680,
  targetWidth: 22,
};
const across = genieColumns + 1;
const rowOf = (points: readonly { x: number; y: number }[], row: number) =>
  points.slice(row * across, (row + 1) * across);

it('lies flat over the open panel, matching its picture', () => {
  const points = geniePoints(panel, 0);
  const textures = genieTextures(panel.width, panel.height);
  expect(points).toHaveLength(across * (genieRows + 1));
  points.forEach((point, index) => {
    expect(point.x).toBeCloseTo(panel.x + textures[index]!.x);
    expect(point.y).toBeCloseTo(panel.y + textures[index]!.y);
  });
});

it('ends poured into the target, inside its spout', () => {
  for (const point of geniePoints(panel, 1)) {
    expect(point.y).toBeCloseTo(panel.targetY);
    expect(point.x).toBeGreaterThanOrEqual(panel.targetX - panel.targetWidth / 2 - 0.001);
    expect(point.x).toBeLessThanOrEqual(panel.targetX + panel.targetWidth / 2 + 0.001);
  }
});

it('bends each row by its own amount: a funnel, narrowing toward the target', () => {
  const points = geniePoints(panel, 0.45);
  const widths = Array.from({ length: genieRows + 1 }, (_, row) => {
    const cells = rowOf(points, row);
    return cells[cells.length - 1]!.x - cells[0]!.x;
  });
  // Not one squashed rectangle: rows lower down are narrower than rows above them.
  for (let row = 1; row <= genieRows; row++) {
    expect(widths[row]!).toBeLessThanOrEqual(widths[row - 1]! + 0.001);
  }
  expect(widths[0]!).toBeGreaterThan(widths[genieRows]! * 2);
  // And the narrow end leans toward the target, not the middle of the panel.
  const bottom = rowOf(points, genieRows);
  const middle = (bottom[0]!.x + bottom[bottom.length - 1]!.x) / 2;
  expect(Math.abs(middle - panel.targetX)).toBeLessThan(
    Math.abs(panel.x + panel.width / 2 - panel.targetX),
  );
});

it('covers the grid with two triangles a cell', () => {
  const indices = genieIndices();
  expect(indices).toHaveLength(genieRows * genieColumns * 6);
  expect(Math.max(...indices)).toBe(across * (genieRows + 1) - 1);
});
