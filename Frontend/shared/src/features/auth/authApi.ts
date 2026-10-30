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
