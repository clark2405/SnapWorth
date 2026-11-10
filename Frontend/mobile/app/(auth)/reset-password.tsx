import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import {
  ResetPasswordView,
  isSupabaseConfigured,
  newPasswordPath,
  requestPasswordReset,
} from '@snapworth/shared/features/auth';

export default function ResetPasswordRoute() {
  const router = useRouter();
  const toLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  // The email's link opens the app at /new-password (snapworth://new-password).
  return (
    <ResetPasswordView
      onBack={toLogin}
      onBackToLogin={toLogin}
      unavailable={!isSupabaseConfigured()}
      onSendLink={(email) => requestPasswordReset(email, Linking.createURL(newPasswordPath))}
    />
  );
}
