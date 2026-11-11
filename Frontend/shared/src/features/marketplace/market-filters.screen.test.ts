import { matchesPriceAndPlace, type MarketFilters } from './MarketFilters';

const listing = {
  id: 'x',
  title: 'Camera',
  askingPrice: 3000,
  photo: 1,
  photoLabel: 'Camera',
  verdict: null,
  verdictShare: null,
  area: 'cebu-city',
};
const filters = (change: Partial<MarketFilters>) => ({
  minPrice: null,
  maxPrice: null,
  area: 'anywhere',
  radiusKm: '10' as const,
  ...change,
});

describe('matchesPriceAndPlace', () => {
  it('keeps what is within the radius of the viewer', () => {
    expect(matchesPriceAndPlace({ ...listing, distanceKm: 4 }, filters({ area: 'near-me' }))).toBe(
      true,
    );
    expect(matchesPriceAndPlace({ ...listing, distanceKm: 11 }, filters({ area: 'near-me' }))).toBe(
      false,
    );
    expect(
      matchesPriceAndPlace(
        { ...listing, distanceKm: 11 },
        filters({ area: 'near-me', radiusKm: '25' }),
      ),
    ).toBe(true);
  });

  it('cannot narrow by distance while the viewer’s position is unknown', () => {
    expect(
      matchesPriceAndPlace({ ...listing, distanceKm: null }, filters({ area: 'near-me' })),
    ).toBe(true);
  });

  it('still applies price and named areas', () => {
    expect(
      matchesPriceAndPlace({ ...listing, distanceKm: null }, filters({ maxPrice: 2000 })),
    ).toBe(false);
    expect(
      matchesPriceAndPlace({ ...listing, distanceKm: null }, filters({ area: 'mandaue' })),
    ).toBe(false);
    expect(
      matchesPriceAndPlace({ ...listing, distanceKm: null }, filters({ area: 'cebu-city' })),
    ).toBe(true);
  });
});
