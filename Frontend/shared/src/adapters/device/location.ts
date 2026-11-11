import * as Location from 'expo-location';

import type { DeviceLocationPort } from '../../ports/location';

/**
 * The phone's or browser's location (expo-location: the system's own prompt on iOS and Android,
 * the browser's geolocation on the web), asked for only while the app is open. A balanced accuracy
 * is plenty: "near me" is measured in kilometres against a listing's area, so it never needs the
 * battery cost of a precise fix.
 */
export function createDeviceLocation(): DeviceLocationPort {
  return {
    async current() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') return { status: 'denied' };
        const fix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        return {
          status: 'granted',
          position: { lat: fix.coords.latitude, lng: fix.coords.longitude },
        };
      } catch {
        return { status: 'unavailable' };
      }
    },
  };
}
