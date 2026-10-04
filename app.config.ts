import type { ExpoConfig } from 'expo/config';

// Only explicitly public settings belong here: Expo config is visible to clients.
const config: ExpoConfig = {
  name: 'LoreMore',
  slug: 'loremore',
  version: '0.1.0',
  scheme: 'loremore',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: '#F7F4ED',
  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.loremore.app.dev',
  },
  android: { package: 'com.loremore.app.dev' },
  web: { bundler: 'metro', output: 'single' },
  plugins: ['expo-router', 'expo-dev-client', 'expo-font', 'expo-status-bar', 'expo-secure-store', 'expo-asset'],
  experiments: { typedRoutes: true },
};
export default config;
