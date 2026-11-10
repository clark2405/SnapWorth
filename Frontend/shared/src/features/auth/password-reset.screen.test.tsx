import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { NewPasswordView } from './NewPasswordView';
import { ResetPasswordView } from './ResetPasswordView';

describe('ResetPasswordView', () => {
  it('gives the same answer whatever the email, without saying if it has an account', async () => {
    const onSendLink = jest.fn().mockResolvedValue('sent');
    renderScreen(<ResetPasswordView onSendLink={onSendLink} />);

    fireEvent.changeText(screen.getByLabelText('Email address'), ' ana@example.com ');
    fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));

    expect(
      await screen.findByText(/If ana@example.com has an account, a reset link is on its way/),
    ).toBeOnTheScreen();
    expect(onSendLink).toHaveBeenCalledWith('ana@example.com');
  });

  it('says when the link could not be sent', async () => {
    renderScreen(<ResetPasswordView onSendLink={() => 'failed'} />);

    fireEvent.changeText(screen.getByLabelText('Email address'), 'ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/The link could not be sent/)).toBeOnTheScreen();
  });

  it('says plainly that reset is unavailable without a server, and sends nothing', () => {
    const onSendLink = jest.fn();
    renderScreen(<ResetPasswordView unavailable onSendLink={onSendLink} />);

    expect(screen.getByText(/Password reset isn’t available in this build/)).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('Email address'), 'ana@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    expect(onSendLink).not.toHaveBeenCalled();
  });
});

describe('NewPasswordView', () => {
  const fill = (password: string, confirmation = password) => {
    fireEvent.changeText(screen.getByLabelText('New password'), password);
    fireEvent.changeText(screen.getByLabelText('Confirm new password'), confirmation);
    fireEvent.press(screen.getByRole('button', { name: 'Save password' }));
  };

  it('saves a new password and goes on into the app', async () => {
    const onSave = jest.fn().mockResolvedValue('saved');
    const onDone = jest.fn();
    renderScreen(<NewPasswordView link="ready" onSave={onSave} onDone={onDone} />);

    fill('a-much-better-one');

    expect(await screen.findByText('Password changed.')).toBeOnTheScreen();
    expect(onSave).toHaveBeenCalledWith('a-much-better-one');
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('checks the password is long enough and typed the same twice before saving', () => {
    const onSave = jest.fn();
    renderScreen(<NewPasswordView link="ready" onSave={onSave} />);

    fill('short');
    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();

    fill('long-enough-one', 'long-enough-two');
    expect(screen.getByText('The two passwords don’t match.')).toBeOnTheScreen();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('explains a password Supabase refused', async () => {
    renderScreen(<NewPasswordView link="ready" onSave={() => 'same'} />);

    fill('the-old-password');

    expect(await screen.findByText(/That’s the password you have now/)).toBeOnTheScreen();
  });

  it('offers a new link when the link has expired, even if that’s found on saving', async () => {
    const onRequestNewLink = jest.fn();
    const { rerender } = renderScreen(
      <NewPasswordView link="expired" onRequestNewLink={onRequestNewLink} />,
    );
    expect(screen.getByText('This link has expired.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Send a new link' }));
    expect(onRequestNewLink).toHaveBeenCalled();

    rerender(<NewPasswordView link="ready" onSave={() => 'expired'} />);
    fill('a-much-better-one');
    await waitFor(() => expect(screen.getByText('This link has expired.')).toBeOnTheScreen());
  });

  it('tells an unusable link from one that could not be checked', () => {
    const onRetry = jest.fn();
    const { rerender } = renderScreen(<NewPasswordView link="invalid" />);
    expect(screen.getByText('This link doesn’t work.')).toBeOnTheScreen();

    rerender(<NewPasswordView link="failed" onRetry={onRetry} />);
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('says plainly that reset is unavailable without a server', () => {
    renderScreen(<NewPasswordView link="unavailable" />);

    expect(screen.getByText('Password reset isn’t available.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Send a new link' })).toBeNull();
  });
});
