import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SnapWorth',
  slug: 'snapworth',
  scheme: 'snapworth',
  version: '1.0.0',
  orientation: 'portrait',
  // Light and dark both ship; the app follows the system unless the user picks one in Profile.
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: 'com.snapworth.app',
    supportsTablet: false,
    // A layered Icon Composer icon: the kraft price tag on the brand red, its eyelet a lens and
    // its string looping free. iOS 26 gives the tag and lens Liquid Glass depth, and draws the
    // light, dark, tinted and clear appearances from it.
    icon: './assets/SnapWorth.icon',
    infoPlist: {
      CFBundleDisplayName: 'SnapWorth',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.snapworth.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      // Android 13+ themed icons tint this one-colour mark to the wallpaper, like iOS's tinted mode.
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      // The light icon's red, so the kraft tag sits on the same ground on Android.
      backgroundColor: '#D63A14',
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    // iOS 27 closes apps at launch that haven't adopted the scene life cycle.
    './plugins/with-scene-lifecycle.cjs',
    [
      'expo-image-picker',
      {
        photosPermission:
          'SnapWorth uses the photos you choose to show more angles of an item you list or ask about.',
        cameraPermission: 'Allow SnapWorth to use your camera to photograph items.',
        microphonePermission: false,
      },
    ],
    // "Near me" in the Market works out how far a listing is on the phone, only while the app is
    // open; the position is never stored or sent.
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'SnapWorth uses your location while the app is open to show how far listings are. It stays on your phone.',
      },
    ],
    // Local notifications only (an estimate finishing, a meetup reminder): they need no Apple
    // entitlement. Remote push adds `aps-environment`, which a free Personal Team can't sign, so
    // it's off. With the paid account and a backend to send from, remove this option.
    ['expo-notifications', { enableRemoteNotifications: false }],
    'expo-status-bar',
    'expo-system-ui',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow SnapWorth to use your camera to photograph items.',
        microphonePermission: false,
        recordAudioAndroid: false,
        barcodeScannerEnabled: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-mark.png',
        imageWidth: 112,
        // The app's own paper and charcoal, so the launch hands over to the first screen seamlessly.
        backgroundColor: '#FFFBF5',
        dark: { image: './assets/splash-mark-dark.png', backgroundColor: '#17120D' },
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
});
