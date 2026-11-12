import { screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createLocalFeedRepository } from '../../adapters/local/feed-repository';
import { createLocalMarketplaceRepository } from '../../adapters/local/marketplace-repository';
import { renderScreen } from '../../testing/render-screen';
import { FeedProvider } from '../feed/feed-state';
import { buildPreviewMarketListings } from '../marketplace/marketplace-seed';
import { MarketplaceProvider } from '../marketplace/marketplace-state';
import { BackendModeProvider, type BackendMode } from '../session';
import { TrendView } from './TrendView';

const memoryStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

function withListings(children: ReactNode, mode: BackendMode) {
  return (
    <BackendModeProvider mode={mode}>
      <MarketplaceProvider
        repository={createLocalMarketplaceRepository({
          store: memoryStore(),
          viewer: { userId: 'usr_viewer' as never, handle: 'viewer' },
          seedListings: buildPreviewMarketListings(),
          seedSaved: [],
        })}
      >
        <FeedProvider repository={createLocalFeedRepository({ viewerHandle: 'viewer' })}>
          {children}
        </FeedProvider>
      </MarketplaceProvider>
    </BackendModeProvider>
  );
}

describe('TrendView', () => {
  it('says an unknown trend has cooled off, on a device with no project', async () => {
    renderScreen(withListings(<TrendView trendKey="no-such-trend" />, 'device'));

    await waitFor(() => expect(screen.getByText('This trend has cooled off')).toBeOnTheScreen());
    expect(screen.queryByText('Typical price')).toBeNull();
  });

  it('says an unknown trend has cooled off, with a project behind it', async () => {
    renderScreen(withListings(<TrendView trendKey="no-such-trend" />, 'supabase'));

    await waitFor(() => expect(screen.queryByText('Typical price')).toBeNull());
    expect(screen.getByText('This trend has cooled off')).toBeOnTheScreen();
  });

  it('opens a trend that appears after the screen is already showing (no hook-order crash)', async () => {
    // The listings load after the first render, so the screen goes from "no trends" to a trend.
    renderScreen(withListings(<TrendView trendKey="collectibles" />, 'supabase'));

    expect(screen.getByText('This trend has cooled off')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText('Typical price')).toBeOnTheScreen());
  });
});
