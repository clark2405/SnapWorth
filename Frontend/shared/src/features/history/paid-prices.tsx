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

import { isUuid } from '../../types/ids';
import type { DeviceStore } from './device-store';
import { DEVICE_PAID_PRICES_KEY } from './scan-history';
import { useScanHistory } from './scan-history-state';

/** Where the prices are kept. */
export type PaidPriceStore = DeviceStore;

interface PaidPrices {
  /** What the owner paid for each item they've noted, by item id. */
  readonly paid: Readonly<Record<string, number>>;
  /** Notes what was paid for an item, or forgets it with `null`. */
  readonly setPaid: (itemId: string, amount: number | null) => void;
}

const PaidPricesContext = createContext<PaidPrices | null>(null);

function without(prices: Readonly<Record<string, number>>, itemId: string) {
  return Object.fromEntries(Object.entries(prices).filter(([id]) => id !== itemId));
}

/** The sample items' prices: saved scans keep their own (see `setScanPaid`). */
const samplesOnly = (prices: Readonly<Record<string, number>>) =>
  Object.fromEntries(Object.entries(prices).filter(([id]) => !isUuid(id)));

/**
 * What the owner paid for the sample items History previews before the first scan. A saved
 * scan's price lives on the scan, private to its owner (in Supabase with a backend). With a
 * `store` (no backend) the samples' prices stay on this device; without one they last as long
 * as the app, since a sample isn't anyone's. The seed fills a fresh start.
 */
export function PaidPricesProvider({
  store,
  seed = {},
  children,
}: {
  readonly store?: PaidPriceStore;
  readonly seed?: Readonly<Record<string, number>>;
  readonly children: ReactNode;
}) {
  const [paid, setPaidState] = useState<Readonly<Record<string, number>>>(() =>
    store ? {} : samplesOnly(seed),
  );
  // A change made before the stored prices have loaded is kept, not overwritten by them.
  const touched = useRef(false);

  useEffect(() => {
    if (!store) return;
    let active = true;
    void store
      .getItem(DEVICE_PAID_PRICES_KEY)
      .then((saved) => {
        if (!active || touched.current) return;
        setPaidState(samplesOnly(saved ? (JSON.parse(saved) as Record<string, number>) : seed));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // The seed only matters on the first load, so a new seed object doesn't load again.
  }, [store]);

  // Only the owner's own changes are saved; loading or seeding writes nothing. Scans' prices
  // still waiting there to move onto their scans are left alone.
  useEffect(() => {
    if (!store || !touched.current) return;
    void (async () => {
      const saved = await store.getItem(DEVICE_PAID_PRICES_KEY);
      const waiting = Object.fromEntries(
        Object.entries(saved ? (JSON.parse(saved) as Record<string, number>) : {}).filter(([id]) =>
          isUuid(id),
        ),
      );
      await store.setItem(DEVICE_PAID_PRICES_KEY, JSON.stringify({ ...waiting, ...paid }));
    })().catch(() => undefined);
  }, [paid, store]);

  const setPaid = useCallback((itemId: string, amount: number | null) => {
    touched.current = true;
    setPaidState((current) =>
      amount === null ? without(current, itemId) : { ...current, [itemId]: amount },
    );
  }, []);

  const value = useMemo(() => ({ paid, setPaid }), [paid, setPaid]);
  return <PaidPricesContext.Provider value={value}>{children}</PaidPricesContext.Provider>;
}

/**
 * What the owner paid for their things: the saved scans' own prices, and the sample items'.
 * Outside a provider (a screen rendered on its own, as in tests) the samples' prices live only
 * as long as the screen.
 */
export function usePaidPrices(): PaidPrices {
  const context = useContext(PaidPricesContext);
  const { scans, setPaid: setScanPaid } = useScanHistory();
  const [local, setLocal] = useState<Readonly<Record<string, number>>>({});
  const setLocalPaid = useCallback(
    (itemId: string, amount: number | null) =>
      setLocal((current) =>
        amount === null ? without(current, itemId) : { ...current, [itemId]: amount },
      ),
    [],
  );
  const samples = context ?? { paid: local, setPaid: setLocalPaid };

  const paid = useMemo(() => {
    const ofScans = Object.fromEntries(
      scans.flatMap((scan) => (scan.paidPhp === undefined ? [] : [[scan.id, scan.paidPhp]])),
    );
    return { ...samples.paid, ...ofScans };
  }, [samples.paid, scans]);

  const sampleSetPaid = samples.setPaid;
  const setPaid = useCallback(
    (itemId: string, amount: number | null) => {
      if (scans.some((scan) => scan.id === itemId)) void setScanPaid(itemId, amount);
      else sampleSetPaid(itemId, amount);
    },
    [sampleSetPaid, scans, setScanPaid],
  );

  return useMemo(() => ({ paid, setPaid }), [paid, setPaid]);
}
