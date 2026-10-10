import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { EstimateResultView } from './EstimateResultView';

describe('EstimateResultView', () => {
  it('treats a fresh snap as private, whatever the preview item it reuses', () => {
    const onListForSale = jest.fn();
    renderScreen(
      <EstimateResultView
        presentation="sheet"
        itemId="nike-neon-windbreaker"
        onListForSale={onListForSale}
      />,
    );

    expect(screen.getByText('Private')).toBeOnTheScreen();
    expect(screen.queryByText('Listed')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Sell' }));
    expect(onListForSale).toHaveBeenCalledTimes(1);
  });

  it('opens the listing of an item already for sale, from History', () => {
    const onViewListing = jest.fn();
    renderScreen(
      <EstimateResultView itemId="nike-neon-windbreaker" onViewListing={onViewListing} />,
    );

    expect(screen.getByText('Listed')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'View listing' }));
    expect(onViewListing).toHaveBeenCalledWith('nike-neon-windbreaker');
  });

  it('names the snap while it is valued and keeps the photo saved', () => {
    renderScreen(<EstimateResultView presentation="sheet" status="estimating" />);

    expect(screen.getByText('New snap')).toBeOnTheScreen();
    expect(screen.getByText('Photo saved to your history')).toBeOnTheScreen();
  });

  it('offers another try when the estimate fails', () => {
    const onRetry = jest.fn();
    renderScreen(<EstimateResultView status="failed" onRetry={onRetry} />);

    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
