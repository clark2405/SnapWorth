import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SnapWorth',
  slug: 'snapworth',
  scheme: 'snapworth',
  orientation: 'portrait',
  // Liquid Glass is dark-only.
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: 'com.snapworth.app',
    supportsTablet: false,
  },
  android: {
    package: 'com.snapworth.app',
  },
  plugins: ['expo-router', 'expo-status-bar'],
});
