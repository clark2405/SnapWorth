import { screen, waitFor } from '@testing-library/react-native';
import { useEffect, useRef, type ReactNode } from 'react';

import { createLocalFeedRepository } from '../adapters/local/feed-repository';
import { createLocalMarketplaceRepository } from '../adapters/local/marketplace-repository';
import type { MarketListing } from '../ports/marketplace';
import { renderScreen } from '../testing/render-screen';
import { FeedProvider } from './feed/feed-state';
import { CreatePostView } from './feed/CreatePostView';
import { GuessEntry } from './guess/GuessEntry';
import { GuessView } from './guess/GuessView';
import { HistoryView } from './history/HistoryView';
import { useItemDetail } from './item/item-source';
import { ConfirmPriceView } from './marketplace/ConfirmPriceView';
import { MarketplaceProvider } from './marketplace/marketplace-state';
import { BackendModeProvider, useBackendMode, useSession, type BackendMode } from './session';
import { Text } from 'react-native';

const memoryStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

const marketplaceOf = (...seed: MarketListing[]) =>
  createLocalMarketplaceRepository({
    store: memoryStore(),
    viewer: { userId: 'usr_viewer' as never, handle: 'viewer' },
    seedListings: seed,
    seedSaved: [],
  });

function SignedIn({ children }: { readonly children?: ReactNode }) {
  const { startSession } = useSession();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSession({ id: 'usr_viewer' });
  }, [startSession]);
  return <>{children}</>;
}

/** The app as a Supabase-backed build wires it, with an empty project behind it. */
function backed(
  children: ReactNode,
  mode: BackendMode = 'supabase',
  listings: MarketListing[] = [],
) {
  return (
    <BackendModeProvider mode={mode}>
      <MarketplaceProvider repository={marketplaceOf(...listings)}>
        <FeedProvider repository={createLocalFeedRepository({ viewerHandle: 'viewer' })}>
          {children}
        </FeedProvider>
      </MarketplaceProvider>
    </BackendModeProvider>
  );
}

describe('a Supabase-backed build shows no sample items, prefills or games', () => {
  it('says there is nothing to ask about instead of prefilling the sample item', async () => {
    renderScreen(
      backed(
        <SignedIn>
          <CreatePostView itemId="nike-neon-windbreaker" />
        </SignedIn>,
      ),
    );

    await waitFor(() => expect(screen.getByText('Nothing to ask about')).toBeOnTheScreen());
    expect(screen.queryByLabelText('Your question for the community')).toBeNull();
  });

  it('says there is nothing to list instead of prefilling the sample item', async () => {
    renderScreen(
      backed(
        <SignedIn>
          <ConfirmPriceView itemId="nike-neon-windbreaker" />
        </SignedIn>,
      ),
    );

    await waitFor(() => expect(screen.getByText('Nothing to list here')).toBeOnTheScreen());
    expect(screen.queryByLabelText('Your asking price in pesos')).toBeNull();
  });

  it('opens none of the sample items, even by their ids', () => {
    function Probe({ id }: { readonly id?: string }) {
      return <Text testID="status">{useItemDetail(id).status}</Text>;
    }
    renderScreen(
      <BackendModeProvider mode="supabase">
        <Probe id="nike-neon-windbreaker" />
      </BackendModeProvider>,
    );
    expect(screen.getByTestId('status').children.join('')).toBe('missing');
  });

  it('keeps the sample items for a device with no project', () => {
    function Probe() {
      return <Text testID="status">{useItemDetail('nike-neon-windbreaker').status}</Text>;
    }
    renderScreen(<Probe />);
    expect(screen.getByTestId('status').children.join('')).toBe('found');
  });

  it('has an empty History before the first snap, not the sample items', () => {
    renderScreen(
      <BackendModeProvider mode="supabase">
        <HistoryView />
      </BackendModeProvider>,
    );

    expect(screen.getByText('Nothing snapped yet')).toBeOnTheScreen();
    expect(screen.queryByText('Vintage Polaroid Sun 600')).toBeNull();
  });

  it('offers no Guess the worth until the Market has enough listings to deal a day', async () => {
    renderScreen(backed(<GuessEntry />));
    expect(screen.queryByText('Guess the worth')).toBeNull();

    renderScreen(backed(<GuessView />));
    await waitFor(() => expect(screen.getByText('Not enough to guess yet')).toBeOnTheScreen());
  });

  it('reports the mode the composition root chose', () => {
    function Mode() {
      return <Text testID="mode">{useBackendMode()}</Text>;
    }
    renderScreen(<Mode />);
    expect(screen.getByTestId('mode').children.join('')).toBe('device');
  });
});
