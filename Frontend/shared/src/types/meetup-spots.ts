/**
 * The busy public places a buyer and seller can meet at, to hand an item over or to see it in
 * person first. The server keeps the same list (the `meetup_spots` table) and takes a meetup's
 * name and pin from it, so a pin always shows the place it is labelled with. Keep the two in step;
 * `meetup-map-geo.test.ts` checks them against the migration. The places are in Cebu City, where
 * SnapWorth starts. Coordinates are from each place's Wikipedia entry (Fuente Osmeña Circle, which
 * has none, from Waze), cross-checked with other listings where they had it. SM Seaside's, JY
 * Square's and Il Corso's are OpenStreetMap's own point for the mall (relation 7722019, nodes
 * 1508435161 and 11468705743): Wikipedia's put SM Seaside's pin on the coastal road outside it.
 * Every pin was checked against OpenStreetMap's outline of its place (October 2026).
 */

export type MeetupArea =
  'downtown' | 'uptown' | 'business-park' | 'it-park' | 'reclamation' | 'srp';

export interface MeetupSpot {
  readonly key: string;
  readonly name: string;
  readonly city: string;
  readonly area: MeetupArea;
  readonly lat: number;
  readonly lng: number;
}

export const meetupAreas: readonly { readonly key: MeetupArea; readonly label: string }[] = [
  { key: 'downtown', label: 'Downtown' },
  { key: 'uptown', label: 'Uptown' },
  { key: 'business-park', label: 'Cebu Business Park' },
  { key: 'it-park', label: 'IT Park' },
  { key: 'reclamation', label: 'North Reclamation' },
  { key: 'srp', label: 'SRP' },
];

/** Cebu City, where SnapWorth starts: the middle of the suggested places, for opening the map. */
export const homeCity = { name: 'Cebu City', lat: 10.3055, lng: 123.9 } as const;

export const meetupSpots: readonly MeetupSpot[] = [
  {
    key: 'sm-city-cebu',
    name: 'SM City Cebu',
    city: 'Cebu City',
    area: 'reclamation',
    lat: 10.311111,
    lng: 123.918056,
  },
  {
    key: 'robinsons-galleria-cebu',
    name: 'Robinsons Galleria Cebu',
    city: 'Cebu City',
    area: 'reclamation',
    lat: 10.304167,
    lng: 123.911111,
  },
  {
    key: 'ayala-center-cebu',
    name: 'Ayala Center Cebu',
    city: 'Cebu City',
    area: 'business-park',
    lat: 10.317778,
    lng: 123.905,
  },
  {
    key: 'ayala-central-bloc',
    name: 'Ayala Malls Central Bloc, IT Park',
    city: 'Cebu City',
    area: 'it-park',
    lat: 10.330556,
    lng: 123.907222,
  },
  {
    key: 'fuente-osmena',
    name: 'Fuente Osmeña Circle',
    city: 'Cebu City',
    area: 'uptown',
    lat: 10.309848,
    lng: 123.893135,
  },
  {
    key: 'jy-square',
    name: 'JY Square Mall',
    city: 'Cebu City',
    area: 'uptown',
    lat: 10.330283,
    lng: 123.898601,
  },
  {
    key: 'plaza-independencia',
    name: 'Plaza Independencia',
    city: 'Cebu City',
    area: 'downtown',
    lat: 10.292917,
    lng: 123.905556,
  },
  {
    key: 'sm-seaside-cebu',
    name: 'SM Seaside City Cebu',
    city: 'Cebu City',
    area: 'srp',
    lat: 10.281823,
    lng: 123.88241,
  },
  {
    key: 'il-corso',
    name: 'Il Corso',
    city: 'Cebu City',
    area: 'srp',
    lat: 10.26643,
    lng: 123.877805,
  },
];

export const findMeetupSpot = (key: string | undefined): MeetupSpot | undefined =>
  key ? meetupSpots.find((spot) => spot.key === key) : undefined;

/** Where a meetup can be pinned: the Philippines. The database holds pins to the same box. */
export const pinBounds = { south: 4.5, north: 21.5, west: 116, east: 127 } as const;

export const withinPinBounds = (lat: number, lng: number) =>
  lat >= pinBounds.south &&
  lat <= pinBounds.north &&
  lng >= pinBounds.west &&
  lng <= pinBounds.east;
