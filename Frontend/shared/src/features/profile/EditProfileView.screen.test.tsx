import { act, fireEvent, screen } from '@testing-library/react-native';

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

  it('explains a username it cannot take and holds Save back', () => {
    renderScreen(<EditProfileView />);

    fireEvent.changeText(screen.getByLabelText('Username'), 'ab');

    expect(
      screen.getByText('3 to 20 lowercase letters, numbers or underscores.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('lowercases a username as it is typed and confirms the save', () => {
    const onSaved = jest.fn();
    renderScreen(<EditProfileView onSaved={onSaved} />);

    fireEvent.changeText(screen.getByLabelText('Username'), 'Rico Thrifts');
    expect(screen.getByLabelText('Username')).toHaveDisplayValue('ricothrifts');

    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    act(() => jest.runAllTimers());

    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
