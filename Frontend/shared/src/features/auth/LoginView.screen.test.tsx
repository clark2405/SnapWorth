import { fireEvent, screen, waitFor } from '@testing-library/react-native';

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

describe('LoginView: checking the form on the screen', () => {
  const fill = (label: string, value: string) =>
    fireEvent.changeText(screen.getByLabelText(label), value);

  const signUp = () => {
    const onSubmit = jest.fn();
    renderScreen(<LoginView initialMode="signup" onSubmit={onSubmit} />);
    return onSubmit;
  };

  it('says when the two passwords differ, on the page, and does not send', () => {
    const onSubmit = signUp();
    fill('Email address', 'sam@example.com');
    fill('Password', 'long-enough-one');
    fill('Confirm Password', 'long-enough-two');

    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('The two passwords don’t match.')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks for the same eight characters the placeholder promises', () => {
    const onSubmit = signUp();
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeOnTheScreen();
    fill('Email address', 'sam@example.com');
    fill('Password', 'short');
    fill('Confirm Password', 'short');

    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Use at least 8 characters for your password.')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('turns away something that is not an email address', () => {
    const onSubmit = signUp();
    fill('Email address', 'notanemail');
    fill('Password', 'long-enough-one');
    fill('Confirm Password', 'long-enough-one');

    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('That doesn’t look like an email address.')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks for both fields on log in, and clears the note once typing resumes', () => {
    const onSubmit = jest.fn();
    renderScreen(<LoginView onSubmit={onSubmit} />);

    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter your email and password.')).toBeOnTheScreen();

    fill('Email address', 'sam@example.com');
    expect(screen.queryByText('Enter your email and password.')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends a form that checks out', async () => {
    const onSubmit = signUp();
    fill('Email address', 'sam@example.com');
    fill('Password', 'long-enough-one');
    fill('Confirm Password', 'long-enough-one');

    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled(), { timeout: 3000 });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      mode: 'signup',
      email: 'sam@example.com',
      password: 'long-enough-one',
    });
  });
});
