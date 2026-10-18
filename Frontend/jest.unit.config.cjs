const { motionHookProject, pureUnitProject } = require('./jest.projects.cjs');

module.exports = {
  projects: [pureUnitProject, motionHookProject, require('./mobile/jest.config.cjs')],
};
