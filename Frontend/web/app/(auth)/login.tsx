import { useRouter } from 'expo-router';

import { LoginView } from '@snapworth/shared/features/auth';

export default function LoginRoute() {
  const router = useRouter();

  // Preview wiring: there is no auth service yet, so submitting just opens the feed.

  return (
    <LoginView
      onSubmit={() => router.replace('/feed')}
      onForgotPassword={() => router.push('/reset-password')}
      onContinueWithApple={() => router.replace('/feed')}
      onContinueWithGoogle={() => router.replace('/feed')}
    />
  );
}
