import type { MeetupArea, MeetupSpot } from '../../types/meetup-spots';
import { meetupSpots } from '../../types/meetup-spots';

/**
 * The meetup map's drawing of Metro Manila: simplified outlines of the bay, the rivers, the main
 * roads and parks, on real coordinates. It is an illustration, not a survey (edges are smoothed
 * and small streets left out), but every pin sits where the place really is relative to the
 * rest, and Directions hands over to the phone's own maps app for the way there.
 */

type LatLng = readonly [lat: number, lng: number];

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A rectangle of the map, in map units (about 110 m each). */
export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const north = 14.7;
const west = 120.9;
const unitsPerDegree = 1000;
// East–west degrees are shorter than north–south ones this far from the equator.
const eastWestScale = Math.cos((14.6 * Math.PI) / 180);

export function project(lat: number, lng: number): Point {
  return { x: (lng - west) * unitsPerDegree * eastWestScale, y: (north - lat) * unitsPerDegree };
}

/** Everything the map draws, in map units. */
export const world: Frame = { x: 0, y: 0, width: project(0, 121.15).x, height: 220 };

const toPoints = (line: readonly LatLng[]) => line.map(([lat, lng]) => project(lat, lng));

// Manila Bay, from Navotas down past the Mall of Asia, closed off to the west.
const bay = toPoints([
  [14.75, 120.95],
  [14.7, 120.955],
  [14.66, 120.95],
  [14.63, 120.955],
  [14.61, 120.96],
  [14.598, 120.963],
  [14.59, 120.968],
  [14.583, 120.973],
  [14.575, 120.977],
  [14.56, 120.98],
  [14.548, 120.98],
  [14.538, 120.977],
  [14.528, 120.979],
  [14.515, 120.983],
  [14.45, 120.988],
  [14.45, 120.8],
  [14.75, 120.8],
]);

// The northern tip of Laguna de Bay, past Taguig.
const lake = toPoints([
  [14.45, 121.2],
  [14.45, 121.06],
  [14.51, 121.075],
  [14.525, 121.09],
  [14.535, 121.12],
  [14.54, 121.2],
]);

const pasigRiver = toPoints([
  [14.598, 120.963],
  [14.596, 120.975],
  [14.598, 120.985],
  [14.594, 120.995],
  [14.585, 121.003],
  [14.578, 121.015],
  [14.57, 121.028],
  [14.566, 121.043],
  [14.569, 121.058],
  [14.575, 121.072],
  [14.56, 121.085],
  [14.545, 121.098],
  [14.53, 121.1],
]);

const marikinaRiver = toPoints([
  [14.72, 121.106],
  [14.66, 121.098],
  [14.63, 121.088],
  [14.605, 121.085],
  [14.575, 121.072],
]);

export interface Road {
  readonly name: string;
  readonly points: readonly Point[];
  /** Where the road's name tag is pinned. */
  readonly label: Point;
  readonly major: boolean;
}

export const roads: readonly Road[] = [
  {
    name: 'EDSA',
    major: true,
    label: project(14.606, 121.057),
    points: toPoints([
      [14.537, 120.99],
      [14.538, 121.0],
      [14.541, 121.018],
      [14.549, 121.028],
      [14.556, 121.036],
      [14.567, 121.045],
      [14.581, 121.054],
      [14.59, 121.057],
      [14.605, 121.057],
      [14.619, 121.053],
      [14.635, 121.043],
      [14.652, 121.032],
      [14.657, 121.012],
      [14.66, 120.99],
    ]),
  },
  {
    name: 'C-5',
    major: true,
    label: project(14.595, 121.078),
    points: toPoints([
      [14.5, 121.04],
      [14.53, 121.05],
      [14.548, 121.058],
      [14.565, 121.067],
      [14.585, 121.075],
      [14.61, 121.079],
      [14.63, 121.075],
      [14.65, 121.073],
      [14.7, 121.07],
    ]),
  },
  {
    name: 'Commonwealth',
    major: false,
    label: project(14.672, 121.077),
    points: toPoints([
      [14.651, 121.049],
      [14.67, 121.075],
      [14.71, 121.095],
    ]),
  },
  {
    name: 'Quezon Ave',
    major: false,
    label: project(14.627, 121.018),
    points: toPoints([
      [14.6, 120.985],
      [14.63, 121.02],
      [14.651, 121.049],
    ]),
  },
  {
    name: 'Ortigas Ave',
    major: false,
    label: project(14.589, 121.09),
    points: toPoints([
      [14.59, 121.057],
      [14.588, 121.08],
      [14.586, 121.12],
    ]),
  },
  {
    name: 'Roxas Blvd',
    major: false,
    label: project(14.562, 120.986),
    points: toPoints([
      [14.592, 120.976],
      [14.575, 120.982],
      [14.555, 120.985],
      [14.535, 120.991],
      [14.5, 120.995],
    ]),
  },
];

export interface Park {
  readonly center: Point;
  readonly rx: number;
  readonly ry: number;
}

const park = (lat: number, lng: number, rx: number, ry: number): Park => ({
  center: project(lat, lng),
  rx,
  ry,
});

export const parks: readonly Park[] = [
  park(14.582, 120.98, 2.6, 1.6), // Rizal Park
  park(14.651, 121.049, 2.4, 2.4), // Quezon Memorial Circle
  park(14.655, 121.067, 6, 4.5), // UP Diliman
  park(14.557, 121.024, 1.4, 1), // Ayala Triangle
  park(14.54, 121.05, 3, 2), // Fort Bonifacio green
  park(14.6, 121.038, 1.8, 1.2), // Greenhills
];

export const placeLabels: readonly { readonly text: string; readonly at: Point }[] = [
  { text: 'MANILA', at: project(14.605, 120.99) },
  { text: 'PASAY', at: project(14.543, 120.996) },
  { text: 'MAKATI', at: project(14.561, 121.012) },
  { text: 'BGC', at: project(14.552, 121.064) },
  { text: 'ORTIGAS', at: project(14.594, 121.066) },
  { text: 'QUEZON CITY', at: project(14.642, 121.04) },
  { text: 'MANILA BAY', at: project(14.57, 120.94) },
];

export const water = { bay, lake } as const;
export const rivers = [pasigRiver, marikinaRiver] as const;

export const pathOf = (points: readonly Point[], closed = false) =>
  points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ') + (closed ? ' Z' : '');

/** Whether a point is inside a closed outline (even-odd rule). */
export function inside(point: Point, outline: readonly Point[]): boolean {
  let within = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const a = outline[i]!;
    const b = outline[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      within = !within;
    }
  }
  return within;
}

/**
 * The part of the map to show: around `points`, padded, at least `minimumWidth` wide, shaped to
 * the map's `aspect` (width over height), and kept inside the drawing.
 */
export function frameAround(
  points: readonly Point[],
  aspect: number,
  { padding = 8, minimumWidth = 24 } = {},
): Frame {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  let left = Math.min(...xs) - padding;
  let right = Math.max(...xs) + padding;
  let top = Math.min(...ys) - padding;
  const bottom = Math.max(...ys) + padding;
  const widen = (from: number, to: number, size: number) => {
    const middle = (from + to) / 2;
    return [middle - size / 2, middle + size / 2] as const;
  };
  if (right - left < minimumWidth) [left, right] = widen(left, right, minimumWidth);
  if ((right - left) / (bottom - top) < aspect) {
    [left, right] = widen(left, right, (bottom - top) * aspect);
  } else {
    top = (top + bottom) / 2 - (right - left) / aspect / 2;
  }
  const width = Math.min(right - left, world.width);
  const height = width / aspect;
  const x = Math.min(Math.max(left, world.x), world.x + world.width - width);
  const y = Math.min(Math.max(top, world.y), world.y + world.height - height);
  return { x, y, width, height };
}

export const spotsIn = (area: MeetupArea | 'all'): readonly MeetupSpot[] =>
  area === 'all' ? meetupSpots : meetupSpots.filter((spot) => spot.area === area);

export function frameForArea(area: MeetupArea | 'all', aspect: number): Frame {
  const points = spotsIn(area).map((spot) => project(spot.lat, spot.lng));
  return area === 'all'
    ? frameAround(points, aspect, { padding: 10 })
    : frameAround(points, aspect, { padding: 9, minimumWidth: 34 });
}

/** Where a map point lands on a map drawn `size` pixels across showing `frame`. */
export function toScreen(point: Point, frame: Frame, size: { width: number; height: number }) {
  return {
    left: ((point.x - frame.x) / frame.width) * size.width,
    top: ((point.y - frame.y) / frame.height) * size.height,
  };
}

/**
 * A link that opens the place in the phone's own maps app for directions: Apple Maps on iPhone,
 * Google Maps everywhere else. Searches by name and city, which those apps place precisely.
 */
export function directionsUrl(
  place: {
    readonly name: string;
    readonly city?: string;
    readonly lat?: number;
    readonly lng?: number;
  },
  platform: 'ios' | 'other',
): string {
  const query = encodeURIComponent(place.city ? `${place.name}, ${place.city}` : place.name);
  if (platform === 'ios') {
    const near =
      place.lat !== undefined && place.lng !== undefined ? `&sll=${place.lat},${place.lng}` : '';
    return `https://maps.apple.com/?q=${query}${near}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
