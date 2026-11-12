import type { MarketArea, MarketListing } from '../../ports/marketplace';
import type { Coordinates } from '../../ports/location';

/**
 * Where each market area is, as its centre (approximate city centres). Listings are placed by
 * area, not by their seller's address, so "near me" is a distance to the middle of the listing's
 * area: a few kilometres of slack in a city, which is the price of never storing where a seller
 * lives.
 */
export const marketAreaCentres: Readonly<Record<MarketArea, Coordinates>> = {
  'cebu-city': { lat: 10.3157, lng: 123.8854 },
  mandaue: { lat: 10.3236, lng: 123.9223 },
  'lapu-lapu': { lat: 10.3103, lng: 123.9494 },
  'metro-manila': { lat: 14.5995, lng: 120.9842 },
};

/** The listing's coarse position: its stored coordinates (rounded to ~1 km), else its area's centre. */
export function listingCoordinates(
  listing: Pick<MarketListing, 'area' | 'lat' | 'lng'>,
): Coordinates {
  return listing.lat !== null && listing.lng !== null
    ? { lat: listing.lat, lng: listing.lng }
    : marketAreaCentres[listing.area];
}

const earthRadiusKm = 6371;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** The straight-line distance between two points on the ground, in kilometres (haversine). */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}
