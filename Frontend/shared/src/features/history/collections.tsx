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
import { flipTotals, type FlipTotals } from './flips';

/** A set of the owner's things, like "Film cameras" or "Ukay jackets". */
export interface Collection {
  readonly id: string;
  readonly name: string;
  /** History item ids, in the order they were added. */
  readonly itemIds: readonly string[];
}

/** The longest a collection's name can be. */
export const maximumCollectionName = 40;

/** A name as typed, tidied, or null when there's nothing left of it. */
export function collectionName(text: string): string | null {
  const name = text.replace(/\s+/g, ' ').trim().slice(0, maximumCollectionName).trim();
  return name ? name : null;
}

export interface CollectionTotals {
  /** How many of its items are still in History. */
  readonly count: number;
  readonly worth: number;
  /** The flip across the items with a price paid, when any has one. */
  readonly flip: FlipTotals | null;
}

/** What a collection adds up to. Items no longer in History are left out. */
export function collectionTotals(
  collection: Collection,
  items: readonly { readonly id: string; readonly worth: number }[],
  paidById: Readonly<Record<string, number>>,
): CollectionTotals {
  const inIt = items.filter((item) => collection.itemIds.includes(item.id));
  return {
    count: inIt.length,
    worth: inIt.reduce((total, item) => total + item.worth, 0),
    flip: flipTotals(inIt, paidById),
  };
}

const storageKey = 'snapworth.collections.v1';

interface Collections {
  readonly collections: readonly Collection[];
  /** Makes a collection and returns its id. */
  readonly create: (name: string, itemIds?: readonly string[]) => string;
  readonly rename: (id: string, name: string) => void;
  readonly setItems: (id: string, itemIds: readonly string[]) => void;
  readonly remove: (id: string) => void;
}

const CollectionsContext = createContext<Collections | null>(null);

const newId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function useCollectionsState(): {
  readonly collections: readonly Collection[];
  readonly actions: Collections;
  /** Replaces them all, as loading does; not counted as the owner's change. */
  readonly load: (all: readonly Collection[]) => void;
  /** True once the owner has changed something. */
  readonly touched: { readonly current: boolean };
} {
  const [collections, setCollections] = useState<readonly Collection[]>([]);
  const touched = useRef(false);
  const edit = useCallback((change: (current: readonly Collection[]) => readonly Collection[]) => {
    touched.current = true;
    setCollections(change);
  }, []);
  const load = useCallback((all: readonly Collection[]) => {
    if (!touched.current) setCollections(all);
  }, []);
  const actions = useMemo<Collections>(
    () => ({
      collections,
      create: (name, itemIds = []) => {
        const id = newId();
        edit((current) => [...current, { id, name, itemIds: [...new Set(itemIds)] }]);
        return id;
      },
      rename: (id, name) =>
        edit((current) => current.map((entry) => (entry.id === id ? { ...entry, name } : entry))),
      setItems: (id, itemIds) =>
        edit((current) =>
          current.map((entry) =>
            entry.id === id ? { ...entry, itemIds: [...new Set(itemIds)] } : entry,
          ),
        ),
      remove: (id) => edit((current) => current.filter((entry) => entry.id !== id)),
    }),
    [collections, edit],
  );
  return { collections, actions, load, touched };
}

/**
 * The owner's collections. History is still sample data, so they stay on this device for now,
 * like what was paid; when History is stored in Supabase they move with it. The seed fills a
 * fresh install.
 */
export function CollectionsProvider({
  store,
  seed = [],
  children,
}: {
  readonly store: DeviceStore;
  readonly seed?: readonly Collection[];
  readonly children: ReactNode;
}) {
  const { collections, actions, load, touched } = useCollectionsState();

  useEffect(() => {
    let active = true;
    void store
      .getItem(storageKey)
      .then((saved) => {
        if (active) load(saved ? (JSON.parse(saved) as Collection[]) : seed);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // The seed only matters on the first load, so a new seed object doesn't load again.
  }, [load, store]);

  // Only the owner's own changes are saved; loading or seeding writes nothing.
  useEffect(() => {
    if (touched.current) {
      void store.setItem(storageKey, JSON.stringify(collections)).catch(() => undefined);
    }
  }, [collections, store, touched]);

  return <CollectionsContext.Provider value={actions}>{children}</CollectionsContext.Provider>;
}

/**
 * The owner's collections. Outside a provider (a screen rendered on its own, as in tests) they
 * live only as long as the screen.
 */
export function useCollections(): Collections {
  const context = useContext(CollectionsContext);
  const { actions: fallback } = useCollectionsState();
  return context ?? fallback;
}
