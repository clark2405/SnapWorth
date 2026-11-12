import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createLocalMarketplaceRepository } from '../../adapters/local/marketplace-repository';
import type { AccountObserver } from '../../ports/account';
import type { MarketListing, MarketplaceRepository } from '../../ports/marketplace';
import { renderScreen } from '../../testing/render-screen';
import { err, ok } from '../../types/result';
import { buildPreviewMarketListings } from './marketplace-seed';
import { MarketplaceView } from './MarketplaceView';
import { MarketplaceProvider, useMarketplace, type MarketplaceState } from './marketplace-state';

const viewer = { userId: 'usr_viewer' as never, handle: 'viewer' };
const memoryStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

const offline = { kind: 'offline', operation: 'load_marketplace', retryable: true } as const;

function localRepository() {
  const listings: MarketListing[] = buildPreviewMarketListings().slice(0, 2);
  return {
    listings,
    repository: createLocalMarketplaceRepository({
      store: memoryStore(),
      viewer,
      seedListings: listings,
      seedSaved: [],
    }),
  };
}

/** Mounts the provider the way the shells do and hands back what `useMarketplace` says now. */
function mountMarket(repository: MarketplaceRepository) {
  const result: { current: MarketplaceState } = { current: undefined as never };
  function Probe() {
    result.current = useMarketplace();
    return null;
  }
  renderScreen(
    <MarketplaceProvider repository={repository}>
      <Probe />
    </MarketplaceProvider>,
  );
  return { result };
}

describe('MarketplaceProvider saving', () => {
  it('puts the alert back and returns the error when saving fails', async () => {
    const { repository, listings } = localRepository();
    const failing: MarketplaceRepository = { ...repository, saveListing: async () => err(offline) };
    const { result } = mountMarket(failing);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const id = listings[0]!.id;

    let outcome: Awaited<ReturnType<typeof result.current.toggleSaved>> | undefined;
    await act(async () => {
      outcome = await result.current.toggleSaved(id);
    });

    expect(outcome?.ok).toBe(false);
    expect(result.current.isSaved(id)).toBe(false);
    expect(result.current.savedAlerts).toEqual([]);
  });

  it('restores the earlier alert when changing it fails', async () => {
    const { repository, listings } = localRepository();
    const id = listings[0]!.id;
    await repository.saveListing(id, 1000, true);
    const failing: MarketplaceRepository = { ...repository, saveListing: async () => err(offline) };
    const { result } = mountMarket(failing);
    await waitFor(() => expect(result.current.getAlert(id)).toBeDefined());

    let outcome: Awaited<ReturnType<typeof result.current.saveAlert>> | undefined;
    await act(async () => {
      outcome = await result.current.saveAlert(id, 500, false);
    });

    expect(outcome?.ok).toBe(false);
    expect(result.current.getAlert(id)).toEqual({ listingId: id, alertBelow: 1000, on: true });
  });

  it('keeps a listing saved when unsaving fails', async () => {
    const { repository, listings } = localRepository();
    const id = listings[0]!.id;
    await repository.saveListing(id, 1000, true);
    const failing: MarketplaceRepository = {
      ...repository,
      unsaveListing: async () => err(offline),
    };
    const { result } = mountMarket(failing);
    await waitFor(() => expect(result.current.isSaved(id)).toBe(true));

    let outcome: Awaited<ReturnType<typeof result.current.removeAlert>> | undefined;
    await act(async () => {
      outcome = await result.current.removeAlert(id);
    });

    expect(outcome?.ok).toBe(false);
    expect(result.current.isSaved(id)).toBe(true);
  });

  it('saves and unsaves when the repository agrees', async () => {
    const { repository, listings } = localRepository();
    const id = listings[0]!.id;
    const { result } = mountMarket(repository);
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let saved: Awaited<ReturnType<typeof result.current.toggleSaved>> | undefined;
    await act(async () => {
      saved = await result.current.toggleSaved(id);
    });
    expect(saved).toEqual({ ok: true, value: true });
    expect(result.current.isSaved(id)).toBe(true);

    await act(async () => {
      saved = await result.current.toggleSaved(id);
    });
    expect(saved).toEqual({ ok: true, value: false });
    expect(result.current.isSaved(id)).toBe(false);
  });
});

describe('MarketplaceProvider loading', () => {
  it('says failed, not empty, when the listings cannot be loaded, and recovers on a retry', async () => {
    let failing = true;
    const { repository } = localRepository();
    const flaky: MarketplaceRepository = {
      ...repository,
      list: async () => (failing ? err(offline) : repository.list()),
    };
    const { result } = mountMarket(flaky);
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.listings).toEqual([]);

    failing = false;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.listings.length).toBeGreaterThan(0);
  });

  it('keeps the listings on screen when a later refresh fails', async () => {
    let failing = false;
    const { repository } = localRepository();
    const flaky: MarketplaceRepository = {
      ...repository,
      list: async () => (failing ? err(offline) : repository.list()),
    };
    const { result } = mountMarket(flaky);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const count = result.current.listings.length;

    failing = true;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.listings).toHaveLength(count);
  });
});

describe('MarketplaceView while the Market loads', () => {
  it('offers a retry when the Market could not be loaded, instead of "Nothing here yet"', async () => {
    let failing = true;
    const { repository } = localRepository();
    const flaky: MarketplaceRepository = {
      ...repository,
      list: async () => (failing ? err(offline) : repository.list()),
    };
    renderScreen(
      <MarketplaceProvider repository={flaky}>
        <MarketplaceView />
      </MarketplaceProvider>,
    );

    expect(await screen.findByText('Couldn’t load the market')).toBeOnTheScreen();
    expect(screen.queryByText('Nothing here yet')).toBeNull();
    failing = false;
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText('Couldn’t load the market')).toBeNull());
    expect(screen.queryByText('Nothing here yet')).toBeNull();
  });
});

/** Sign-ins the test controls, the way Supabase's observer announces them. */
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

describe('MarketplaceProvider following the account', () => {
  const [first] = buildPreviewMarketListings();

  /** One listing that is Ana's (with her alert on it); to anyone else it is just a listing. */
  function phone(
    whoIsSignedIn: () => string | null,
    hold?: (asked: string | null) => Promise<void>,
  ) {
    const { repository } = localRepository();
    const listing = (mine: boolean): MarketListing => ({ ...first!, mine });
    const phoneRepository: MarketplaceRepository = {
      ...repository,
      list: async () => {
        const asked = whoIsSignedIn();
        await hold?.(asked);
        return ok([listing(asked === 'ana')]);
      },
      listSaved: async () =>
        ok(whoIsSignedIn() === 'ana' ? [{ listingId: first!.id, alertBelow: 900, on: true }] : []),
    };
    return phoneRepository;
  }

  function mountFor(repository: MarketplaceRepository, account: AccountObserver) {
    const result: { current: MarketplaceState } = { current: undefined as never };
    function Probe() {
      result.current = useMarketplace();
      return null;
    }
    renderScreen(
      <MarketplaceProvider repository={repository} account={account}>
        <Probe />
      </MarketplaceProvider>,
    );
    return { result };
  }

  it('drops the last person’s alerts and own listings at once, then loads the next person’s', async () => {
    let who: string | null = 'ana';
    const { account, signIn } = fakeAccount('ana');
    const { result } = mountFor(
      phone(() => who),
      account,
    );
    await waitFor(() => expect(result.current.isSaved(first!.id)).toBe(true));
    expect(result.current.myListings).toHaveLength(1);

    who = 'ben';
    act(() => signIn('ben'));
    // Straight away, before anything has loaded: nothing of Ana's is left.
    expect(result.current.savedAlerts).toEqual([]);
    expect(result.current.myListings).toEqual([]);
    expect(result.current.listings).toEqual([]);
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.isSaved(first!.id)).toBe(false);
    expect(result.current.myListings).toEqual([]);
    expect(result.current.listings).toHaveLength(1);

    who = 'ana';
    act(() => signIn('ana'));
    await waitFor(() => expect(result.current.isSaved(first!.id)).toBe(true));
    expect(result.current.myListings).toHaveLength(1);
  });

  it('shows nothing of the account after signing out', async () => {
    let who: string | null = 'ana';
    const { account, signIn } = fakeAccount('ana');
    const { result } = mountFor(
      phone(() => who),
      account,
    );
    await waitFor(() => expect(result.current.isSaved(first!.id)).toBe(true));

    who = null;
    act(() => signIn(null));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.savedAlerts).toEqual([]);
    expect(result.current.myListings).toEqual([]);
  });

  it('drops a load still on its way for the last person', async () => {
    let who: string | null = 'ana';
    let releaseAna: () => void = () => undefined;
    const anaGate = new Promise<void>((resolve) => (releaseAna = resolve));
    const { account, signIn } = fakeAccount('ana');
    const { result } = mountFor(
      phone(
        () => who,
        async (asked) => {
          if (asked === 'ana') await anaGate;
        },
      ),
      account,
    );
    who = 'ben';
    act(() => signIn('ben'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      releaseAna();
      await anaGate;
    });
    expect(result.current.myListings).toEqual([]);
    expect(result.current.isSaved(first!.id)).toBe(false);
  });

  it('does not undo or redo a save for the last person on the next person’s screen', async () => {
    let who: string | null = 'ana';
    let releaseSave: () => void = () => undefined;
    const saveGate = new Promise<void>((resolve) => (releaseSave = resolve));
    const { account, signIn } = fakeAccount('ana');
    const base = phone(() => who);
    const slowFailing: MarketplaceRepository = {
      ...base,
      saveListing: async () => {
        await saveGate;
        return err(offline);
      },
    };
    const { result } = mountFor(slowFailing, account);
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.saveAlert(first!.id, 500, true);
    });
    who = 'ben';
    act(() => signIn('ben'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.savedAlerts).toEqual([]);

    await act(async () => {
      releaseSave();
      await pending;
    });
    // Ana's failed save must not put her old alert back for Ben.
    expect(result.current.savedAlerts).toEqual([]);
  });
});
