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
 * Where places are looked up by name, as the person types. The default is Photon
 * (photon.komoot.io), an OpenStreetMap search built for search-as-you-type, so its places match
 * the map's tiles. (OpenStreetMap's own Nominatim forbids type-ahead on its public server.) It's
 * free for light use: one request after a pause in typing, never one per keystroke, the previous
 * one cancelled, and the app named in each request. Like the tiles, pick a provider and plan
 * before launch; set `EXPO_PUBLIC_PLACE_SEARCH_URL` to another Photon-compatible endpoint, or to
 * `none` to turn the lookup off (the suggested spots still match).
 */
const defaultEndpoint = 'https://photon.komoot.io/api/';
const configured = process.env.EXPO_PUBLIC_PLACE_SEARCH_URL;
export const placeSearchEndpoint: string | null =
  configured === 'none' ? null : configured || defaultEndpoint;

/** The credit the search provider asks for wherever its results are shown. */
export const placeSearchCredit = configured ? null : 'Search by Photon · OpenStreetMap';

/** How many letters before the lookup starts, and how long a pause in typing before it asks. */
export const searchMinLetters = 3;
export const searchPauseMs = 350;

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

interface PhotonFeature {
  readonly geometry?: { readonly coordinates?: readonly unknown[] };
  readonly properties?: Record<string, unknown>;
}

const textOf = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Photon's answer (GeoJSON) as places: the name, then the street and area it's in. */
function photonPlaces(features: readonly PhotonFeature[]): FoundPlace[] {
  const places: FoundPlace[] = [];
  for (const feature of features) {
    const [lng, lat] = (feature.geometry?.coordinates ?? []).map(Number);
    const props = feature.properties ?? {};
    const country = textOf(props.countrycode).toUpperCase();
    if (lat === undefined || lng === undefined) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !withinPinBounds(lat, lng)) continue;
    if (country && country !== 'PH') continue;
    const street = [textOf(props.housenumber), textOf(props.street)].filter(Boolean).join(' ');
    const name = textOf(props.name) || street;
    if (!name) continue;
    const area = textOf(props.city) || textOf(props.district) || textOf(props.locality);
    const detail = [street !== name ? street : '', area].filter(Boolean).join(', ');
    places.push({ name, detail, lat, lng });
  }
  return places;
}

/**
 * A search provider's answer as places, keeping only real, pinnable spots in the Philippines:
 * Photon's GeoJSON, or a Nominatim-style list of rows.
 */
export function placesFrom(rows: unknown): readonly FoundPlace[] {
  const features = (rows as { readonly features?: unknown })?.features;
  if (Array.isArray(features)) return unique(photonPlaces(features as PhotonFeature[]));
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
  return unique(places);
}

/** The same place can come back twice (a building and its grounds): keep the first. */
function unique(places: readonly FoundPlace[]): readonly FoundPlace[] {
  return places.filter(
    (place, index) =>
      places.findIndex((other) => other.name === place.name && other.detail === place.detail) ===
      index,
  );
}

/** The Philippines, as a box: results outside it are never asked for. */
const philippines = '116.9,4.4,126.7,21.3';

/**
 * Looks a place up by name, in the Philippines and favouring what's near `near` (the map's
 * middle, else Cebu, where SnapWorth starts). Resolves to the places found, or null when the
 * lookup couldn't be made (offline, turned off, or the provider said no).
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  near: { readonly lat: number; readonly lng: number } = homeCity,
): Promise<readonly FoundPlace[] | null> {
  const text = query.trim();
  if (!placeSearchEndpoint || text.length < 2) return null;
  const params = new URLSearchParams({
    q: text,
    lat: near.lat.toFixed(4),
    lon: near.lng.toFixed(4),
    bbox: philippines,
    limit: '8',
    lang: 'en',
  });
  try {
    const response = await fetch(`${placeSearchEndpoint}?${params.toString()}`, {
      signal,
      // Browsers name the site themselves; the apps say who's asking, as the provider asks.
      headers: Platform.OS === 'web' ? {} : { 'User-Agent': 'SnapWorth (meetup map search)' },
    });
    if (!response.ok) return null;
    return placesFrom(await response.json());
  } catch {
    return null;
  }
}
