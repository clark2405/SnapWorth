/** A point on the map, in degrees. */
export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

/**
 * What asking the phone (or browser) where it is came back with. `denied` means the person said
 * no, so asking again does nothing until they change it in Settings; `unavailable` means there
 * was no answer to be had (location services off, no signal, timed out).
 */
export type DeviceLocationResult =
  | { readonly status: 'granted'; readonly position: Coordinates }
  | { readonly status: 'denied' }
  | { readonly status: 'unavailable' };

/**
 * The viewer's own position, read once when they ask for something that needs it ("Near me").
 * It is only ever used on this device to measure distances: it is never stored or sent anywhere.
 */
export interface DeviceLocationPort {
  /** Asks permission when it hasn't been given, then reads the position once. */
  current(): Promise<DeviceLocationResult>;
}

/** Where the phone is now, and how far off the reading might be, in metres. */
export interface LivePosition extends Coordinates {
  readonly accuracyM: number | null;
}

/** A position being followed: `stop` ends it. */
export type PositionWatch =
  | { readonly status: 'granted'; readonly stop: () => void }
  | { readonly status: 'denied' }
  | { readonly status: 'unavailable' };

/**
 * Follows the phone's position while the app is open, for sharing it with the other person at an
 * agreed meetup. Unlike `DeviceLocationPort` it's precise and keeps going until stopped.
 */
export interface PositionWatchPort {
  /** Asks permission when it hasn't been given, then calls `onPosition` as the phone moves. */
  watch(onPosition: (position: LivePosition) => void): Promise<PositionWatch>;
}
