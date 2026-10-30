import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { meetupAreas, meetupSpots } from '../../types/meetup-spots';
import { withinPinBounds } from '../../types/meetup-spots';
import {
  directionsUrl,
  distanceMeters,
  frameAt,
  maximumZoom,
  project,
  settleCamera,
  tilesFor,
  unproject,
} from './meetup-map-geo';

describe('the meetup spots', () => {
  it('are the same list, with the same pins, as the server’s', () => {
    const migration = readFileSync(
      join(
        __dirname,
        '../../../../../Backend/supabase/migrations/20261030000000_chat_meetup_map.sql',
      ),
      'utf8',
    );
    const rows = [
      ...migration.matchAll(
        /\('([a-z0-9-]+)', '([^']+)', '([^']+)', '([a-z-]+)', ([\d.]+), ([\d.]+)\)/g,
      ),
    ].map(([, key, name, city, area, lat, lng]) => ({
      key,
      name,
      city,
      area,
      lat: Number(lat),
      lng: Number(lng),
    }));
    expect(rows).toEqual(meetupSpots.map((spot) => ({ ...spot })));
  });

  it('every spot is in one of the areas', () => {
    const areas = new Set(meetupAreas.map((area) => area.key));
    for (const spot of meetupSpots) expect(areas.has(spot.area)).toBe(true);
  });
});

describe('the projection', () => {
  it('goes from coordinates to map points and back', () => {
    for (const spot of meetupSpots) {
      const back = unproject(project(spot.lat, spot.lng));
      expect(back.lat).toBeCloseTo(spot.lat, 9);
      expect(back.lng).toBeCloseTo(spot.lng, 9);
    }
  });

  it('lines the street tiles up with the pins', () => {
    // SM City Cebu is in tile 3457/1930 at zoom 12 on every standard (Web Mercator) tile server.
    const smCityCebu = project(10.311111, 123.918056);
    const size = { width: 400, height: 300 };
    const camera = { center: smCityCebu, zoom: 12 };
    const tile = tilesFor(frameAt(camera, size), size).find(
      (each) => each.z === 12 && each.x === 3457 && each.y === 1930,
    );
    expect(tile).toBeDefined();
    // The pin sits in the middle of the view, which must fall inside that tile.
    expect(tile!.left).toBeLessThanOrEqual(200);
    expect(tile!.left + tile!.size).toBeGreaterThan(200);
    expect(tile!.top).toBeLessThanOrEqual(150);
    expect(tile!.top + tile!.size).toBeGreaterThan(150);
    expect(tile!.size).toBeCloseTo(256, 5);
  });

  it('covers the whole view with tiles, at any zoom', () => {
    const size = { width: 390, height: 260 };
    for (const zoom of [11, 13.4, 16.5, 18.5]) {
      const tiles = tilesFor(frameAt({ center: project(10.31, 123.9), zoom }, size), size);
      expect(Math.min(...tiles.map((tile) => tile.left))).toBeLessThanOrEqual(0);
      expect(Math.min(...tiles.map((tile) => tile.top))).toBeLessThanOrEqual(0);
      expect(Math.max(...tiles.map((tile) => tile.left + tile.size))).toBeGreaterThanOrEqual(390);
      expect(Math.max(...tiles.map((tile) => tile.top + tile.size))).toBeGreaterThanOrEqual(260);
    }
  });
});

describe('moving the map', () => {
  it('keeps the pin over the Philippines and the zoom in range', () => {
    const settled = settleCamera({ center: project(35.68, 139.69), zoom: 30 });
    const { lat, lng } = unproject(settled.center);
    expect(withinPinBounds(lat, lng)).toBe(true);
    expect(settled.zoom).toBe(maximumZoom);
  });

  it('measures how far the pin has moved', () => {
    const smCityCebu = { lat: 10.311111, lng: 123.918056 };
    const galleria = { lat: 10.304167, lng: 123.911111 };
    expect(distanceMeters(smCityCebu, galleria)).toBeGreaterThan(1000);
    expect(distanceMeters(smCityCebu, galleria)).toBeLessThan(1200);
  });
});

describe('directions', () => {
  const pin = { name: 'By the main entrance', lat: 10.311111, lng: 123.918056 };

  it('opens the exact pin in Apple Maps on an iPhone and Google Maps elsewhere', () => {
    expect(directionsUrl(pin, 'ios')).toBe(
      'https://maps.apple.com/?ll=10.311111,123.918056&q=By%20the%20main%20entrance',
    );
    expect(directionsUrl(pin, 'other')).toBe(
      'https://www.google.com/maps/search/?api=1&query=10.311111,123.918056',
    );
  });
});
