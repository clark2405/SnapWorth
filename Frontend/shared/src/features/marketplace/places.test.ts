import { distanceKm, listingCoordinates, marketAreaCentres } from './places';

describe('distanceKm', () => {
  it('is zero between a point and itself', () => {
    expect(distanceKm(marketAreaCentres['cebu-city'], marketAreaCentres['cebu-city'])).toBe(0);
  });

  it('measures the short hop between neighbouring cities', () => {
    const km = distanceKm(marketAreaCentres['cebu-city'], marketAreaCentres.mandaue);
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(5);
  });

  it('measures the long way from Cebu to Manila', () => {
    const km = distanceKm(marketAreaCentres['cebu-city'], marketAreaCentres['metro-manila']);
    expect(km).toBeGreaterThan(550);
    expect(km).toBeLessThan(600);
  });
});

describe('listingCoordinates', () => {
  it('places a listing with no stored coordinates at its area’s centre', () => {
    expect(listingCoordinates({ area: 'mandaue', lat: null, lng: null })).toEqual(
      marketAreaCentres.mandaue,
    );
  });

  it('uses the stored coarse coordinates when there are some', () => {
    expect(listingCoordinates({ area: 'mandaue', lat: 10.33, lng: 123.94 })).toEqual({
      lat: 10.33,
      lng: 123.94,
    });
  });
});
