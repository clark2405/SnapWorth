import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { previewRecentSearches } from '../preview/sample-data';
import { useSession } from '../session';
import { useBackendMode } from '../session/backend-mode';
import { withRecentSearch } from './recent-terms';

export { maxRecentSearches, withRecentSearch } from './recent-terms';

const storageKey = (account: string) => `snapworth.recent-searches.v1:${account}`;

/**
 * What this person recently searched for, kept on this device under their account (a guest has a
 * list of their own), so another account on a shared phone never sees it. With no Supabase
 * project the list starts from a few sample terms, so the app can be tried out; with one it
 * starts empty.
 */
export function useRecentSearches(): {
  readonly recents: readonly string[];
  readonly add: (term: string) => void;
  readonly clear: () => void;
} {
  const { user } = useSession();
  const mode = useBackendMode();
  const account = user?.id ?? 'guest';
  const [recents, setRecents] = useState<readonly string[]>([]);

  useEffect(() => {
    let active = true;
    setRecents([]);
    AsyncStorage.getItem(storageKey(account))
      .then((stored) => {
        if (!active) return;
        const parsed: unknown = stored ? JSON.parse(stored) : null;
        if (Array.isArray(parsed)) {
          setRecents(parsed.filter((entry): entry is string => typeof entry === 'string'));
        } else if (mode === 'device') {
          setRecents(previewRecentSearches);
        }
      })
      .catch(() => {
        if (active && mode === 'device') setRecents(previewRecentSearches);
      });
    return () => {
      active = false;
    };
  }, [account, mode]);

  const save = useCallback(
    (next: readonly string[]) => {
      setRecents(next);
      AsyncStorage.setItem(storageKey(account), JSON.stringify(next)).catch(() => undefined);
    },
    [account],
  );

  const add = useCallback(
    (term: string) => {
      setRecents((current) => {
        const next = withRecentSearch(current, term);
        if (next !== current) {
          AsyncStorage.setItem(storageKey(account), JSON.stringify(next)).catch(() => undefined);
        }
        return next;
      });
    },
    [account],
  );

  const clear = useCallback(() => save([]), [save]);

  return { recents, add, clear };
}
