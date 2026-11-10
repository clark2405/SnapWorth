import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { useToast } from '@snapworth/shared/components';
import { AuthCallbackView, useOAuthRedirect } from '@snapworth/shared/features/auth';
import { useSession } from '@snapworth/shared/features/session';

import { authRedirect, forgetAuthRedirect } from '../../../src/auth-links';

/**
 * Where Google sends people back to after signing in on the web. The session's tokens are on
 * the address: read once, wiped from the address bar, then the app opens on the Feed. Turning
 * Google down goes back to log in.
 */
export default function AuthCallbackRoute() {
  const router = useRouter();
  const toast = useToast();
  const { startSession } = useSession();
  const [url] = useState(authRedirect);
  useEffect(forgetAuthRedirect, []);
  const outcome = useOAuthRedirect(url);

  // Once per outcome: the session and router change as the person signs in.
  useEffect(() => {
    if (outcome?.kind === 'signed-in') {
      startSession(outcome.user);
      router.replace('/feed');
    } else if (outcome?.kind === 'cancelled') {
      toast.show({ title: 'Google sign-in cancelled', body: 'Log in another way, or try again.' });
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
