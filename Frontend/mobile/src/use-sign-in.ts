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
  isSupabaseConfigured,
  performAuth,
  performGoogleAuth,
  type AuthInput,
} from '@snapworth/shared/features/auth';
import { useSession } from '@snapworth/shared/features/session';

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

  const enter = () => {
    startSession();
    if (returning && router.canGoBack()) router.back();
    else router.replace('/feed');
    openFromTag();
  };

  const submit = async (input: AuthInput) => {
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
      enter();
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
      enter();
    } catch (failure) {
      // No connection, or a project that can't be reached: say so rather than crash.
      cancelHandoff();
      Alert.alert(failed, messageOf(failure));
    }
  };

  const google = async () => {
    if (!configured) {
      await closeIntoTag({ stamp: 'WELCOME' });
      enter();
      return;
    }
    try {
      const redirectUrl = Linking.createURL('/feed');
      const { data, error } = await performGoogleAuth(redirectUrl);
      if (error) {
        Alert.alert('Google sign-in failed', error.message);
        return;
      }
      if (data?.url) await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    } catch (failure) {
      Alert.alert('Google sign-in failed', messageOf(failure));
    }
  };

  const close = returning && router.canGoBack() ? () => router.back() : undefined;

  return {
    submit,
    google,
    apple: () => Alert.alert('Unavailable', 'Apple login not configured.'),
    forgotPassword: () => router.push('/reset-password'),
    close,
  };
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : 'Something went wrong. Try again.';
}
