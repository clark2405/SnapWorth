import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { PriceAlertsView } from './PriceAlertsView';

describe('PriceAlertsView', () => {
  it('lists each watched listing with the price that sets off its alert', () => {
    renderScreen(<PriceAlertsView />);

    expect(screen.getByText('Under ₱8,100')).toBeOnTheScreen();
    expect(screen.getByText('Under ₱2,350')).toBeOnTheScreen();
    expect(screen.getByText('Under ₱3,400')).toBeOnTheScreen();
  });

  it('opens the listing a row stands for', () => {
    const onOpenListing = jest.fn();
    renderScreen(<PriceAlertsView onOpenListing={onOpenListing} />);

    fireEvent.press(screen.getAllByRole('link')[0]!);

    expect(onOpenListing).toHaveBeenCalledWith('air-jordan-1-bred');
  });

  it('stops watching a listing from its alert sheet', () => {
    renderScreen(<PriceAlertsView />);

    fireEvent.press(screen.getByLabelText('Alert under ₱8,100. Change the price'));
    fireEvent.press(screen.getByRole('button', { name: 'Stop watching' }));

    expect(screen.queryByText('Under ₱8,100')).toBeNull();
    expect(screen.getByText('Under ₱2,350')).toBeOnTheScreen();
  });
});
