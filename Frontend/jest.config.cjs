const {
  motionHookProject,
  screenProject,
  propertyProject,
  pureUnitProject,
} = require('./jest.projects.cjs');

module.exports = {
  collectCoverageFrom: [
    'shared/src/**/*.{ts,tsx}',
    '!shared/src/**/*.d.ts',
    'web/src/**/*.{ts,tsx}',
    '!web/src/**/*.d.ts',
  ],
  projects: [pureUnitProject, motionHookProject, screenProject, propertyProject],
};
