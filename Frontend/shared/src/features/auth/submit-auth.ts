import type { SessionUser } from '../session';
import { isSupabaseConfigured, performAuth } from './authApi';
import type { AuthInput } from './LoginView';

/** What came of submitting the login or signup form. */
export type SubmitOutcome =
  /** The form wasn't filled in: nothing was sent, and `message` says what's missing. */
  | { readonly kind: 'invalid'; readonly message: string }
  /** The project (or the connection) said no: `message` is the reason. */
  | { readonly kind: 'failed'; readonly message: string }
  /** Signed up, but the account needs its email confirmed before there is a session. */
  | { readonly kind: 'check-email' }
  /** A real account, signed in with Supabase. */
  | { readonly kind: 'signed-in'; readonly user: SessionUser | null }
  /** A build with no Supabase project: a session on this device, as the preview always did. */
  | { readonly kind: 'local'; readonly user: SessionUser };

/**
 * What's missing from the form, in a sentence, or null when an email and password are both there.
 * Applies in every mode: an empty form never starts a session of any kind.
 */
export function missingFromAuthInput(input: Pick<AuthInput, 'email' | 'password'>): string | null {
  const email = input.email?.trim();
  if (!email && !input.password) return 'Enter your email and password.';
  if (!email) return 'Enter your email.';
  if (!input.password) return 'Enter your password.';
  return null;
}

/**
 * Logs in or signs up from the form. With a Supabase project it only ever signs in a real account;
 * a missing field or a refusal is an error for the screen to show, never a session. Only a build
 * with no project at all starts a session on the device.
 */
export async function submitAuth(input: AuthInput): Promise<SubmitOutcome> {
  const missing = missingFromAuthInput(input);
  if (missing) return { kind: 'invalid', message: missing };
  const email = input.email.trim();

  if (!isSupabaseConfigured()) {
    return {
      kind: 'local',
      user: {
        id: 'local_user',
        email,
        user_metadata: {
          full_name: input.fullName || email.split('@')[0] || 'User',
          gender: input.gender,
        },
        created_at: new Date().toISOString(),
      },
    };
  }

  try {
    const { data, error } = await performAuth({ ...input, email });
    if (error) return { kind: 'failed', message: error.message };
    if (input.mode === 'signup' && !data.session) return { kind: 'check-email' };
    return { kind: 'signed-in', user: data.user };
  } catch (failure) {
    return {
      kind: 'failed',
      message: failure instanceof Error ? failure.message : 'Something went wrong. Try again.',
    };
  }
}
