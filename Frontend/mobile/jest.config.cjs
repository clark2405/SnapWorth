module.exports = {
  preset: '@react-native/jest-preset',
  displayName: 'mobile-camera',
  rootDir: require('node:path').resolve(__dirname, '..'),
  roots: ['<rootDir>/mobile/src'],
  testMatch: ['**/*.test.tsx'],
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
};
