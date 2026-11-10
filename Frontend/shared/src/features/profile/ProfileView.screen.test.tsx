import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { ProfileView } from './ProfileView';

describe('ProfileView: deleting the account', () => {
  const openSheet = () => {
    fireEvent.press(screen.getByText('Delete account'));
    return screen.getByLabelText('Type DELETE to confirm');
  };
  // The row that opens the sheet and the sheet's own button share a name; the sheet's is last.
  const confirm = () => screen.getAllByRole('button', { name: 'Delete account' }).at(-1)!;

  it('deletes only once the confirmation word is typed', async () => {
    const onDeleteAccount = jest.fn().mockResolvedValue({ kind: 'deleted' });
    renderScreen(<ProfileView onDeleteAccount={onDeleteAccount} />);

    const field = openSheet();
    expect(confirm()).toBeDisabled();
    fireEvent.changeText(field, 'delet');
    expect(confirm()).toBeDisabled();

    fireEvent.changeText(field, 'delete');
    expect(confirm()).toBeEnabled();
    fireEvent.press(confirm());

    await waitFor(() => expect(onDeleteAccount).toHaveBeenCalledWith('delete'));
  });

  it('keeps the sheet open with the reason when the account could not be deleted', async () => {
    const onDeleteAccount = jest
      .fn()
      .mockResolvedValue({ kind: 'failed', message: 'Your account couldn’t be deleted.' });
    renderScreen(<ProfileView onDeleteAccount={onDeleteAccount} />);

    fireEvent.changeText(openSheet(), 'DELETE');
    fireEvent.press(confirm());

    expect(await screen.findByText('Your account couldn’t be deleted.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Type DELETE to confirm')).toBeOnTheScreen();
  });

  it('keeps the account without asking anything else', () => {
    const onDeleteAccount = jest.fn();
    renderScreen(<ProfileView onDeleteAccount={onDeleteAccount} />);

    fireEvent.changeText(openSheet(), 'DELETE');
    fireEvent.press(screen.getByRole('button', { name: 'Keep my account' }));

    expect(onDeleteAccount).not.toHaveBeenCalled();
  });
});
