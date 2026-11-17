import { fireEvent, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';

import { createLocalMarketplaceRepository } from '../../adapters/local/marketplace-repository';
import { buildPreviewMarketListings } from '../marketplace/marketplace-seed';
import { MarketplaceProvider } from '../marketplace/marketplace-state';
import { useSession } from '../session';
import { renderScreen } from '../../testing/render-screen';
import { SellerProfileView } from './SellerProfileView';

const memoryStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: async (key: string) => {
      map.delete(key);
    },
  };
};

function SignedIn({ children }: { readonly children: ReactNode }) {
  const { startSession } = useSession();
  useEffect(() => startSession(), [startSession]);
  return <>{children}</>;
}

function profileOf(handle: string, onMessage: (slug: string) => void) {
  renderScreen(
    <MarketplaceProvider
      repository={createLocalMarketplaceRepository({
        store: memoryStore(),
        seedListings: buildPreviewMarketListings(),
        seedSaved: [],
      })}
    >
      <SignedIn>
        <SellerProfileView handle={handle} onMessage={onMessage} />
      </SignedIn>
    </MarketplaceProvider>,
  );
}

it('messages a seller about one of their listings from their profile', async () => {
  const listing = buildPreviewMarketListings().find((entry) => entry.status === 'active')!;
  const onMessage = jest.fn();
  profileOf(listing.seller.handle, onMessage);

  const [underListing] = await screen.findAllByRole('button', { name: 'Message' });
  fireEvent.press(underListing!);
  expect(onMessage).toHaveBeenCalledTimes(1);
  expect(typeof onMessage.mock.calls[0]![0]).toBe('string');

  expect(
    screen.getByRole('button', { name: `Message @${listing.seller.handle}` }),
  ).toBeOnTheScreen();
});
