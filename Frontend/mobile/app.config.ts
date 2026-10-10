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
    // A layered Icon Composer icon: iOS 26 gives the tag and its lens Liquid Glass depth, and
    // draws the light, dark, tinted and clear appearances from it.
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
      // The light icon's paper, so the tag sits on the same ground on Android.
      backgroundColor: '#FFFBF5',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-image-picker',
      {
        photosPermission:
          'SnapWorth uses the photos you choose to show more angles of an item you list or ask about.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    // Local notifications only for now (an estimate finishing while you're away); push needs a
    // backend to send from.
    'expo-notifications',
    'expo-status-bar',
    'expo-system-ui',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-mark.png',
        imageWidth: 96,
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
