import { useEffect, useState } from 'react';

import { getSupabase, isSupabaseConfigured } from '../../adapters/supabaseClient';
import { authParamsFromUrl, completeAuthFromUrl } from './authApi';

/**
 * Where a reset email's link opens: `/new-password` on the web, and `snapworth://new-password`
 * (the dev server's address in Expo Go) on the phone. Supabase only sends people back to
 * addresses on its Redirect URLs list; see READ-FIRST "Sign-in setup".
 */
export const newPasswordPath = 'new-password';

/** The shortest password the app accepts, as the sign-up form asks. */
export const minimumPasswordLength = 8;

/**
 * How asking for a reset link went: `sent` (or as good as: see below), `failed` when the request
 * never got through, `unavailable` when this build has no Supabase project to ask.
 */
export type ResetLinkOutcome = 'sent' | 'failed' | 'unavailable';

/**
 * Asks Supabase to email a reset link. The answer is the same whether or not the email has an
 * account: Supabase itself replies alike for both, and a rate limit is only ever reached by an
 * address it has been sending to, so a limit is reported as sent too (the earlier link still
 * works) rather than give the account away.
 */
export async function requestPasswordReset(
  email: string,
  redirectTo: string,
): Promise<ResetLinkOutcome> {
  if (!isSupabaseConfigured()) return 'unavailable';
  try {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
    if (!error || isRateLimit(error)) return 'sent';
    return 'failed';
  } catch {
    return 'failed';
  }
}

function isRateLimit(error: { status?: number; code?: string }): boolean {
  return error.status === 429 || /rate_limit/.test(error.code ?? '');
}

/**
 * What a reset link turned out to be: `ready` to choose a new password, `expired` (links last
 * an hour and work once), `invalid` (not a reset link, or a mangled one), `failed` when Supabase
 * couldn't be reached to check it, and `unavailable` without a Supabase project.
 */
export type RecoveryLinkStatus =
  'checking' | 'ready' | 'expired' | 'invalid' | 'failed' | 'unavailable';

interface LinkError {
  readonly status?: number;
  readonly code?: string;
  readonly message?: string;
}

/** A refused link is expired or invalid; anything else (no connection) is worth a retry. */
function linkFailure(error: LinkError): RecoveryLinkStatus {
  const status = error.status ?? 0;
  if (status < 400 || status >= 500) return 'failed';
  return /expired/i.test(`${error.code ?? ''} ${error.message ?? ''}`) ? 'expired' : 'invalid';
}

/**
 * Signs in with the session a reset link carries, so the new password can be saved. Supabase
 * sends errors back in the link too: an expired or already used one says `otp_expired`.
 * Opened without a link (the page reloaded after the link was used), someone still signed in
 * can carry on.
 */
export async function openRecoveryLink(
  url: string | null | undefined,
): Promise<RecoveryLinkStatus> {
  if (!isSupabaseConfigured()) return 'unavailable';
  const params = authParamsFromUrl(url ?? '');
  if (params.get('error') || params.get('error_code')) {
    const said = `${params.get('error_code') ?? ''} ${params.get('error_description') ?? ''}`;
    return /expired/i.test(said) ? 'expired' : 'invalid';
  }
  try {
    if (params.get('code') || (params.get('access_token') && params.get('refresh_token'))) {
      const { error } = await completeAuthFromUrl(url ?? '');
      return error ? linkFailure(error) : 'ready';
    }
    const { data } = await getSupabase().auth.getSession();
    return data.session ? 'ready' : 'invalid';
  } catch {
    return 'failed';
  }
}

/** Opens the reset link once per link, for the new-password screen; `retry` opens it again. */
export function useRecoveryLink(url: string | null | undefined): {
  readonly status: RecoveryLinkStatus;
  readonly retry: () => void;
} {
  const [status, setStatus] = useState<RecoveryLinkStatus>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // `undefined` is a link not read yet (the page hasn't looked at its address).
    if (url === undefined) return;
    let active = true;
    setStatus('checking');
    void openRecoveryLink(url).then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, [url, attempt]);
  return { status, retry: () => setAttempt((count) => count + 1) };
}

/**
 * How saving the new password went. `same` and `weak` are Supabase's own refusals; `expired`
 * means the link's session has gone, so a new link is needed.
 */
export type NewPasswordOutcome = 'saved' | 'same' | 'weak' | 'expired' | 'failed';

export async function saveNewPassword(password: string): Promise<NewPasswordOutcome> {
  try {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (!error) return 'saved';
    if (error.code === 'same_password') return 'same';
    if (error.code === 'weak_password') return 'weak';
    if (
      error.name === 'AuthSessionMissingError' ||
      error.status === 401 ||
      error.status === 403 ||
      /session|reauthentication/.test(error.code ?? '')
    ) {
      return 'expired';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
