import { useCallback } from 'react';

import { useToast } from '@snapworth/shared/components';

/** The public site, when configured; otherwise wherever this page is being served from. */
const webOrigin = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');

/** A link to a page of the site that anyone can open. */
export function linkTo(path: string): string {
  const origin = webOrigin ?? (typeof window === 'undefined' ? '' : window.location.origin);
  return `${origin}${path}`;
}

/**
 * Shares a link to a page: through the device's share sheet where the browser offers one (most
 * phones, Safari), otherwise by copying it. Closing the share sheet is not an error.
 */
export function useShareLink(): (path: string, message: string) => void {
  const toast = useToast();
  return useCallback(
    (path: string, message: string) => {
      const url = linkTo(path);
      const copy = () =>
        navigator.clipboard
          .writeText(url)
          .then(() => toast.show({ title: 'Link copied' }))
          .catch(() => toast.show({ title: 'Copy this link', body: url }));
      if (typeof navigator.share === 'function') {
        navigator
          .share({ text: message, url })
          .then(() => toast.show({ title: 'Link shared' }))
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            void copy();
          });
        return;
      }
      void copy();
    },
    [toast],
  );
}
