import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { HelpView } from './HelpView';

describe('HelpView', () => {
  it('opens one answer at a time', () => {
    renderScreen(<HelpView />);
    const photos = screen.getByRole('button', { name: 'How many photos can a listing have?' });
    const votes = screen.getByRole('button', { name: 'How do votes work?' });

    fireEvent.press(photos);
    expect(screen.getByText(/Up to four: the cover and three more/)).toBeOnTheScreen();

    fireEvent.press(votes);
    expect(screen.queryByText(/Up to four: the cover and three more/)).toBeNull();
    expect(screen.getByText(/the price is too high, just right or too low/)).toBeOnTheScreen();
  });

  it('hands anything it cannot answer to Worthy', () => {
    const onAskWorthy = jest.fn();
    renderScreen(<HelpView onAskWorthy={onAskWorthy} />);

    fireEvent.press(screen.getByText('Ask Worthy'));

    expect(onAskWorthy).toHaveBeenCalledTimes(1);
  });
});
