import { supabase } from '../../adapters/supabaseClient';

export async function performAuth({ mode, email, password, fullName, gender }: any) {
  if (mode === 'signup') {
    return await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, gender } }
    });
  }
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function performGoogleAuth(redirectUrl: string) {
  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });
}