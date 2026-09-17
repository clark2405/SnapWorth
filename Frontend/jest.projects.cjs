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

module.exports = {
  motionHookProject,
  propertyProject,
  pureUnitProject,
};
