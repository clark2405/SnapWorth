import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { ConfirmPriceView } from './ConfirmPriceView';
import { ListingDetailView } from './ListingDetailView';
import { SellerProfileView } from '../profile/SellerProfileView';

describe('ListingDetailView', () => {
  it('shares the listing through the shell', () => {
    const onShare = jest.fn();
    renderScreen(<ListingDetailView listingId="polaroid-sun-600" onShare={onShare} />);

    fireEvent.press(screen.getByLabelText('Share this listing'));

    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('offers no share button where the shell cannot make a link', () => {
    renderScreen(<ListingDetailView listingId="polaroid-sun-600" />);

    expect(screen.queryByLabelText('Share this listing')).toBeNull();
  });

  it('opens the listing seller handle when tapping the seller card', () => {
    const onOpenSeller = jest.fn();
    renderScreen(<ListingDetailView listingId="air-jordan-1-bred" onOpenSeller={onOpenSeller} />);

    fireEvent.press(screen.getByText('@justin_v'));

    expect(onOpenSeller).toHaveBeenCalledWith('justin_v');
  });

  it('publishes a listing from ConfirmPriceView with the seller confirmed price', async () => {
    const onPublish = jest.fn();
    renderScreen(<ConfirmPriceView itemId="nike-neon-windbreaker" onPublish={onPublish} />);

    const priceField = screen.getByLabelText('Your asking price in pesos');
    fireEvent.changeText(priceField, '2650');
    fireEvent.press(screen.getByRole('button', { name: 'Publish listing' }));

    await waitFor(() => {
      expect(onPublish).toHaveBeenCalledWith(2650, false, expect.any(String));
    });
  });

  it('renders a seller profile and their active listings by handle', async () => {
    renderScreen(<SellerProfileView handle="mariacruz" />);

    expect(await screen.findByText('Maria Cruz')).toBeOnTheScreen();
    expect(screen.getByText('Vintage Polaroid Sun 600')).toBeOnTheScreen();
  });
});
