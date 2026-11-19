import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { firstMeetupTime, MeetupWhenPicker } from './MeetupWhenPicker.ios';

it('starts on the next full hour at least half an hour away', () => {
  expect(firstMeetupTime(new Date(2026, 10, 19, 13, 23))).toEqual(new Date(2026, 10, 19, 14, 0));
  expect(firstMeetupTime(new Date(2026, 10, 19, 13, 40))).toEqual(new Date(2026, 10, 19, 15, 0));
  // Late at night it rolls into tomorrow.
  expect(firstMeetupTime(new Date(2026, 10, 19, 23, 45))).toEqual(new Date(2026, 10, 20, 1, 0));
});

it('chooses that time at once, so the wheel and the proposal agree', () => {
  const onChange = jest.fn();
  const now = new Date(2026, 10, 19, 13, 23);
  renderScreen(<MeetupWhenPicker now={now} value={null} onChange={onChange} />);
  expect(onChange).toHaveBeenCalledWith(new Date(2026, 10, 19, 14, 0));
});

it('shows the time chosen in one row, the wheel kept in a sheet of its own', () => {
  const now = new Date(2026, 10, 19, 13, 23);
  renderScreen(
    <MeetupWhenPicker now={now} value={new Date(2026, 10, 20, 15, 0)} onChange={() => undefined} />,
  );
  expect(screen.getByText('Fri, Nov 20, 3:00 PM')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Day and time, Fri, Nov 20, 3:00 PM' }));
  expect(screen.getByText('When to meet')).toBeTruthy();
});
