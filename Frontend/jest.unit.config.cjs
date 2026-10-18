const { motionHookProject, screenProject, pureUnitProject } = require('./jest.projects.cjs');

module.exports = {
  projects: [
    pureUnitProject,
    motionHookProject,
    screenProject,
    require('./mobile/jest.config.cjs'),
  ],
};
