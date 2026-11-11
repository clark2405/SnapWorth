import { screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createLocalMarketplaceRepository } from '../../adapters/local/marketplace-repository';
import { renderScreen } from '../../testing/render-screen';
import { SellerProfileView } from '../profile/SellerProfileView';
import { BackendModeProvider } from '../session/backend-mode';
import { ListingDetailView } from './ListingDetailView';
import { buildPreviewMarketListings, sampleListingPhoto } from './marketplace-seed';
import { MarketplaceProvider, listingPhotoSource } from './marketplace-state';

const memoryStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

/** A Supabase-backed Market with nothing in it, the way a fresh project looks. */
const emptyBackend = () =>
  createLocalMarketplaceRepository({
    store: memoryStore(),
    viewer: { userId: 'usr_viewer' as never, handle: 'viewer' },
    seedListings: [],
    seedSaved: [],
  });

const withBackend = (children: ReactNode) => (
  <BackendModeProvider mode="supabase">
    <MarketplaceProvider repository={emptyBackend()}>{children}</MarketplaceProvider>
  </BackendModeProvider>
);

describe('sample content stays out of a backed Market', () => {
  it('says a listing isn’t available instead of showing a sample one', async () => {
    renderScreen(withBackend(<ListingDetailView listingId="no-such-listing" />));

    await waitFor(() => expect(screen.getByText('This listing isn’t available')).toBeOnTheScreen());
    expect(screen.queryByText('Vintage Polaroid Sun 600')).toBeNull();
  });

  it('says a seller isn’t found instead of showing a sample seller', async () => {
    renderScreen(withBackend(<SellerProfileView handle="mariacruz" />));

    await waitFor(() => expect(screen.getByText('Seller not found')).toBeOnTheScreen());
    expect(screen.queryByText('Maria Cruz')).toBeNull();
  });

  it('gives a real listing with no photo a placeholder, never a sample photo', () => {
    const [sample] = buildPreviewMarketListings();
    expect(sampleListingPhoto(sample!)).not.toBeNull();
    expect(
      listingPhotoSource({
        id: 'polaroid-sun-600',
        slug: 'polaroid-sun-600',
        rowId: '00000000-0000-4000-fc00-000000000001',
        photoUrl: null,
      }),
    ).toBeNull();
    expect(
      listingPhotoSource({
        id: 'x',
        slug: 'x',
        rowId: 'r',
        photoUrl: 'https://signed.test/x.jpg',
      }),
    ).toEqual({ uri: 'https://signed.test/x.jpg' });
  });
});
