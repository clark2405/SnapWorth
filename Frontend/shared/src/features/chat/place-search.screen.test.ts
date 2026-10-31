import { matchingSpots, placesFrom } from './place-search';

it('matches the suggested meetup spots as you type', () => {
  expect(matchingSpots('ayala').map((place) => place.spotKey)).toEqual([
    'ayala-center-cebu',
    'ayala-central-bloc',
  ]);
  expect(matchingSpots('sm seaside')[0]?.name).toBe('SM Seaside City Cebu');
  expect(matchingSpots('   ')).toEqual([]);
});

it('reads a search provider’s results, keeping only places in the Philippines', () => {
  const places = placesFrom([
    {
      name: 'JY Square',
      display_name: 'JY Square, Salinas Drive, Lahug, Cebu City, Central Visayas, Philippines',
      lat: '10.3302827',
      lon: '123.8986009',
    },
    // The same place again, as a building and its grounds.
    {
      name: 'JY Square',
      display_name: 'JY Square, Salinas Drive, Lahug, Cebu City, Central Visayas, Philippines',
      lat: '10.3303',
      lon: '123.8987',
    },
    {
      name: 'Somewhere far',
      display_name: 'Somewhere far, Tokyo, Japan',
      lat: '35.6',
      lon: '139.7',
    },
    { name: 'Broken', lat: 'not a number', lon: '123.9' },
  ]);

  expect(places).toEqual([
    {
      name: 'JY Square',
      detail: 'Salinas Drive, Lahug',
      lat: 10.3302827,
      lng: 123.8986009,
    },
  ]);
  expect(placesFrom({ error: 'nope' })).toEqual([]);
});
