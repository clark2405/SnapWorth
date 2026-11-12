import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { EditProfileView } from './EditProfileView';

describe('EditProfileView', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('offers Save only once something has changed', () => {
    renderScreen(<EditProfileView />);
    const save = () => screen.getByRole('button', { name: 'Save' });

    expect(save()).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText('Location'), 'Quezon City');
    expect(save()).toBeEnabled();
  });

  it('offers Save once a new photo is picked, and not for backing out of the picker', async () => {
    const onPickPhoto = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ uri: 'file:///me.jpg' });
    renderScreen(<EditProfileView onPickPhoto={onPickPhoto} />);
    const save = () => screen.getByRole('button', { name: 'Save' });

    fireEvent.press(screen.getByRole('button', { name: 'Change profile photo' }));
    await waitFor(() => expect(onPickPhoto).toHaveBeenCalledTimes(1));
    expect(save()).toBeDisabled();

    fireEvent.press(screen.getByRole('button', { name: 'Change profile photo' }));
    await waitFor(() => expect(save()).toBeEnabled());
  });

  it('opens the picker from the "Change photo" words too, as one control with one label', async () => {
    const onPickPhoto = jest.fn().mockResolvedValue({ uri: 'file:///me.jpg' });
    renderScreen(<EditProfileView onPickPhoto={onPickPhoto} />);

    // One button, named for what it does; the caption is part of it, not a second target.
    expect(screen.getAllByRole('button', { name: 'Change profile photo' })).toHaveLength(1);
    fireEvent.press(screen.getByText('Change photo'));

    await waitFor(() => expect(onPickPhoto).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  });

  it('shows no "Change photo" caption where no photo can be picked', () => {
    renderScreen(<EditProfileView />);

    expect(screen.queryByText('Change photo')).toBeNull();
  });

  it('explains a username it cannot take and holds Save back', () => {
    renderScreen(<EditProfileView />);

    fireEvent.changeText(screen.getByLabelText('Username'), 'ab');

    expect(
      screen.getByText('3 to 20 lowercase letters, numbers or underscores.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('lowercases a username as it is typed and confirms the save', async () => {
    const onSaved = jest.fn();
    renderScreen(<EditProfileView onSaved={onSaved} />);

    fireEvent.changeText(screen.getByLabelText('Username'), 'Rico Thrifts');
    expect(screen.getByLabelText('Username')).toHaveDisplayValue('ricothrifts');

    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    // Saving goes through the profile service, so the confirmation comes once it answers.
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });
});
