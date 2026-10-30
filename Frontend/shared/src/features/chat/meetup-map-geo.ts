import { pinBounds } from '../../types/meetup-spots';

export { pinBounds, withinPinBounds } from '../../types/meetup-spots';

/**
 * The meetup map's geometry. The map itself is street tiles from an online map provider (see
 * `map-tiles.ts`); this only works out which tiles to show and where, and where a pin is. It is
 * all in Web Mercator, the projection those tiles use, measured in map units: pixels of the world
 * at zoom 10, counted from just north-west of Cebu City so the numbers stay small.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A rectangle of the map, in map units. */
export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The zoom whose world pixels are map units. */
export const referenceZoom = 10;
const tileSize = 256;
const worldSize = tileSize * 2 ** referenceZoom;

const mercatorX = (lng: number) => ((lng + 180) / 360) * worldSize;
const mercatorY = (lat: number) => {
  const sin = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize;
};

/** Where map units are counted from: just north-west of Cebu City. */
const origin = { x: mercatorX(123.85), y: mercatorY(10.35) };

export function project(lat: number, lng: number): Point {
  return { x: mercatorX(lng) - origin.x, y: mercatorY(lat) - origin.y };
}

/** The coordinates at a map point. */
export function unproject(point: Point): { readonly lat: number; readonly lng: number } {
  const lng = ((point.x + origin.x) / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * (point.y + origin.y)) / worldSize;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

/** Metres between two places (haversine). */
export function distanceMeters(
  a: { readonly lat: number; readonly lng: number },
  b: { readonly lat: number; readonly lng: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** A view of the map: the point in the middle and how far in it is zoomed (fractional). */
export interface Camera {
  readonly center: Point;
  readonly zoom: number;
}

export const minimumZoom = 11;
export const maximumZoom = 18.5;

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** Keeps a camera inside the zoom range and over the Philippines. */
export function settleCamera(camera: Camera): Camera {
  const { lat, lng } = unproject(camera.center);
  return {
    zoom: clamp(camera.zoom, minimumZoom, maximumZoom),
    center: project(
      clamp(lat, pinBounds.south, pinBounds.north),
      clamp(lng, pinBounds.west, pinBounds.east),
    ),
  };
}

/** Screen pixels per map unit at a zoom. */
export const pixelsPerUnit = (zoom: number) => 2 ** (zoom - referenceZoom);

/** The part of the map a camera shows on a view `size` pixels across. */
export function frameAt(
  camera: Camera,
  size: { readonly width: number; readonly height: number },
): Frame {
  const scale = pixelsPerUnit(camera.zoom);
  const width = size.width / scale;
  const height = size.height / scale;
  return { x: camera.center.x - width / 2, y: camera.center.y - height / 2, width, height };
}

export interface Tile {
  readonly z: number;
  readonly x: number;
  readonly y: number;
  /** Where it sits on the view, in pixels. */
  readonly left: number;
  readonly top: number;
  readonly size: number;
}

/** The street-map tiles that cover `frame` on a view `size` pixels across. */
export function tilesFor(
  frame: Frame,
  size: { readonly width: number; readonly height: number },
): readonly Tile[] {
  if (size.width <= 0 || frame.width <= 0) return [];
  const zoom = referenceZoom + Math.log2(size.width / frame.width);
  const z = Math.min(19, Math.max(0, Math.round(zoom)));
  const unitsPerTile = tileSize / 2 ** (z - referenceZoom);
  const scale = size.width / frame.width;
  const count = 2 ** z;
  const first = {
    x: Math.floor((frame.x + origin.x) / unitsPerTile),
    y: Math.floor((frame.y + origin.y) / unitsPerTile),
  };
  const last = {
    x: Math.floor((frame.x + frame.width + origin.x) / unitsPerTile),
    y: Math.floor((frame.y + frame.height + origin.y) / unitsPerTile),
  };
  const tiles: Tile[] = [];
  for (let y = Math.max(0, first.y); y <= Math.min(count - 1, last.y); y += 1) {
    for (let x = first.x; x <= last.x; x += 1) {
      tiles.push({
        z,
        x: ((x % count) + count) % count,
        y,
        left: (x * unitsPerTile - origin.x - frame.x) * scale,
        top: (y * unitsPerTile - origin.y - frame.y) * scale,
        size: unitsPerTile * scale,
      });
    }
  }
  return tiles;
}

/**
 * A link that opens the pin in the phone's own maps app for directions: Apple Maps on iPhone,
 * Google Maps everywhere else. It goes by the pin's coordinates, so it leads to exactly where the
 * two people agreed, whatever the place was called.
 */
export function directionsUrl(
  place: { readonly name: string; readonly lat: number; readonly lng: number },
  platform: 'ios' | 'other',
): string {
  const at = `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
  if (platform === 'ios') {
    return `https://maps.apple.com/?ll=${at}&q=${encodeURIComponent(place.name)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${at}`;
}
