/**
 * The geometry of zooming a full-screen photo. Offsets are the photo's translation from the
 * centre of the screen, applied before its scale, so a point `d` from the centre lands at
 * `offset + zoom * d`. Each function is a worklet, so the gestures run it on the UI thread.
 */

/** The closest a pinch can zoom out (it springs back to 1) and the furthest it can zoom in. */
export const minPinchZoom = 0.8;
export const maxZoom = 4;
/** How far a double tap zooms in. */
export const doubleTapZoom = 2.5;

/** Keeps a zoomed photo's edges from pulling away from the screen's edges. */
export function clampOffset(offset: number, zoom: number, extent: number): number {
  'worklet';
  const room = Math.max(0, (extent * (zoom - 1)) / 2);
  return Math.min(room, Math.max(-room, offset));
}

/**
 * Where the photo moves when zooming from `fromZoom` to `toZoom` around `focus` (a point from
 * the screen's top-left edge), so whatever is under the fingers or the tap stays under them.
 */
export function offsetAround(
  focus: number,
  extent: number,
  fromOffset: number,
  fromZoom: number,
  toZoom: number,
): number {
  'worklet';
  const fromCentre = focus - extent / 2;
  return fromCentre - (toZoom / fromZoom) * (fromCentre - fromOffset);
}

/** The zoom a pinch shows while the fingers are down: a little give past either limit. */
export function pinchZoom(startZoom: number, pinchScale: number): number {
  'worklet';
  return Math.min(maxZoom, Math.max(minPinchZoom, startZoom * pinchScale));
}

/** The zoom a photo settles at once the fingers lift. */
export function settledZoom(zoom: number): number {
  'worklet';
  return Math.min(maxZoom, Math.max(1, zoom));
}
