import type { Unsubscribe } from './platform';

/**
 * Who is signed in, for what's kept per account. `observe` answers with their id as soon as it's
 * known, again on every sign-in and sign-out, and with null while nobody is signed in.
 */
export interface AccountObserver {
  observe(listener: (accountId: string | null) => void): Unsubscribe;
}
