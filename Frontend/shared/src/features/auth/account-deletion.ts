import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase, isSupabaseConfigured } from '../../adapters/supabaseClient';

/**
 * The word someone types to delete their account. A typed word rather than their password:
 * people who signed in with Google or Apple have no password to type, and the app must let
 * everyone delete their account. The `delete-account` function checks the word again.
 */
export const deleteConfirmationWord = 'DELETE';

/** Whether what was typed confirms the deletion (any case, spaces around it ignored). */
export function confirmsDeletion(typed: string): boolean {
  return typed.trim().toUpperCase() === deleteConfirmationWord;
}

export type DeleteAccountOutcome =
  { readonly kind: 'deleted' } | { readonly kind: 'failed'; readonly message: string };

const messages = {
  authentication_required: 'Your session has ended. Log in again, then delete your account.',
  confirmation_required: `Type ${deleteConfirmationWord} to confirm.`,
  rate_limited: 'Too many tries. Wait a few minutes, then try again.',
} as const;
const tryAgain = 'Your account couldn’t be deleted. Check your connection and try again.';

function messageFor(code: string): string {
  return Object.hasOwn(messages, code) ? messages[code as keyof typeof messages] : tryAgain;
}

/** What this device keeps for each account, enough to wipe it: AsyncStorage's own shape. */
export interface DeviceStore {
  getAllKeys(): Promise<readonly string[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

/**
 * Forgets this device's copy of an account's data. Anything kept per account is stored under a
 * key ending in `:<account id>` (scan history's offline copy does this), so a new per-account
 * store is wiped too as long as it keeps that shape. Never throws: the account itself is what
 * matters, and it's gone already.
 */
export async function forgetAccountOnDevice(
  store: DeviceStore,
  owners: readonly string[],
): Promise<void> {
  try {
    const keys = await store.getAllKeys();
    const theirs = keys.filter((key) => owners.some((owner) => key.endsWith(`:${owner}`)));
    if (theirs.length) await store.multiRemove(theirs);
  } catch {
    // Storage that can't be read here holds nothing more to wipe.
  }
}

/**
 * Deletes the signed-in account for good: on the server through the `delete-account` function,
 * which removes the person's files and every row of theirs, then this device's session and
 * copies. Without a Supabase project the account only ever lived here, so only this device's
 * copy goes.
 */
export async function deleteAccount(
  typed: string,
  accountId: string | undefined,
  store: DeviceStore = AsyncStorage,
): Promise<DeleteAccountOutcome> {
  if (!confirmsDeletion(typed)) {
    return { kind: 'failed', message: messages.confirmation_required };
  }
  if (!isSupabaseConfigured()) {
    // Without a backend, scans are kept for the device as a whole (see ScanHistoryProvider).
    await forgetAccountOnDevice(store, ['device', ...(accountId ? [accountId] : [])]);
    return { kind: 'deleted' };
  }

  try {
    const client = getSupabase();
    const { data } = await client.auth.getSession();
    if (!data.session) return { kind: 'failed', message: messages.authentication_required };
    const owner = data.session.user.id;

    const response = await client.functions.invoke<{ deleted?: boolean }>('delete-account', {
      body: { confirm: deleteConfirmationWord },
    });
    if (response.error || response.data?.deleted !== true) {
      return { kind: 'failed', message: messageFor(await codeOf(response.error)) };
    }

    // The account is gone on the server, so its session only needs forgetting here.
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await forgetAccountOnDevice(store, [owner]);
    return { kind: 'deleted' };
  } catch {
    return { kind: 'failed', message: tryAgain };
  }
}

/** The function's error code, from the JSON body of its reply (if it sent one). */
async function codeOf(error: unknown): Promise<string> {
  try {
    const context = (error as { context?: unknown } | null)?.context;
    if (context instanceof Response) {
      const body = await context.json();
      return typeof body?.code === 'string' ? body.code : '';
    }
  } catch {
    // An offline or undeployed function may not answer with JSON.
  }
  return '';
}
