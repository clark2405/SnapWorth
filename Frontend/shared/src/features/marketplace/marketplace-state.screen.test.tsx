import { act, waitFor } from '@testing-library/react-native';

import { createLocalMarketplaceRepository } from '../../adapters/local/marketplace-repository';
import type { MarketListing, MarketplaceRepository } from '../../ports/marketplace';
import { renderScreen } from '../../testing/render-screen';
import { err } from '../../types/result';
import { buildPreviewMarketListings } from './marketplace-seed';
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
