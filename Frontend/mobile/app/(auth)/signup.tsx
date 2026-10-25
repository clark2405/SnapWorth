import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { LoginView, performAuth, performGoogleAuth } from '@snapworth/shared/features/auth';
import { useSession } from '@snapworth/shared/features/session';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export default function SignupRoute() {
  const router = useRouter();
  const { startSession } = useSession();
  const { return: returning } = useLocalSearchParams<{ return?: string }>();

  const handleGoogleLogin = async () => {
    const redirectUrl = Linking.createURL('/feed');

    const { data, error } = await performGoogleAuth(redirectUrl);

    if (error) {
      console.error("Google Auth Error:", error.message);
      return;
    }

    if (data?.url) {
      await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    }
  };

  const handleAuthSubmit = async ({
    mode, email, password, fullName, gender
  }: {
    mode: string; email: string; password: string; fullName?: string; gender?: string;
  }) => {
    if (!email || !password) {
      Alert.alert("Invalid Input", "Please provide both an email and password.");
      return;
    }

    const { data, error } = await performAuth({ mode, email, password, fullName, gender });

    if (error) {
      Alert.alert(mode === 'signup' ? "Signup Failed" : "Login Failed", error.message);
      return;
    }

    if (mode === 'signup' && !data?.session) {
      Alert.alert("Check your email", "We sent you a confirmation link to complete your registration.");
      return;
    }

    startSession();
    if (returning && router.canGoBack()) router.back();
    else router.replace('/feed');
  };

  return (
    <LoginView
      initialMode="signup"
      onSubmit={handleAuthSubmit}
      onForgotPassword={() => router.push('/reset-password')}
      onContinueWithApple={() => Alert.alert("Unavailable", "Apple login not configured.")}
      onContinueWithGoogle={handleGoogleLogin}
      onClose={returning && router.canGoBack() ? () => router.back() : undefined}
    />
  );
}