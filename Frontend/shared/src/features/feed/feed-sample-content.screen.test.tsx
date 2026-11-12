import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEffect, useRef, type ReactNode } from 'react';

import { createLocalFeedRepository } from '../../adapters/local/feed-repository';
import { createLocalMarketplaceRepository } from '../../adapters/local/marketplace-repository';
import type { MarketListing } from '../../ports/marketplace';
import { renderScreen } from '../../testing/render-screen';
import { FeedProvider } from './feed-state';
import { FeedView } from './FeedView';
import { PostDetailView } from './PostDetailView';
import { buildPreviewMarketListings } from '../marketplace/marketplace-seed';
import { MarketplaceProvider } from '../marketplace/marketplace-state';
import { SearchView } from '../search/SearchView';
import { TrendView } from '../trends/TrendView';
import { BackendModeProvider, useSession, type BackendMode } from '../session';

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

describe('a Supabase-backed Feed, trends and Search show no sample content', () => {
  it('has an empty Feed (no sample posts, no Hot this month row)', async () => {
    renderScreen(backed(<FeedView />));

    await waitFor(() => expect(screen.queryByText('Hot this month')).toBeNull());
    expect(screen.queryByText('Most listed this month')).toBeNull();
    expect(screen.queryByText(/retro 90s Nike teal windbreaker/i)).toBeNull();
  });

  it('says a post isn’t available instead of showing a sample discussion', async () => {
    renderScreen(backed(<PostDetailView postId="no-such-post" />));

    await waitFor(() => expect(screen.getByText('This post isn’t available')).toBeOnTheScreen());
    expect(screen.queryByText(/windbreaker/i)).toBeNull();
  });

  it('gives Search no sample recent searches or trending', async () => {
    renderScreen(backed(<SearchView mode="tab" />));

    await waitFor(() => expect(screen.queryByText('Trending')).toBeNull());
    expect(screen.queryByText('Recent')).toBeNull();
    expect(screen.queryByText('Polaroid')).toBeNull();
  });

  it('keeps the sample recent searches and trending on a device with no project', async () => {
    renderScreen(backed(<SearchView mode="tab" />, 'device', buildPreviewMarketListings()));

    await waitFor(() => expect(screen.getByText('Recent')).toBeOnTheScreen());
    expect(screen.getByText('Trending')).toBeOnTheScreen();
  });

  it('remembers what was searched, under the account', async () => {
    renderScreen(
      backed(
        <SignedIn>
          <SearchView mode="tab" />
        </SignedIn>,
      ),
    );

    fireEvent(await screen.findByLabelText('Search'), 'changeText', 'film camera');
    fireEvent(screen.getByLabelText('Search'), 'submitEditing');
    fireEvent.changeText(screen.getByLabelText('Search'), '');

    await waitFor(() => expect(screen.getByText('film camera')).toBeOnTheScreen());
  });

  it('has no trend to open when nothing has been listed', async () => {
    renderScreen(backed(<TrendView trendKey="film-cameras" />));

    await waitFor(() => expect(screen.getByText('This trend has cooled off')).toBeOnTheScreen());
    expect(screen.queryByText('Film is back in frame.')).toBeNull();
  });
});
