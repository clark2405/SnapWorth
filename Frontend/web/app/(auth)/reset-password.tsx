import { useRouter } from 'expo-router';

import { ResetPasswordView } from '@snapworth/shared/features/auth';

export default function ResetPasswordRoute() {
  const router = useRouter();
  const toLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  // Preview wiring: there is no auth service yet, so sending always succeeds.
  return <ResetPasswordView onBack={toLogin} onBackToLogin={toLogin} />;
}
