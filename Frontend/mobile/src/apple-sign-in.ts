import { Platform } from 'react-native';

/** What Sign in with Apple hands back, ready for Supabase's `signInWithIdToken`. */
export interface AppleCredential {
  /** The identity token Apple signed. */
  readonly idToken: string;
  /** The nonce before hashing: Apple got its SHA-256, Supabase checks the token against it. */
  readonly rawNonce: string;
  /** Apple sends the name only the first time someone signs in to the app. */
  readonly fullName?: string;
}

/**
 * Asks iOS for an Apple ID credential. Null until `expo-apple-authentication` is installed:
 * Sign in with Apple needs an entitlement that only a paid Apple Developer account can sign,
 * and the module's config plugin adds it, which would break builds made with a free Personal
 * Team. READ-FIRST "Sign in with Apple" has the steps to turn it on; they replace this null with:
 *
 *   async () => {
 *     const rawNonce = Crypto.randomUUID();
 *     const credential = await AppleAuthentication.signInAsync({
 *       requestedScopes: [
 *         AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
 *         AppleAuthentication.AppleAuthenticationScope.EMAIL,
 *       ],
 *       nonce: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce),
 *     });
 *     if (!credential.identityToken) throw new Error('Apple didn’t return an identity token.');
 *     const name = [credential.fullName?.givenName, credential.fullName?.familyName];
 *     return {
 *       idToken: credential.identityToken,
 *       rawNonce,
 *       fullName: name.filter(Boolean).join(' ') || undefined,
 *     };
 *   }
 *
 * Cancelling rejects with `code: 'ERR_REQUEST_CANCELED'`, which `useSignIn` treats as a change
 * of mind rather than a failure.
 */
export const requestAppleCredential: (() => Promise<AppleCredential>) | null = null;

/**
 * Whether to offer "Continue with Apple": on iOS, once the module is in and the build sets
 * `EXPO_PUBLIC_APPLE_SIGN_IN=1`. Otherwise the button isn't shown at all.
 */
export const appleSignInAvailable =
  Platform.OS === 'ios' &&
  process.env.EXPO_PUBLIC_APPLE_SIGN_IN === '1' &&
  requestAppleCredential !== null;

/** Whether a failure from Apple's sheet was the person cancelling it. */
export function appleCancelled(failure: unknown): boolean {
  return (failure as { code?: unknown } | null)?.code === 'ERR_REQUEST_CANCELED';
}
