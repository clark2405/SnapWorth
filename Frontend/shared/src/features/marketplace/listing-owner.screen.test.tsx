import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEffect, useRef } from 'react';

import { createLocalMarketplaceRepository } from '../../adapters/local/marketplace-repository';
import type { MarketListing } from '../../ports/marketplace';
import { renderScreen } from '../../testing/render-screen';
import { useSession } from '../session';
import { ConfirmPriceView } from './ConfirmPriceView';
import { ListingDetailView, type ListingDetailViewProps } from './ListingDetailView';
import { buildPreviewMarketListings } from './marketplace-seed';
import { MarketplaceProvider } from './marketplace-state';

const memoryStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

const mine = (overrides: Partial<MarketListing> = {}): MarketListing => ({
  ...buildPreviewMarketListings()[0]!,
  id: 'mine',
  slug: 'mine',
  rowId: 'r-mine',
  moderationStatus: 'approved',
  mine: true,
  ...overrides,
});

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

function owner(listing: MarketListing, props: Partial<ListingDetailViewProps> = {}) {
  return renderScreen(
    <MarketplaceProvider
      repository={createLocalMarketplaceRepository({
        store: memoryStore(),
        viewer: { userId: 'usr_viewer' as never, handle: 'viewer' },
        seedListings: [listing],
        seedSaved: [],
      })}
    >
      <SignedIn />
      <ListingDetailView listingId={listing.id} {...props} />
    </MarketplaceProvider>,
  );
}

describe('the owner’s listing page: a sold listing', () => {
  it('shows a Sold marker and Mark available once the listing is marked sold', async () => {
    const onMarkSold = jest.fn();
    owner(mine(), { onMarkSold });

    expect(await screen.findByRole('button', { name: 'Mark as sold' })).toBeOnTheScreen();
    expect(screen.queryByText('Sold')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Mark as sold' }));

    await waitFor(() => expect(screen.getByText('Sold')).toBeOnTheScreen());
    expect(onMarkSold).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Mark available' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete listing' })).toBeOnTheScreen();
    // What no longer makes sense once it has sold.
    expect(screen.queryByRole('button', { name: 'Mark as sold' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit price' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask the feed' })).toBeNull();
  });

  it('puts a sold listing back on sale', async () => {
    owner(mine({ status: 'sold' }));

    expect(await screen.findByText('Sold')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Mark available' }));

    expect(await screen.findByRole('button', { name: 'Mark as sold' })).toBeOnTheScreen();
    expect(screen.queryByText('Sold')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit price' })).toBeOnTheScreen();
  });

  it('shows no Sold marker on a listing still for sale', async () => {
    owner(mine());

    expect(await screen.findByRole('button', { name: 'Edit price' })).toBeOnTheScreen();
    expect(screen.queryByText('Sold')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark available' })).toBeNull();
  });
});

describe('the owner’s listing page: deleting', () => {
  it('asks before deleting, and keeps the listing when told to', async () => {
    const onDeleteListing = jest.fn();
    owner(mine(), { onDeleteListing });

    fireEvent.press(await screen.findByRole('button', { name: 'Delete listing' }));

    expect(await screen.findByText('Delete this listing?')).toBeOnTheScreen();
    expect(onDeleteListing).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Keep listing' }));
    await waitFor(() => expect(screen.queryByText('Delete this listing?')).toBeNull());
    expect(onDeleteListing).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit price' })).toBeOnTheScreen();
  });

  it('deletes only once it is confirmed', async () => {
    const onDeleteListing = jest.fn();
    owner(mine(), { onDeleteListing });

    fireEvent.press(await screen.findByRole('button', { name: 'Delete listing' }));
    await screen.findByText('Delete this listing?');
    // The sheet's own button comes last; the one behind it is the page's.
    const buttons = screen.getAllByRole('button', { name: 'Delete listing' });
    fireEvent.press(buttons[buttons.length - 1]!);

    await waitFor(() => expect(onDeleteListing).toHaveBeenCalledTimes(1));
  });

  it('asks on a sold listing too', async () => {
    owner(mine({ status: 'sold' }), { onDeleteListing: jest.fn() });

    fireEvent.press(await screen.findByRole('button', { name: 'Delete listing' }));

    expect(await screen.findByText('Delete this listing?')).toBeOnTheScreen();
  });
});

describe('editing a listing', () => {
  const editor = (itemId: string, listing: MarketListing) =>
    renderScreen(
      <MarketplaceProvider
        repository={createLocalMarketplaceRepository({
          store: memoryStore(),
          viewer: { userId: 'usr_viewer' as never, handle: 'viewer' },
          seedListings: [listing],
          seedSaved: [],
        })}
      >
        <SignedIn />
        <ConfirmPriceView itemId={itemId} />
      </MarketplaceProvider>,
    );

  it('says Save changes, not Publish listing, for a listing that already exists', async () => {
    editor('mine', mine());

    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Publish listing' })).toBeNull();
  });
});
