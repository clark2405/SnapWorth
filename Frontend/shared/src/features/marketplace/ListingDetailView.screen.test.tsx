import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { ListingDetailView } from './ListingDetailView';

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
});
