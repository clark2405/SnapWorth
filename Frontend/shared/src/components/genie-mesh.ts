/**
 * The genie effect, as a mesh: a picture of a panel cut into a grid of rows, each of which is
 * pulled toward a target by its own amount, so the panel bends into a funnel and pours down
 * into the target, as a macOS window does into the Dock. A transform can only tilt or squash the
 * whole panel; here every row gets its own width and its own shift.
 *
 * Progress runs from 0 (the panel open, flat, where it belongs) to 1 (gone into the target).
 * The first part of it bends the panel into the funnel; the rest slides it down the funnel.
 */

export interface GenieGeometry {
  /** The open panel, in the coordinates the mesh is drawn in. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The centre of what the panel pours into, below the panel. */
  readonly targetX: number;
  readonly targetY: number;
  /** How wide the funnel's spout is where it meets the target. */
  readonly targetWidth: number;
}

export interface MeshPoint {
  readonly x: number;
  readonly y: number;
}

/** Rows are what bend, so there are many; columns only keep the picture from shearing. */
export const genieRows = 48;
export const genieColumns = 6;

/** The panel's picture, cut along the same grid: where each mesh point samples it. */
export function genieTextures(width: number, height: number): MeshPoint[] {
  const points: MeshPoint[] = [];
  for (let row = 0; row <= genieRows; row++) {
    for (let column = 0; column <= genieColumns; column++) {
      points.push({ x: (column / genieColumns) * width, y: (row / genieRows) * height });
    }
  }
  return points;
}

/** Two triangles per cell of the grid. */
export function genieIndices(): number[] {
  const indices: number[] = [];
  const across = genieColumns + 1;
  for (let row = 0; row < genieRows; row++) {
    for (let column = 0; column < genieColumns; column++) {
      const topLeft = row * across + column;
      const bottomLeft = topLeft + across;
      indices.push(topLeft, topLeft + 1, bottomLeft, topLeft + 1, bottomLeft + 1, bottomLeft);
    }
  }
  return indices;
}

/** Where each point of the grid is drawn at `progress`. Runs on the UI thread. */
export function geniePoints(geometry: GenieGeometry, progress: number): MeshPoint[] {
  'worklet';
  const { x, y, width, height, targetX, targetY, targetWidth } = geometry;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const ease = (value: number) => value * value * (3 - 2 * value);
  const p = clamp(progress);
  // The funnel forms over the first 45%, and the panel starts down it at 20%: overlapping, so
  // the motion never stops between the two.
  const bend = ease(clamp(p / 0.45));
  const slideRaw = clamp((p - 0.2) / 0.8);
  const slide = slideRaw * slideRaw;
  const drop = targetY - y;
  const spoutLeft = targetX - targetWidth / 2;
  const spoutRight = targetX + targetWidth / 2;

  const points: MeshPoint[] = [];
  for (let row = 0; row <= genieRows; row++) {
    // Each row slides down by the same distance, and stops once it reaches the target.
    const restY = y + (row / genieRows) * height;
    const rowY = Math.min(targetY, restY + slide * drop);
    // How far down the funnel the row is, on an S-curve: the funnel's sides leave the panel's
    // edges gently, sweep in, and meet the spout gently.
    const along = drop > 0 ? clamp((rowY - y) / drop) : 1;
    const pull = bend * (0.5 - 0.5 * Math.cos(Math.PI * along));
    const left = x + (spoutLeft - x) * pull;
    const right = x + width + (spoutRight - (x + width)) * pull;
    for (let column = 0; column <= genieColumns; column++) {
      points.push({ x: left + (right - left) * (column / genieColumns), y: rowY });
    }
  }
  return points;
}
