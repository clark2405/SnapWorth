/**
 * Addresses Supabase sends people back to after an email link or Google, and reading what it
 * sent. Each must be on the project's Redirect URLs list (READ-FIRST "Sign-in setup").
 */

/** A page of this site, as a full address: `https://…/new-password`. */
export function siteLink(path: string): string {
  return `${globalThis.location?.origin ?? ''}/${path.replace(/^\//, '')}`;
}

/**
 * The address this page was opened with, for the tokens or error Supabase put on it.
 * Undefined while the page renders on the server, where there is no address yet.
 */
export function authRedirect(): string | undefined {
  return globalThis.location?.href;
}

/**
 * Wipes the query and hash from the address bar once they've been read, so the tokens don't
 * stay in the history or get copied along with the link.
 */
export function forgetAuthRedirect(): void {
  const location = globalThis.location;
  if (location && (location.search || location.hash)) {
    globalThis.history?.replaceState(null, '', location.pathname);
  }
}
