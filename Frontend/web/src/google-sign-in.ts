import { useToast } from '@snapworth/shared/components';
import {
  isSupabaseConfigured,
  oauthCallbackPath,
  startWebGoogleSignIn,
} from '@snapworth/shared/features/auth';

import { siteLink } from './auth-links';

/**
 * "Continue with Google" on the web: the page leaves for Google and comes back to
 * /auth/callback, which finishes the sign-in. Without a Supabase project there's no Google to
 * go to, so `preview` starts a session in this browser instead, as before.
 */
export function useGoogleSignIn(preview: () => void): () => Promise<void> {
  const toast = useToast();
  return async () => {
    if (!isSupabaseConfigured()) {
      preview();
      return;
    }
    const failure = await startWebGoogleSignIn(siteLink(oauthCallbackPath), (url) =>
      globalThis.location.assign(url),
    );
    if (failure) toast.show({ title: 'Google sign-in failed', body: failure });
  };
}
