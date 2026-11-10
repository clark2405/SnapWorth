import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { AuthCallbackView } from './AuthCallbackView';

describe('AuthCallbackView', () => {
  it('says it is signing in while the sign-in finishes', () => {
    renderScreen(<AuthCallbackView />);

    expect(screen.getByText('Signing you in…')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Back to log in' })).toBeNull();
  });

  it('says why a sign-in did not finish, and goes back to log in', () => {
    const onBackToLogin = jest.fn();
    renderScreen(
      <AuthCallbackView failure="Invalid Refresh Token" onBackToLogin={onBackToLogin} />,
    );

    expect(screen.getByText('Google sign-in didn’t finish.')).toBeOnTheScreen();
    expect(screen.getByText('Invalid Refresh Token')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Back to log in' }));
    expect(onBackToLogin).toHaveBeenCalled();
  });
});
