/**
 * The busy public places a buyer and seller can meet at, to hand an item over or to see it in
 * person first. The server keeps the same list (the `meetup_spots` table) and takes a meetup's
 * name and pin from it, so a pin always shows the place it is labelled with. Keep the two in step;
 * `meetup-spots.test.ts` checks them against the migration.
 */

export type MeetupArea = 'makati' | 'bgc' | 'ortigas' | 'quezon-city' | 'manila';

export interface MeetupSpot {
  readonly key: string;
  readonly name: string;
  readonly city: string;
  readonly area: MeetupArea;
  readonly lat: number;
  readonly lng: number;
}

export const meetupAreas: readonly { readonly key: MeetupArea; readonly label: string }[] = [
  { key: 'makati', label: 'Makati' },
  { key: 'bgc', label: 'BGC' },
  { key: 'ortigas', label: 'Ortigas' },
  { key: 'quezon-city', label: 'Quezon City' },
  { key: 'manila', label: 'Manila & Pasay' },
];

export const meetupSpots: readonly MeetupSpot[] = [
  {
    key: 'greenbelt',
    name: 'Greenbelt 3',
    city: 'Makati',
    area: 'makati',
    lat: 14.5522,
    lng: 121.0213,
  },
  {
    key: 'ayala-triangle',
    name: 'Ayala Triangle Gardens',
    city: 'Makati',
    area: 'makati',
    lat: 14.5571,
    lng: 121.0237,
  },
  {
    key: 'glorietta',
    name: 'Glorietta',
    city: 'Makati',
    area: 'makati',
    lat: 14.5509,
    lng: 121.0254,
  },
  {
    key: 'high-street',
    name: 'Bonifacio High Street',
    city: 'Taguig',
    area: 'bgc',
    lat: 14.5506,
    lng: 121.0511,
  },
  {
    key: 'market-market',
    name: 'Market! Market!',
    city: 'Taguig',
    area: 'bgc',
    lat: 14.5497,
    lng: 121.0563,
  },
  {
    key: 'sm-aura',
    name: 'SM Aura Premier',
    city: 'Taguig',
    area: 'bgc',
    lat: 14.5466,
    lng: 121.0546,
  },
  {
    key: 'megamall',
    name: 'SM Megamall',
    city: 'Mandaluyong',
    area: 'ortigas',
    lat: 14.5849,
    lng: 121.0566,
  },
  {
    key: 'shangri-la',
    name: 'Shangri-La Plaza',
    city: 'Mandaluyong',
    area: 'ortigas',
    lat: 14.5813,
    lng: 121.0538,
  },
  {
    key: 'estancia',
    name: 'Estancia, Capitol Commons',
    city: 'Pasig',
    area: 'ortigas',
    lat: 14.5753,
    lng: 121.0628,
  },
  {
    key: 'sm-north',
    name: 'SM North EDSA',
    city: 'Quezon City',
    area: 'quezon-city',
    lat: 14.6565,
    lng: 121.0293,
  },
  {
    key: 'trinoma',
    name: 'TriNoma',
    city: 'Quezon City',
    area: 'quezon-city',
    lat: 14.6535,
    lng: 121.0336,
  },
  {
    key: 'up-town-center',
    name: 'UP Town Center',
    city: 'Quezon City',
    area: 'quezon-city',
    lat: 14.6504,
    lng: 121.0751,
  },
  {
    key: 'gateway',
    name: 'Gateway Mall, Araneta City',
    city: 'Quezon City',
    area: 'quezon-city',
    lat: 14.6221,
    lng: 121.053,
  },
  {
    key: 'eastwood',
    name: 'Eastwood City',
    city: 'Quezon City',
    area: 'quezon-city',
    lat: 14.6091,
    lng: 121.0798,
  },
  {
    key: 'mall-of-asia',
    name: 'SM Mall of Asia',
    city: 'Pasay',
    area: 'manila',
    lat: 14.5352,
    lng: 120.9822,
  },
  {
    key: 'rizal-park',
    name: 'Rizal Park',
    city: 'Manila',
    area: 'manila',
    lat: 14.5831,
    lng: 120.9794,
  },
  {
    key: 'robinsons-manila',
    name: 'Robinsons Place Manila',
    city: 'Manila',
    area: 'manila',
    lat: 14.5766,
    lng: 120.9839,
  },
];

export const findMeetupSpot = (key: string | undefined): MeetupSpot | undefined =>
  key ? meetupSpots.find((spot) => spot.key === key) : undefined;
