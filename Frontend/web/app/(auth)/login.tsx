import { useLocalSearchParams, useRouter } from 'expo-router';

import { LoginView } from '@snapworth/shared/features/auth';
import { useSession } from '@snapworth/shared/features/session';

export default function LoginRoute() {
  const router = useRouter();
  const { startSession } = useSession();
  // `?return=1` comes from an account prompt: go back to what the person was doing.
  const { return: returning } = useLocalSearchParams<{ return?: string }>();

  // Preview wiring: there is no auth service yet, so submitting just starts a session.
  const done = () => {
    startSession();
    if (returning && router.canGoBack()) router.back();
    else router.replace('/feed');
  };

  return (
    <LoginView
      onSubmit={done}
      onForgotPassword={() => router.push('/reset-password')}
      onContinueWithApple={done}
      onContinueWithGoogle={done}
      onClose={returning && router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
