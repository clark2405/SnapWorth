const path = require('node:path');

const rootDir = __dirname;
const common = {
  rootDir,
  roots: ['<rootDir>/shared/src', '<rootDir>/web'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
      },
    ],
  },
  moduleNameMapper: {
    '^@snapworth/shared/(.*)$': '<rootDir>/shared/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};

const pureUnitProject = {
  ...common,
  displayName: 'unit-node',
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  testPathIgnorePatterns: [
    ...common.testPathIgnorePatterns,
    '\\.property\\.test\\.[jt]sx?$',
    '\\.native\\.test\\.[jt]sx?$',
    '\\.screen\\.test\\.[jt]sx?$',
  ],
};

const motionHookProject = {
  ...common,
  displayName: 'motion-hook-jsdom',
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    ...common.moduleNameMapper,
    '^react-native$': path.join(rootDir, 'test/react-native-motion.mock.cjs'),
  },
  testMatch: ['<rootDir>/shared/src/design/motion-preference.native.test.tsx'],
};

const propertyProject = {
  ...common,
  displayName: 'property-node',
  testMatch: ['**/*.property.test.[jt]s?(x)'],
};

/**
 * Screens and components rendered as React Native would render them (jest-expo's iOS preset),
 * driven through React Native Testing Library: what a person sees and can press.
 */
const screenProject = {
  rootDir,
  displayName: 'screens',
  preset: 'jest-expo/ios',
  roots: ['<rootDir>/shared/src'],
  // There is no root Babel config, so React Native's own sources get the Expo preset here too,
  // and so do the libraries that ship untranspiled modules (the icons ship .mjs).
  transform: {
    '^.+\\.(m?js|jsx|tsx?)$': common.transform['^.+\\.[jt]sx?$'],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(-.*)?|@expo(-google-fonts)?/.*|react-native-.*|@react-native-.*/.*|lucide-react-native|@supabase/.*))',
  ],
  testMatch: ['**/*.screen.test.[jt]s?(x)'],
  setupFiles: ['<rootDir>/test/screen-setup.cjs'],
  moduleNameMapper: {
    '^@snapworth/shared/(.*)$': '<rootDir>/shared/src/$1',
  },
};

module.exports = {
  screenProject,
  motionHookProject,
  propertyProject,
  pureUnitProject,
};
