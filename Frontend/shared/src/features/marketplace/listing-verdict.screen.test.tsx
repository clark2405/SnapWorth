import { screen, waitFor } from '@testing-library/react-native';

import { createLocalMarketplaceRepository } from '../../adapters/local/marketplace-repository';
import type { MarketListing } from '../../ports/marketplace';
import { renderScreen } from '../../testing/render-screen';
import { ListingCard } from './ListingCard';
import { ListingDetailView } from './ListingDetailView';
import { MarketplaceProvider } from './marketplace-state';
import { buildPreviewMarketListings } from './marketplace-seed';

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

function listing(overrides: Partial<MarketListing>): MarketListing {
  return { ...buildPreviewMarketListings()[0]!, ...overrides };
}

const card = (verdict: MarketListing['verdict'], verdictShare: number | null) => ({
  id: 'x',
  title: 'Pentax K1000',
  askingPrice: 4500,
  photo: 1,
  photoLabel: 'A camera',
  verdict,
  verdictShare,
});

describe('community verdict', () => {
  it('shows no verdict chip on a card nobody has voted on', () => {
    renderScreen(<ListingCard listing={card(null, null)} onOpen={() => undefined} />);

    expect(screen.queryByText(/Just Right|Too High|Too Low/)).toBeNull();
    expect(screen.getByText('₱4,500')).toBeOnTheScreen();
  });

  it('shows the voters’ verdict on a card that has votes', () => {
    renderScreen(<ListingCard listing={card('too_high', 62)} onOpen={() => undefined} />);

    expect(screen.getByText('62% Too High')).toBeOnTheScreen();
  });

  it('says there are no votes on the listing page of a new listing', async () => {
    const repository = createLocalMarketplaceRepository({
      store: memoryStore(),
      viewer,
      seedListings: [
        listing({ id: 'fresh', slug: 'fresh', rowId: 'r1', verdict: null, verdictShare: null }),
      ],
      seedSaved: [],
    });
    renderScreen(
      <MarketplaceProvider repository={repository}>
        <ListingDetailView listingId="fresh" />
      </MarketplaceProvider>,
    );

    await waitFor(() => expect(screen.getByText('No votes on this price yet.')).toBeOnTheScreen());
    expect(screen.queryByText(/% Just Right/)).toBeNull();
  });

  it('shows the share on the listing page once there are votes', async () => {
    const repository = createLocalMarketplaceRepository({
      store: memoryStore(),
      viewer,
      seedListings: [
        listing({ id: 'voted', slug: 'voted', rowId: 'r2', verdict: 'too_low', verdictShare: 71 }),
      ],
      seedSaved: [],
    });
    renderScreen(
      <MarketplaceProvider repository={repository}>
        <ListingDetailView listingId="voted" />
      </MarketplaceProvider>,
    );

    await waitFor(() => expect(screen.getByText('71% Too Low')).toBeOnTheScreen());
    expect(screen.queryByText('No votes on this price yet.')).toBeNull();
  });
});
