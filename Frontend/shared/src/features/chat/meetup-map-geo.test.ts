import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { meetupAreas, meetupSpots } from '../../types/meetup-spots';
import {
  directionsUrl,
  frameForArea,
  inside,
  project,
  spotsIn,
  water,
  world,
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

  it('all sit on land, inside the drawing', () => {
    for (const spot of meetupSpots) {
      const point = project(spot.lat, spot.lng);
      expect(inside(point, water.bay)).toBe(false);
      expect(inside(point, water.lake)).toBe(false);
      expect(point.x).toBeGreaterThan(world.x);
      expect(point.x).toBeLessThan(world.x + world.width);
      expect(point.y).toBeGreaterThan(world.y);
      expect(point.y).toBeLessThan(world.y + world.height);
    }
  });

  it('every area has spots, and every spot an area', () => {
    for (const area of meetupAreas) expect(spotsIn(area.key).length).toBeGreaterThan(0);
    const areas = new Set(meetupAreas.map((area) => area.key));
    for (const spot of meetupSpots) expect(areas.has(spot.area)).toBe(true);
  });
});

describe('zooming to an area', () => {
  it.each([...meetupAreas.map((area) => area.key), 'all' as const])(
    '%s shows all its spots, in the map’s shape',
    (area) => {
      const aspect = 1.45;
      const frame = frameForArea(area, aspect);
      expect(frame.width / frame.height).toBeCloseTo(aspect, 5);
      for (const spot of spotsIn(area)) {
        const { x, y } = project(spot.lat, spot.lng);
        expect(x).toBeGreaterThan(frame.x);
        expect(x).toBeLessThan(frame.x + frame.width);
        expect(y).toBeGreaterThan(frame.y);
        expect(y).toBeLessThan(frame.y + frame.height);
      }
    },
  );
});

describe('directions', () => {
  const megamall = { name: 'SM Megamall', city: 'Mandaluyong', lat: 14.5849, lng: 121.0566 };

  it('opens Apple Maps on an iPhone and Google Maps elsewhere, searching by name and city', () => {
    expect(directionsUrl(megamall, 'ios')).toBe(
      'https://maps.apple.com/?q=SM%20Megamall%2C%20Mandaluyong&sll=14.5849,121.0566',
    );
    expect(directionsUrl(megamall, 'other')).toBe(
      'https://www.google.com/maps/search/?api=1&query=SM%20Megamall%2C%20Mandaluyong',
    );
  });
});
