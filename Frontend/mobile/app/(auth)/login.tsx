import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { LoginView } from '@snapworth/shared/features/auth';
import { useSession } from '@snapworth/shared/features/session';
import { performAuth, performGoogleAuth, type AuthInput } from '@snapworth/shared/features/auth';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export default function LoginRoute() {
  const router = useRouter();
  const { startSession } = useSession();
  const { return: returning } = useLocalSearchParams<{ return?: string }>();

  const handleGoogleLogin = async () => {
    const redirectUrl = Linking.createURL('/feed');

    const { data, error } = await performGoogleAuth(redirectUrl);

    if (error) {
      console.error('Google Auth Error:', error.message);
      return;
    }

    if (data?.url) {
      await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    }
  };

  // This single function now handles BOTH Login and Signup based on the UI toggle
  const handleAuthSubmit = async (input: AuthInput) => {
    if (!input.email || !input.password) {
      Alert.alert('Invalid Input', 'Please provide both an email and password.');
      return;
    }

    const { data, error } = await performAuth(input);

    if (error) {
      Alert.alert('Auth Failed', error.message);
      return;
    }

    if (input.mode === 'signup' && !data.session) {
      Alert.alert('Check your email', 'We sent you a confirmation link.');
      return;
    }

    startSession();
    if (returning && router.canGoBack()) router.back();
    else router.replace('/feed');
  };

  return (
    <LoginView
      onSubmit={handleAuthSubmit}
      onForgotPassword={() => router.push('/reset-password')}
      onContinueWithApple={() => Alert.alert('Unavailable', 'Apple login not configured.')}
      onContinueWithGoogle={handleGoogleLogin}
      onClose={returning && router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
