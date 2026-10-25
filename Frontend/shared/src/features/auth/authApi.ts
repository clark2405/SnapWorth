import { getSupabase } from '../../adapters/supabaseClient';
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
