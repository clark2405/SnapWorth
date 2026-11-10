import { useRouter } from 'expo-router';

import {
  ResetPasswordView,
  isSupabaseConfigured,
  newPasswordPath,
  requestPasswordReset,
} from '@snapworth/shared/features/auth';

import { siteLink } from '../../src/auth-links';

export default function ResetPasswordRoute() {
  const router = useRouter();
  const toLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  // The email's link comes back to /new-password on this site.
  return (
    <ResetPasswordView
      onBack={toLogin}
      onBackToLogin={toLogin}
      unavailable={!isSupabaseConfigured()}
      onSendLink={(email) => requestPasswordReset(email, siteLink(newPasswordPath))}
    />
  );
}
