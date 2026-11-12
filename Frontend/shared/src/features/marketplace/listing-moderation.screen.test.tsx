import { screen, waitFor } from '@testing-library/react-native';
import { useEffect, useRef } from 'react';
import { Text } from 'react-native';

import { createLocalMarketplaceRepository } from '../../adapters/local/marketplace-repository';
import type { MarketListing } from '../../ports/marketplace';
import { renderScreen } from '../../testing/render-screen';
import { useSession } from '../session';
import { ListingDetailView } from './ListingDetailView';
import { buildPreviewMarketListings } from './marketplace-seed';
import { MarketplaceProvider, useMarketplace } from './marketplace-state';

const memoryStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

function listing(overrides: Partial<MarketListing>): MarketListing {
  return { ...buildPreviewMarketListings()[0]!, ...overrides };
}

const repositoryOf = (...seed: MarketListing[]) =>
  createLocalMarketplaceRepository({
    store: memoryStore(),
    viewer: { userId: 'usr_viewer' as never, handle: 'viewer' },
    seedListings: seed,
    seedSaved: [],
  });

/** Signs the viewer in, as the app shell does once someone has an account. */
function SignedIn() {
  const { startSession } = useSession();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSession({ id: 'usr_viewer' });
  }, [startSession]);
  return null;
}

function Probe() {
  const { listings, myListings } = useMarketplace();
  return (
    <>
      <Text testID="public">{listings.map((entry) => entry.id).join(',')}</Text>
      <Text testID="mine">{myListings.map((entry) => entry.id).join(',')}</Text>
    </>
  );
}

describe('listing moderation in the app', () => {
  it('keeps a seller’s waiting or held listings out of the Market but in their own list', async () => {
    renderScreen(
      <MarketplaceProvider
        repository={repositoryOf(
          listing({ id: 'live', slug: 'live', rowId: 'r1', moderationStatus: 'approved' }),
          listing({
            id: 'waiting',
            slug: 'waiting',
            rowId: 'r2',
            moderationStatus: 'pending',
            mine: true,
          }),
          listing({ id: 'held', slug: 'held', rowId: 'r3', moderationStatus: 'held', mine: true }),
        )}
      >
        <Probe />
      </MarketplaceProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('public').children.join('')).toBe('live'));
    expect(screen.getByTestId('mine').children.join('')).toBe('waiting,held');
  });

  it.each([
    ['pending', 'Being checked'],
    ['held', 'Held for review'],
  ] as const)('tells a seller their %s listing is only visible to them', async (state, heading) => {
    renderScreen(
      <MarketplaceProvider
        repository={repositoryOf(
          listing({ id: 'mine', slug: 'mine', rowId: 'r2', moderationStatus: state, mine: true }),
        )}
      >
        <SignedIn />
        <ListingDetailView listingId="mine" />
      </MarketplaceProvider>,
    );

    await waitFor(() => expect(screen.getByText(heading)).toBeOnTheScreen());
    expect(screen.getByText(/Only you can see this listing/)).toBeOnTheScreen();
  });

  it('shows no moderation notice on an approved listing', async () => {
    renderScreen(
      <MarketplaceProvider
        repository={repositoryOf(
          listing({
            id: 'mine',
            slug: 'mine',
            rowId: 'r2',
            moderationStatus: 'approved',
            mine: true,
          }),
        )}
      >
        <SignedIn />
        <ListingDetailView listingId="mine" />
      </MarketplaceProvider>,
    );

    await waitFor(() => expect(screen.getByText('Ask the feed')).toBeOnTheScreen());
    expect(screen.queryByText('Being checked')).toBeNull();
    expect(screen.queryByText('Held for review')).toBeNull();
  });
});
