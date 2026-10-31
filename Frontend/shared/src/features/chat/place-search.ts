import { Platform } from 'react-native';

import { homeCity, meetupSpots, withinPinBounds } from '../../types/meetup-spots';

declare const process: {
  env: Record<string, string | undefined>;
};

/** A place found by name, to move the meetup map to. */
export interface FoundPlace {
  readonly name: string;
  /** Where it is, e.g. "Lahug, Cebu City". */
  readonly detail: string;
  readonly lat: number;
  readonly lng: number;
  /** Set when it's one of the suggested meetup spots. */
  readonly spotKey?: string;
}

/**
 * Where places are looked up by name. The default is OpenStreetMap's own search (Nominatim),
 * which matches the map's tiles and is free to use lightly: one search when the person presses
 * search, never a request per keystroke, and the app named in each request. Like the tiles, pick
 * a provider and plan before launch; set `EXPO_PUBLIC_PLACE_SEARCH_URL` to another
 * Nominatim-compatible endpoint, or to `none` to turn the lookup off.
 */
const defaultEndpoint = 'https://nominatim.openstreetmap.org/search';
const configured = process.env.EXPO_PUBLIC_PLACE_SEARCH_URL;
export const placeSearchEndpoint: string | null =
  configured === 'none' ? null : configured || defaultEndpoint;

/** The credit the search provider asks for wherever its results are shown. */
export const placeSearchCredit = configured ? null : 'Search by OpenStreetMap';

/** The suggested meetup spots whose name holds what's been typed so far, for instant matches. */
export function matchingSpots(query: string): readonly FoundPlace[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return meetupSpots
    .filter((spot) => words.every((word) => spot.name.toLowerCase().includes(word)))
    .map((spot) => ({
      name: spot.name,
      detail: spot.city,
      lat: spot.lat,
      lng: spot.lng,
      spotKey: spot.key,
    }));
}

interface NominatimRow {
  readonly name?: string;
  readonly display_name?: string;
  readonly lat?: string;
  readonly lon?: string;
}

/** A search provider's rows as places, keeping only real, pinnable spots in the Philippines. */
export function placesFrom(rows: unknown): readonly FoundPlace[] {
  if (!Array.isArray(rows)) return [];
  const places: FoundPlace[] = [];
  for (const row of rows as NominatimRow[]) {
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !withinPinBounds(lat, lng)) continue;
    const parts = (row.display_name ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const name = row.name?.trim() || parts[0];
    if (!name) continue;
    const rest = parts.filter((part) => part !== name);
    places.push({ name, detail: rest.slice(0, 2).join(', '), lat, lng });
  }
  // The same place can come back twice (a building and its grounds): keep the first.
  return places.filter(
    (place, index) =>
      places.findIndex((other) => other.name === place.name && other.detail === place.detail) ===
      index,
  );
}

/** Around Cebu, where SnapWorth starts: results here come first, but anywhere in the country can be found. */
const nearCebu = [
  homeCity.lng - 0.25,
  homeCity.lat + 0.2,
  homeCity.lng + 0.25,
  homeCity.lat - 0.2,
].join(',');

/**
 * Looks a place up by name, in the Philippines and favouring Cebu. Resolves to the places found,
 * or null when the lookup couldn't be made (offline, turned off, or the provider said no).
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<readonly FoundPlace[] | null> {
  const text = query.trim();
  if (!placeSearchEndpoint || text.length < 2) return null;
  const params = new URLSearchParams({
    q: text,
    format: 'jsonv2',
    countrycodes: 'ph',
    viewbox: nearCebu,
    limit: '6',
    'accept-language': 'en',
  });
  try {
    const response = await fetch(`${placeSearchEndpoint}?${params.toString()}`, {
      signal,
      // Browsers name the site themselves; the apps say who's asking, as the provider requires.
      headers: Platform.OS === 'web' ? {} : { 'User-Agent': 'SnapWorth (meetup map search)' },
    });
    if (!response.ok) return null;
    return placesFrom(await response.json());
  } catch {
    return null;
  }
}
