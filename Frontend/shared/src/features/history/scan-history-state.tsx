import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { previewHistory, type PreviewHistoryItem } from '../preview/sample-data';
import { useBackendMode } from '../session/backend-mode';
import {
  deleteScan,
  formatCapturedDate,
  loadScans,
  newScanId,
  saveScan,
  scanToPreviewItem,
  setScanPaid,
  withoutPrice,
  type KeyValueStore,
  type NewScan,
  type SavedScan,
  type SaveOutcome,
  type ScanPlace,
} from './scan-history';

export interface ScanHistory {
  readonly status: 'loading' | 'ready';
  /** The signed-in account's scans, newest first. */
  readonly scans: readonly SavedScan[];
  /** Saves a successful estimate to History. */
  readonly save: (scan: NewScan) => Promise<SaveOutcome>;
  readonly remove: (scanId: string) => Promise<void>;
  /** Notes what was paid for a scan, or forgets it with `null`. */
  readonly setPaid: (scanId: string, amount: number | null) => Promise<void>;
  /** Loads again, as pull-to-refresh does. */
  readonly reload: () => Promise<void>;
}

const ScanHistoryContext = createContext<ScanHistory | null>(null);

/** Outside a provider (a screen rendered on its own, as in tests) there are no scans. */
const none: ScanHistory = {
  status: 'ready',
  scans: [],
  save: () => Promise.resolve('failed'),
  remove: () => Promise.resolve(),
  setPaid: () => Promise.resolve(),
  reload: () => Promise.resolve(),
};

/**
 * The scans each account has saved, supplied by the composition root. With a backend they're in
 * Supabase, with a copy on the phone for offline; without one, on the phone only. The list
 * follows whoever is signed in: signing in as someone else, or out, never shows the last
 * person's scans.
 */
export function ScanHistoryProvider({
  client,
  store,
  children,
}: {
  readonly client: SupabaseClient | null;
  readonly store: KeyValueStore;
  readonly children: ReactNode;
}) {
  // Whose scans: the signed-in account, nobody (null), or not known yet (undefined).
  const [owner, setOwner] = useState<string | null | undefined>(client ? undefined : 'device');
  const [scans, setScans] = useState<readonly SavedScan[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  /** Moves on with each load and account change, so a slower, older load is thrown away. */
  const generation = useRef(0);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active)
        setOwner((known) => (known === undefined ? (data.session?.user.id ?? null) : known));
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setOwner(session?.user.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const place = useMemo<ScanPlace | null>(
    () => (owner ? { store, client, owner } : null),
    [client, owner, store],
  );

  const reload = useCallback(async () => {
    const mine = ++generation.current;
    if (!place) {
      setScans([]);
      setStatus(owner === undefined ? 'loading' : 'ready');
      return;
    }
    const loaded = await loadScans(place);
    if (mine === generation.current) {
      setScans(loaded);
      setStatus('ready');
    }
  }, [owner, place]);

  // A new account starts empty at once, then loads its own.
  useEffect(() => {
    setScans([]);
    setStatus('loading');
    void reload();
  }, [reload]);

  const save = useCallback(
    async (draft: NewScan): Promise<SaveOutcome> => {
      if (!place) return 'failed';
      const scan: SavedScan = {
        ...draft,
        id: newScanId(),
        capturedOn: formatCapturedDate(),
        status: 'private',
      };
      setScans((current) => [scan, ...current]);
      const outcome = await saveScan(scan, place);
      if (outcome === 'failed')
        setScans((current) => current.filter((item) => item.id !== scan.id));
      return outcome;
    },
    [place],
  );

  const remove = useCallback(
    async (scanId: string) => {
      setScans((current) => current.filter((item) => item.id !== scanId));
      if (place) await deleteScan(scanId, place);
    },
    [place],
  );

  const setPaid = useCallback(
    async (scanId: string, amount: number | null) => {
      setScans((current) =>
        current.map((item) => {
          if (item.id !== scanId) return item;
          const unpriced = withoutPrice(item);
          return amount === null ? unpriced : { ...unpriced, paidPhp: amount };
        }),
      );
      if (place) await setScanPaid(scanId, amount, place);
    },
    [place],
  );

  const value = useMemo<ScanHistory>(
    () => ({ status, scans, save, remove, setPaid, reload }),
    [reload, remove, save, scans, setPaid, status],
  );
  return <ScanHistoryContext.Provider value={value}>{children}</ScanHistoryContext.Provider>;
}

export function useScanHistory(): ScanHistory {
  return useContext(ScanHistoryContext) ?? none;
}

/**
 * The things History holds: the account's own scans. Before the first one, a build with no
 * Supabase project shows the sample items as a preview (never mixed with real scans); with a
 * project there's nothing yet, and History says so.
 */
export function useHistoryItems(): {
  readonly items: readonly PreviewHistoryItem[];
  /** True while the sample items stand in. */
  readonly samples: boolean;
} {
  const { scans } = useScanHistory();
  const mode = useBackendMode();
  return useMemo(
    () =>
      scans.length > 0
        ? { items: scans.map(scanToPreviewItem), samples: false }
        : mode === 'device'
          ? { items: previewHistory, samples: true }
          : { items: [], samples: false },
    [mode, scans],
  );
}
