import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { getSupabase, isSupabaseConfigured } from '../../adapters/supabaseClient';

export { isSupabaseConfigured };
import type { AuthInput } from './LoginView';

export async function performAuth({ mode, email, password, fullName, gender }: AuthInput) {
  if (mode === 'signup') {
    return await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, gender } },
    });
  }
  return await getSupabase().auth.signInWithPassword({ email, password });
}

export async function performGoogleAuth(redirectUrl: string) {
  return await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });
}

/**
 * Where Google sends people back to on the web (`/auth/callback`). It must be on Supabase's
 * Redirect URLs list; see READ-FIRST "Sign-in setup".
 */
export const oauthCallbackPath = 'auth/callback';

/**
 * Starts Google sign-in on the web: asks Supabase for Google's address, then leaves for it with
 * `open` (the page's own `location.assign`). Resolves the reason when it couldn't start.
 */
export async function startWebGoogleSignIn(
  redirectTo: string,
  open: (url: string) => void,
): Promise<string | null> {
  try {
    const { data, error } = await performGoogleAuth(redirectTo);
    if (error) return error.message;
    if (!data?.url) return 'Google sign-in couldn’t start. Try again.';
    open(data.url);
    return null;
  } catch (failure) {
    return failure instanceof Error ? failure.message : 'Google sign-in couldn’t start. Try again.';
  }
}

export type OAuthOutcome =
  | { readonly kind: 'signed-in'; readonly user: User }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * Finishes a sign-in Google sent back to the callback page. Turning Google down comes back as
 * `access_denied`, which is a change of mind rather than a failure.
 */
export async function finishOAuthRedirect(url: string): Promise<OAuthOutcome> {
  const params = authParamsFromUrl(url);
  if (params.get('error') === 'access_denied') return { kind: 'cancelled' };
  if (!params.get('error') && !params.get('code') && !params.get('access_token')) {
    return { kind: 'failed', message: 'This page only finishes a sign-in Google started.' };
  }
  try {
    const { data, error } = await completeAuthFromUrl(url);
    if (error) return { kind: 'failed', message: error.message };
    if (!data.user) return { kind: 'failed', message: 'Google didn’t return an account.' };
    return { kind: 'signed-in', user: data.user };
  } catch (failure) {
    return {
      kind: 'failed',
      message: failure instanceof Error ? failure.message : 'Something went wrong. Try again.',
    };
  }
}

const finishing = new Map<string, Promise<OAuthOutcome>>();

/**
 * The callback page's sign-in, finished once per address even if the page mounts twice (a code
 * can be exchanged only once). Null while it's being finished, or before the address is known.
 */
export function useOAuthRedirect(url: string | null | undefined): OAuthOutcome | null {
  const [outcome, setOutcome] = useState<OAuthOutcome | null>(null);
  useEffect(() => {
    if (url === undefined) return;
    let active = true;
    const key = url ?? '';
    const pending = finishing.get(key) ?? finishOAuthRedirect(key);
    finishing.set(key, pending);
    void pending.then((next) => {
      if (active) setOutcome(next);
    });
    return () => {
      active = false;
    };
  }, [url]);
  return outcome;
}

/** Query or hash params from a custom-scheme redirect such as `snapworth://?code=…`. */
export function authParamsFromUrl(url: string): URLSearchParams {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryEnd = hashIndex >= 0 ? hashIndex : url.length;
  const query = queryIndex >= 0 && queryIndex < queryEnd ? url.slice(queryIndex + 1, queryEnd) : '';
  const params = new URLSearchParams(query);
  new URLSearchParams(hash).forEach((value, key) => params.set(key, value));
  return params;
}

/**
 * Turns the URL the in-app browser comes back with into a Supabase session (PKCE code or
 * implicit access/refresh tokens).
 */
export async function completeAuthFromUrl(url: string) {
  const params = authParamsFromUrl(url);
  const oauthError = params.get('error_description') ?? params.get('error');
  if (oauthError) {
    return { data: { session: null, user: null }, error: { message: oauthError } };
  }

  const code = params.get('code');
  if (code) {
    return await getSupabase().auth.exchangeCodeForSession(code);
  }

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    return await getSupabase().auth.setSession({ access_token, refresh_token });
  }

  return {
    data: { session: null, user: null },
    error: {
      message: 'Google sign-in did not return a session. Check the redirect URL in Supabase.',
    },
  };
}
