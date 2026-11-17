/**
 * Which part of a photo was inside the camera's frame. The preview fills the screen and is
 * cropped to do so (aspect fill), so the photo is bigger than what was on screen in one
 * direction; the frame's corners are then mapped from screen points into the photo's pixels.
 * A little room is left around the frame, so an item that touches the corners isn't cut.
 */

export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PhotoCrop {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

/** How much of the frame's size is added around it, on each side. */
export const frameMargin = 0.08;

export function cropToFrame(
  photo: { readonly width: number; readonly height: number },
  screen: { readonly width: number; readonly height: number },
  frame: ScreenRect,
  margin = frameMargin,
): PhotoCrop | null {
  if (photo.width <= 0 || photo.height <= 0 || screen.width <= 0 || screen.height <= 0) {
    return null;
  }
  if (frame.width <= 0 || frame.height <= 0) return null;

  // Aspect fill: the photo is scaled until it covers the screen, and centred.
  const scale = Math.max(screen.width / photo.width, screen.height / photo.height);
  const offsetX = (screen.width - photo.width * scale) / 2;
  const offsetY = (screen.height - photo.height * scale) / 2;

  const left = frame.x - frame.width * margin;
  const top = frame.y - frame.height * margin;
  const right = frame.x + frame.width * (1 + margin);
  const bottom = frame.y + frame.height * (1 + margin);

  const toPhotoX = (x: number) => clamp((x - offsetX) / scale, 0, photo.width);
  const toPhotoY = (y: number) => clamp((y - offsetY) / scale, 0, photo.height);

  const originX = Math.round(toPhotoX(left));
  const originY = Math.round(toPhotoY(top));
  const width = Math.round(toPhotoX(right)) - originX;
  const height = Math.round(toPhotoY(bottom)) - originY;
  return width > 0 && height > 0 ? { originX, originY, width, height } : null;
}

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}
