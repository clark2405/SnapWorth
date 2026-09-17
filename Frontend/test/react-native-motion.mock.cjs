const { jest: jestGlobals } = require('@jest/globals');

const AccessibilityInfo = {
  addEventListener: jestGlobals.fn(),
  isReduceMotionEnabled: jestGlobals.fn(),
};

module.exports = { AccessibilityInfo };
