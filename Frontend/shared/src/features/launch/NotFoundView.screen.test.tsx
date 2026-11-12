import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { NotFoundView } from './NotFoundView';

describe('NotFoundView', () => {
  it('says the page can’t be found, in the app’s own words, and offers the way back', () => {
    const onGoHome = jest.fn();
    renderScreen(<NotFoundView onGoHome={onGoHome} />);

    expect(screen.getByText('We can’t find that page')).toBeOnTheScreen();
    expect(screen.queryByText(/Unmatched Route|Sitemap/i)).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Back to the feed' }));
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});
