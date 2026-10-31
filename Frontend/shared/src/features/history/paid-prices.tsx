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

import type { DeviceStore } from './device-store';

/** Where the prices are kept. */
export type PaidPriceStore = DeviceStore;

const storageKey = 'snapworth.paid-prices.v1';

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

/**
 * What the owner paid for their things, for the flip tracker. History is still sample data, so
 * these stay on this device for now; when History is stored in Supabase they move there, private
 * to the owner. The composition root supplies the store, and the seed fills a fresh install.
 */
export function PaidPricesProvider({
  store,
  seed = {},
  children,
}: {
  readonly store: PaidPriceStore;
  readonly seed?: Readonly<Record<string, number>>;
  readonly children: ReactNode;
}) {
  const [paid, setPaidState] = useState<Readonly<Record<string, number>>>({});
  // A change made before the stored prices have loaded is kept, not overwritten by them.
  const touched = useRef(false);

  useEffect(() => {
    let active = true;
    void store
      .getItem(storageKey)
      .then((saved) => {
        if (!active || touched.current) return;
        setPaidState(saved ? (JSON.parse(saved) as Record<string, number>) : seed);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // The seed only matters on the first load, so a new seed object doesn't load again.
  }, [store]);

  // Only the owner's own changes are saved; loading or seeding writes nothing.
  useEffect(() => {
    if (touched.current)
      void store.setItem(storageKey, JSON.stringify(paid)).catch(() => undefined);
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
 * What the owner paid for their things. Outside a provider (a screen rendered on its own, as in
 * tests) the prices live only as long as the screen.
 */
export function usePaidPrices(): PaidPrices {
  const context = useContext(PaidPricesContext);
  const [local, setLocal] = useState<Readonly<Record<string, number>>>({});
  const setLocalPaid = useCallback(
    (itemId: string, amount: number | null) =>
      setLocal((current) =>
        amount === null ? without(current, itemId) : { ...current, [itemId]: amount },
      ),
    [],
  );
  const fallback = useMemo(() => ({ paid: local, setPaid: setLocalPaid }), [local, setLocalPaid]);
  return context ?? fallback;
}
