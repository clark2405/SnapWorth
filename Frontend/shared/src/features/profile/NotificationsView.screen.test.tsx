import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import {
  defaultNotificationPreferences,
  NotificationsView,
  wantsNotification,
} from './NotificationsView';

describe('NotificationsView', () => {
  it('reports a switched-off kind of notification with the rest unchanged', () => {
    const onChange = jest.fn();
    renderScreen(
      <NotificationsView preferences={defaultNotificationPreferences} onChange={onChange} />,
    );

    fireEvent(screen.getByLabelText('Offers'), 'valueChange', false);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultNotificationPreferences,
      enabled: { ...defaultNotificationPreferences.enabled, offers: false },
    });
  });

  it('asks for permission the first time something is turned on', () => {
    const onAllow = jest.fn();
    renderScreen(<NotificationsView access="undetermined" onAllow={onAllow} />);

    fireEvent(screen.getByLabelText('Tips'), 'valueChange', true);

    expect(onAllow).toHaveBeenCalledTimes(1);
  });

  it('points to Settings once permission has been refused', () => {
    const onOpenSettings = jest.fn();
    renderScreen(<NotificationsView access="denied" onOpenSettings={onOpenSettings} />);

    fireEvent.press(screen.getByText('Notifications are off'));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('holds everything back while paused', () => {
    const paused = { ...defaultNotificationPreferences, paused: true };
    expect(wantsNotification(paused, 'estimates')).toBe(false);
    expect(wantsNotification(defaultNotificationPreferences, 'estimates')).toBe(true);
    expect(wantsNotification(defaultNotificationPreferences, 'tips')).toBe(false);
  });
});
