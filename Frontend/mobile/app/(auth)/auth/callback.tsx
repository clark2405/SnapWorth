import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useToast } from '@snapworth/shared/components';
import { AuthCallbackView, useOAuthRedirect } from '@snapworth/shared/features/auth';
import { useSession } from '@snapworth/shared/features/session';

/**
 * The web's Google callback, mirrored. On the phone Google's answer normally comes back to the
 * in-app browser (`useSignIn`), but a link that opens the app here still finishes the sign-in.
 */
export default function AuthCallbackRoute() {
  const router = useRouter();
  const toast = useToast();
  const { startSession } = useSession();
  const outcome = useOAuthRedirect(Linking.useLinkingURL());

  // Once per outcome: the session and router change as the person signs in.
  useEffect(() => {
    if (outcome?.kind === 'signed-in') {
      startSession(outcome.user);
      router.replace('/feed');
    } else if (outcome?.kind === 'cancelled') {
      toast.show({
        title: 'Google sign-in cancelled',
        body: 'Log in another way, or try again.',
        tone: 'error',
      });
      router.replace('/login');
    }
  }, [outcome]);

  return (
    <AuthCallbackView
      failure={outcome?.kind === 'failed' ? outcome.message : null}
      onBackToLogin={() => router.replace('/login')}
    />
  );
}
