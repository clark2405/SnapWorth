import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { AccountObserver } from '../../ports/account';
import type { CollectionRepository } from '../../ports/collections';
import { err } from '../../types/result';

import { createLocalCollectionRepository, deviceAccount } from '../../adapters';
import { renderScreen } from '../../testing/render-screen';
import {
  collectionName,
  collectionTotals,
  CollectionsProvider,
  useCollections,
  type Collection,
} from './collections';
import { CollectionView } from './CollectionView';
import { CollectionsStrip } from './CollectionsStrip';
import { PaidPricesProvider } from './paid-prices';

function memoryStore(saved: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(saved).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    data,
    getItem: (key: string) => Promise.resolve(data.get(key) ?? null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

const jackets: Collection = {
  id: 'jackets',
  name: 'Ukay jackets',
  itemIds: ['nike-neon-windbreaker', 'black-puffer-jacket'],
};

function Providers({
  children,
  collections = [jackets],
  store = memoryStore(),
}: {
  readonly children: ReactNode;
  readonly collections?: readonly Collection[];
  readonly store?: ReturnType<typeof memoryStore>;
}) {
  return (
    <PaidPricesProvider store={memoryStore()} seed={{ 'nike-neon-windbreaker': 180 }}>
      <CollectionsProvider
        account={deviceAccount}
        repositoryFor={() => createLocalCollectionRepository({ store, seed: collections })}
      >
        {children}
      </CollectionsProvider>
    </PaidPricesProvider>
  );
}

it('tidies a name, and turns down an empty one', () => {
  expect(collectionName('  Film   cameras ')).toBe('Film cameras');
  expect(collectionName('   ')).toBeNull();
});

it('adds up only the things still in History', () => {
  const items = [
    { id: 'a', worth: 1000 },
    { id: 'b', worth: 500 },
  ];
  expect(
    collectionTotals({ id: 'c', name: 'C', itemIds: ['a', 'gone'] }, items, { a: 200 }),
  ).toEqual({ count: 1, worth: 1000, flip: { count: 1, paid: 200, worth: 1000, gain: 800 } });
});

it('shows what a collection is worth, and the flip on the things with a price paid', async () => {
  renderScreen(
    <Providers>
      <CollectionView collectionId="jackets" />
    </Providers>,
  );

  // ₱2,450 + ₱2,700, with ₱180 paid for the windbreaker.
  expect(await screen.findByText('2 items · paid ₱180 for 1 of them')).toBeOnTheScreen();
  expect(screen.getByText('+₱2,270 flip')).toBeOnTheScreen();
  await waitFor(() => expect(screen.getByText('₱5,150')).toBeOnTheScreen(), { timeout: 2000 });
});

it('takes a thing out, and saves the change', async () => {
  const store = memoryStore();
  renderScreen(
    <Providers store={store}>
      <CollectionView collectionId="jackets" />
    </Providers>,
  );

  fireEvent.press(
    await screen.findByLabelText('Take Black Quilted Puffer Jacket out of this collection'),
  );

  expect(await screen.findByText('1 item · paid ₱180 for 1 of them')).toBeOnTheScreen();
  await waitFor(() =>
    expect(JSON.parse(store.data.get('snapworth.collections.v1') ?? '[]')).toEqual([
      { ...jackets, itemIds: ['nike-neon-windbreaker'] },
    ]),
  );
});

it('deletes a collection and leaves its page', async () => {
  const onDeleted = jest.fn();
  renderScreen(
    <Providers>
      <CollectionView collectionId="jackets" onDeleted={onDeleted} />
    </Providers>,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Delete collection' }));

  expect(onDeleted).toHaveBeenCalled();
});

it('makes a new collection from History and opens it', async () => {
  const onOpenCollection = jest.fn();
  renderScreen(
    <Providers collections={[]}>
      <CollectionsStrip
        items={[
          {
            id: 'lamp',
            title: 'Brass lamp',
            worth: 900,
            photo: { uri: 'https://example.test/lamp.jpg' },
            photoLabel: 'A brass lamp',
          },
        ]}
        onOpenCollection={onOpenCollection}
      />
    </Providers>,
  );

  fireEvent.press(screen.getByRole('button', { name: 'New collection' }));
  fireEvent.changeText(screen.getByLabelText('Collection name'), 'Lamps');
  fireEvent.press(screen.getByRole('button', { name: 'Make collection' }));

  await waitFor(() => expect(onOpenCollection).toHaveBeenCalled());
  expect(await screen.findByLabelText('Lamps, 0 items, worth ₱0')).toBeOnTheScreen();
});

/** Sign-ins the test controls. */
function fakeAccount(first: string | null) {
  let listener: ((accountId: string | null) => void) | null = null;
  const account: AccountObserver = {
    observe(next) {
      listener = next;
      next(first);
      return () => (listener = null);
    },
  };
  return { account, signIn: (accountId: string | null) => listener?.(accountId) };
}

it('shows each account only its own collections, and nothing once signed out', async () => {
  const { account, signIn } = fakeAccount('ana');
  const stores: Record<string, ReturnType<typeof memoryStore>> = {
    ana: memoryStore({ 'snapworth.collections.v1': [{ id: 'a', name: 'Ana’s', itemIds: [] }] }),
    ben: memoryStore({ 'snapworth.collections.v1': [{ id: 'b', name: 'Ben’s', itemIds: [] }] }),
  };
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <CollectionsProvider
      account={account}
      repositoryFor={(accountId) => createLocalCollectionRepository({ store: stores[accountId]! })}
    >
      {children}
    </CollectionsProvider>
  );
  const { result } = renderHook(() => useCollections(), { wrapper });
  await waitFor(() => expect(result.current.collections.map((c) => c.name)).toEqual(['Ana’s']));

  act(() => signIn('ben'));
  // Ana's leave at once, then Ben's arrive.
  expect(result.current.collections).toEqual([]);
  await waitFor(() => expect(result.current.collections.map((c) => c.name)).toEqual(['Ben’s']));

  act(() => signIn(null));
  expect(result.current.collections).toEqual([]);
  expect(await result.current.rename('b', 'Taken')).toBe(false);
});

it('undoes a change that couldn’t be kept, and says so', async () => {
  const kept = createLocalCollectionRepository({ store: memoryStore(), seed: [] });
  const offline: CollectionRepository = {
    ...kept,
    create: () =>
      Promise.resolve(err({ kind: 'offline', operation: 'save_collection', retryable: true })),
  };
  renderScreen(
    <CollectionsProvider account={deviceAccount} repositoryFor={() => offline}>
      <CollectionsStrip items={[]} />
    </CollectionsProvider>,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'New collection' }));
  fireEvent.changeText(screen.getByLabelText('Collection name'), 'Lamps');
  fireEvent.press(screen.getByRole('button', { name: 'Make collection' }));

  expect(await screen.findByText('Couldn’t save that')).toBeOnTheScreen();
  await waitFor(() => expect(screen.queryByLabelText('Lamps, 0 items, worth ₱0')).toBeNull());
});
