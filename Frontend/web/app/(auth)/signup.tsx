import { useRouter } from 'expo-router';

import { LoginView } from '@snapworth/shared/features/auth';

export default function SignupRoute() {
  const router = useRouter();

  // Preview wiring: there is no auth service yet, so submitting just opens the feed.

  return (
    <LoginView
      initialMode="signup"
      onSubmit={() => router.replace('/feed')}
      onForgotPassword={() => router.push('/reset-password')}
    />
  );
}
