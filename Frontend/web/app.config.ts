import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SnapWorth',
  slug: 'snapworth-web',
  scheme: 'snapworth',
  userInterfaceStyle: 'automatic',
  plugins: ['expo-router', 'expo-status-bar'],
  web: {
    ...config.web,
    bundler: 'metro',
    output: 'static',
    // The tag-and-lens mark, same as the app icon.
    favicon: './assets/favicon.png',
  },
});
