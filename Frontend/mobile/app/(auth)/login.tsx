import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { LoginView } from '@snapworth/shared/features/auth';
import { useSession } from '@snapworth/shared/features/session';
import { supabase } from '../../../shared/src/adapters/supabaseClient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export default function LoginRoute() {
  const router = useRouter();
  const { startSession } = useSession();
  const { return: returning } = useLocalSearchParams<{ return?: string }>();

  const handleGoogleLogin = async () => {
    const redirectUrl = Linking.createURL('/feed');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error("Google Auth Error:", error.message);
      return;
    }

    if (data?.url) {
      await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    }
  };

  // This single function now handles BOTH Login and Signup based on the UI toggle
  const handleAuthSubmit = async ({
    mode, email, password, fullName, gender
  }: {
    mode: string; email: string; password: string; fullName?: string; gender?: string;
  }) => {
    if (!email || !password) {
      Alert.alert("Invalid Input", "Please provide both an email and password.");
      return;
    }

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            gender: gender,
          }
        }
      });

      if (error) {
        Alert.alert("Signup Failed", error.message);
        return;
      }

      if (data.session) {
        startSession();
        if (returning && router.canGoBack()) router.back();
        else router.replace('/feed');
      } else {
        Alert.alert("Check your email", "We sent you a confirmation link to complete your registration.");
      }

    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      startSession();
      if (returning && router.canGoBack()) router.back();
      else router.replace('/feed');
    }
  };

  return (
    <LoginView
      onSubmit={handleAuthSubmit}
      onForgotPassword={() => router.push('/reset-password')}
      onContinueWithApple={() => Alert.alert("Unavailable", "Apple login not configured.")}
      onContinueWithGoogle={handleGoogleLogin}
      onClose={returning && router.canGoBack() ? () => router.back() : undefined}
    />
  );
}