/* Shared setup for screen tests: native modules the views touch, replaced with inert stand-ins. */
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// Reanimated's mock leaves out the Reduce Motion hook; screens see motion as allowed.
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return { ...mock, useReducedMotion: () => false };
});

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

jest.mock('@react-native-masked-view/masked-view', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Shared screens only ask the router whether they are focused or a link preview; the shells
// own navigation, so the router itself stays out of screen tests.
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useIsPreview: () => false,
  useScrollToTop: () => undefined,
}));

// Expo installs `fetch` and friends as lazy globals that load on first touch, which Jest's
// module scope refuses; screens never fetch, so plain stand-ins are enough.
for (const name of ['fetch', 'Headers', 'Request', 'Response', 'FormData']) {
  Object.defineProperty(global, name, { value: jest.fn(), writable: true, configurable: true });
}
Object.defineProperty(global, '__ExpoImportMetaRegistry', {
  value: { url: null },
  writable: true,
  configurable: true,
});
Object.defineProperty(global, 'structuredClone', {
  value: (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value))),
  writable: true,
  configurable: true,
});
