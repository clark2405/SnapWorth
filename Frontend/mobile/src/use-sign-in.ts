import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

import {
  cancelHandoff,
  closeIntoTag,
  firstNameOf,
  openFromTag,
  setHandoffName,
} from '@snapworth/shared/components';
import {
  completeAuthFromUrl,
  isSupabaseConfigured,
  performAppleAuth,
  performAuth,
  performGoogleAuth,
  useLeaveWhenSignedIn,
  type AuthInput,
} from '@snapworth/shared/features/auth';
import { useSession, type SessionUser } from '@snapworth/shared/features/session';

import { appleCancelled, appleSignInAvailable, requestAppleCredential } from './apple-sign-in';

WebBrowser.maybeCompleteAuthSession();

/**
 * Logging in and signing up, shared by both screens. The request goes out as the screen closes
 * into Worthy's tag; once both are done the app moves on behind the tag and the tag opens onto it.
 * A sign-in that doesn't go through opens the tag back onto the form, with the reason.
 *
 * A build without a Supabase project (no .env.local, see Backend/README.md) still runs: signing in
 * starts a session on this device, as the preview always did.
 */
export function useSignIn() {
  const router = useRouter();
  const { startSession } = useSession();
  // `?return=1` comes from an account prompt: go back to what the person was doing.
  const { return: returning } = useLocalSearchParams<{ return?: string }>();
  const configured = isSupabaseConfigured();

  // Someone who is already signed in has no use for these screens: back to what they were doing,
  // or the Feed. Each way of signing in here is wrapped, so it can finish its own way out.
  const signingIn = useLeaveWhenSignedIn(() => {
    if (returning && router.canGoBack()) router.back();
    else router.replace('/feed');
  });

  const enter = (userData?: SessionUser | null) => {
    startSession(userData);
    if (returning && router.canGoBack()) router.back();
    else router.replace('/feed');
    openFromTag();
  };

  const submit = signingIn(async (input: AuthInput) => {
    if (!input.email || !input.password) {
      Alert.alert('Invalid Input', 'Please provide both an email and password.');
      return;
    }
    const closing = closeIntoTag({
      stamp: input.mode === 'signup' ? 'WELCOME' : 'WELCOME BACK',
      name: firstNameOf(input.fullName),
    });
    if (!configured) {
      await closing;
      enter({
        id: 'local_user',
        email: input.email,
        user_metadata: {
          full_name: input.fullName || (input.email ? input.email.split('@')[0] : 'Demo User'),
          gender: input.gender,
        },
        created_at: new Date().toISOString(),
      });
      return;
    }

    const failed = input.mode === 'signup' ? 'Signup Failed' : 'Login Failed';
    try {
      const { data, error } = await performAuth(input);
      if (error) {
        cancelHandoff();
        Alert.alert(failed, error.message);
        return;
      }
      if (input.mode === 'signup' && !data.session) {
        cancelHandoff();
        Alert.alert('Check your email', 'We sent you a confirmation link to finish signing up.');
        return;
      }
      setHandoffName(firstNameOf(data.user?.user_metadata?.full_name));
      await closing;
      enter(data.user);
    } catch (failure) {
      // No connection, or a project that can't be reached: say so rather than crash.
      cancelHandoff();
      Alert.alert(failed, messageOf(failure));
    }
  });

  const google = signingIn(async () => {
    if (!configured) {
      await closeIntoTag({ stamp: 'WELCOME' });
      enter({
        id: 'google_user',
        email: 'google_user@snapworth.com',
        user_metadata: { full_name: 'Google User' },
        created_at: new Date().toISOString(),
      });
      return;
    }
    try {
      // If testing in Expo Go and encountering "site can't be reached",
      // replace Linking.createURL('') with your exact IP e.g., 'exp://192.168.1.10:8081'
      const redirectUrl = Linking.createURL('');
      console.log('Redirect URL:', redirectUrl);

      const { data, error } = await performGoogleAuth(redirectUrl);
      if (error) {
        cancelHandoff();
        Alert.alert('Google sign-in failed', error.message);
        return;
      }
      if (!data?.url) {
        cancelHandoff();
        Alert.alert('Google sign-in failed', 'Could not start Google sign-in.');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type !== 'success' || !('url' in result) || !result.url) {
        cancelHandoff();
        if (result.type === 'cancel' || result.type === 'dismiss') return;
        Alert.alert('Google sign-in failed', 'Sign-in was not completed.');
        return;
      }

      const completed = await completeAuthFromUrl(result.url);
      if (completed.error) {
        cancelHandoff();
        Alert.alert('Google sign-in failed', completed.error.message);
        return;
      }

      const name = firstNameOf(
        completed.data.user?.user_metadata?.full_name ?? completed.data.user?.user_metadata?.name,
      );
      const closing = closeIntoTag({ stamp: 'WELCOME', name });
      setHandoffName(name);
      await closing;
      enter(completed.data.user);
    } catch (failure) {
      cancelHandoff();
      Alert.alert('Google sign-in failed', messageOf(failure));
    }
  });

  // Only offered once Sign in with Apple is set up (see apple-sign-in.ts), and with Supabase.
  const apple = signingIn(async () => {
    if (!requestAppleCredential || !configured) return;
    try {
      const credential = await requestAppleCredential();
      const closing = closeIntoTag({ stamp: 'WELCOME', name: firstNameOf(credential.fullName) });
      const { data, error } = await performAppleAuth(credential);
      if (error || !data.user) {
        cancelHandoff();
        Alert.alert('Apple sign-in failed', error?.message ?? 'Apple didn’t return an account.');
        return;
      }
      setHandoffName(firstNameOf(data.user.user_metadata?.full_name ?? credential.fullName));
      await closing;
      enter(data.user);
    } catch (failure) {
      cancelHandoff();
      if (appleCancelled(failure)) return;
      Alert.alert('Apple sign-in failed', messageOf(failure));
    }
  });

  const close = returning && router.canGoBack() ? () => router.back() : undefined;

  return {
    submit,
    google,
    apple: appleSignInAvailable && configured ? apple : undefined,
    forgotPassword: () => router.push('/reset-password'),
    close,
  };
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : 'Something went wrong. Try again.';
}
