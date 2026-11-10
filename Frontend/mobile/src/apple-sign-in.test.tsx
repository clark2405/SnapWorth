import type * as AppleSignIn from './apple-sign-in';

// Expo reads EXPO_PUBLIC_* settings through this module; here they come from the test's env.
jest.mock('expo/virtual/env', () => ({ env: process.env }));

/** The module as a build with these settings would load it. */
function load(flag: string | undefined): typeof AppleSignIn {
  const before = process.env.EXPO_PUBLIC_APPLE_SIGN_IN;
  if (flag === undefined) delete process.env.EXPO_PUBLIC_APPLE_SIGN_IN;
  else process.env.EXPO_PUBLIC_APPLE_SIGN_IN = flag;
  try {
    let loaded!: typeof AppleSignIn;
    jest.isolateModules(() => {
      loaded = jest.requireActual<typeof AppleSignIn>('./apple-sign-in');
    });
    return loaded;
  } finally {
    if (before === undefined) delete process.env.EXPO_PUBLIC_APPLE_SIGN_IN;
    else process.env.EXPO_PUBLIC_APPLE_SIGN_IN = before;
  }
}

describe('Sign in with Apple', () => {
  it('stays hidden until the build turns it on', () => {
    expect(load(undefined).appleSignInAvailable).toBe(false);
  });

  // Free Personal Team builds can't sign the entitlement, so the module isn't installed and the
  // flag alone mustn't show a button that can only fail.
  it('stays hidden while the Apple module isn’t installed, even with the flag on', () => {
    const apple = load('1');
    expect(apple.requestAppleCredential).toBeNull();
    expect(apple.appleSignInAvailable).toBe(false);
  });

  it('tells cancelling Apple’s sheet from a failure', () => {
    const { appleCancelled } = load(undefined);
    expect(appleCancelled({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(appleCancelled(new Error('The operation couldn’t be completed.'))).toBe(false);
    expect(appleCancelled(null)).toBe(false);
  });
});
