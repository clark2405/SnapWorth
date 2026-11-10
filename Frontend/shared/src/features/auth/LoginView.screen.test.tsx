import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { LoginView } from './LoginView';

describe('LoginView: other ways in', () => {
  it('offers Apple only where it has been set up', () => {
    const { rerender } = renderScreen(<LoginView onContinueWithGoogle={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();

    const onContinueWithApple = jest.fn();
    rerender(<LoginView onContinueWithApple={onContinueWithApple} />);
    fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(onContinueWithApple).toHaveBeenCalled();
  });

  it('starts Google sign-in', () => {
    const onContinueWithGoogle = jest.fn();
    renderScreen(<LoginView onContinueWithGoogle={onContinueWithGoogle} />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(onContinueWithGoogle).toHaveBeenCalled();
  });
});
