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
    icon: {
      light: './assets/icon.png',
      dark: './assets/icon-dark.png',
    },
    infoPlist: {
      CFBundleDisplayName: 'SnapWorth',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.snapworth.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0B0B0D',
    },
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-system-ui',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-mark.png',
        imageWidth: 96,
        backgroundColor: '#F5F4F0',
        dark: { image: './assets/splash-mark-dark.png', backgroundColor: '#0B0B0D' },
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
});
