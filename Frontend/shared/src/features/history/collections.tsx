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

import type { AccountObserver } from '../../ports/account';
import type { Collection, CollectionRepository } from '../../ports/collections';
import { newUuid } from '../../types/ids';
import { flipTotals, type FlipTotals } from './flips';

export type { Collection } from '../../ports/collections';

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

interface Collections {
  readonly collections: readonly Collection[];
  /**
   * Makes a collection. Its id comes back at once, so it can be opened straight away; `saved`
   * says whether it was kept.
   */
  readonly create: (
    name: string,
    itemIds?: readonly string[],
  ) => { readonly id: string; readonly saved: Promise<boolean> };
  /** Each change shows at once, and resolves false if it couldn't be kept (and was undone). */
  readonly rename: (id: string, name: string) => Promise<boolean>;
  readonly setItems: (id: string, itemIds: readonly string[]) => Promise<boolean>;
  readonly remove: (id: string) => Promise<boolean>;
}

const CollectionsContext = createContext<Collections | null>(null);

/** What to tell the owner when a change to their collections couldn't be kept. */
export const collectionNotSaved = {
  title: 'Couldn’t save that',
  body: 'Your collections are as they were. Check your connection and try again.',
} as const;

type Change = (current: readonly Collection[]) => readonly Collection[];

/** The actions, as changes to the list on screen plus how each is kept. */
function collectionActions(
  collections: readonly Collection[],
  apply: (
    change: Change,
    keep: (repository: CollectionRepository) => Promise<boolean>,
  ) => Promise<boolean>,
): Collections {
  return {
    collections,
    create: (name, itemIds = []) => {
      const collection: Collection = { id: newUuid(), name, itemIds: [...new Set(itemIds)] };
      const saved = apply(
        (current) => [...current, collection],
        async (repository) => (await repository.create(collection)).ok,
      );
      return { id: collection.id, saved };
    },
    rename: (id, name) =>
      apply(
        (current) => current.map((entry) => (entry.id === id ? { ...entry, name } : entry)),
        async (repository) => (await repository.rename(id, name)).ok,
      ),
    setItems: (id, itemIds) => {
      const unique = [...new Set(itemIds)];
      return apply(
        (current) =>
          current.map((entry) => (entry.id === id ? { ...entry, itemIds: unique } : entry)),
        async (repository) => (await repository.setItems(id, unique)).ok,
      );
    },
    remove: (id) =>
      apply(
        (current) => current.filter((entry) => entry.id !== id),
        async (repository) => (await repository.remove(id)).ok,
      ),
  };
}

/**
 * The owner's collections, kept where the composition root says: in the signed-in account on
 * Supabase, or on this device without a backend. They follow whoever is signed in: signing in as
 * someone else, or out, never shows the last person's. A change shows at once; one that can't
 * be kept is undone by loading the account's collections again.
 */
export function CollectionsProvider({
  account,
  repositoryFor,
  children,
}: {
  readonly account: AccountObserver;
  /** Where an account's collections are kept. */
  readonly repositoryFor: (accountId: string) => CollectionRepository;
  readonly children: ReactNode;
}) {
  // Whose collections: the signed-in account, nobody (null), or not known yet (undefined).
  const [owner, setOwner] = useState<string | null | undefined>(undefined);
  const [collections, setCollections] = useState<readonly Collection[]>([]);
  /** Moves on with each account change and load, so a slower, older load is thrown away. */
  const generation = useRef(0);

  useEffect(() => account.observe(setOwner), [account]);

  const repository = useMemo(
    () => (owner ? repositoryFor(owner) : null),
    // A new function from the same composition root is the same place.
    [owner],
  );

  const reload = useCallback(async () => {
    const mine = ++generation.current;
    if (!repository) return;
    const loaded = await repository.list();
    if (loaded.ok && mine === generation.current) setCollections(loaded.value);
  }, [repository]);

  // A new account starts empty at once, then loads its own.
  useEffect(() => {
    generation.current += 1;
    setCollections([]);
    void reload();
  }, [reload]);

  const apply = useCallback(
    async (change: Change, keep: (repository: CollectionRepository) => Promise<boolean>) => {
      if (!repository) return false;
      generation.current += 1;
      setCollections(change);
      const kept = await keep(repository).catch(() => false);
      if (!kept) await reload();
      return kept;
    },
    [reload, repository],
  );

  const value = useMemo(() => collectionActions(collections, apply), [apply, collections]);
  return <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>;
}

/**
 * The owner's collections. Outside a provider (a screen rendered on its own, as in tests) they
 * live only as long as the screen.
 */
export function useCollections(): Collections {
  const context = useContext(CollectionsContext);
  const [local, setLocal] = useState<readonly Collection[]>([]);
  const applyLocally = useCallback(async (change: Change) => {
    setLocal(change);
    return true;
  }, []);
  const fallback = useMemo(() => collectionActions(local, applyLocally), [applyLocally, local]);
  return context ?? fallback;
}
