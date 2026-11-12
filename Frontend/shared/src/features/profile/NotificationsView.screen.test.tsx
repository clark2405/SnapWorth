import { fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

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

  describe('in a browser', () => {
    beforeEach(() => jest.replaceProperty(Platform, 'OS', 'web'));
    afterEach(() => jest.restoreAllMocks());

    it('shows only what reaches a browser: messages, offers and meetups', () => {
      renderScreen(<NotificationsView />);

      for (const label of ['Messages', 'Offers', 'Meetup reminders', 'Pause all notifications']) {
        expect(screen.getByLabelText(label)).toBeOnTheScreen();
      }
      for (const label of ['Estimate ready', 'Votes on your posts', 'Price drops', 'Tips']) {
        expect(screen.queryByLabelText(label)).toBeNull();
      }
      expect(screen.queryByText('Your items')).toBeNull();
      expect(screen.queryByText('From SnapWorth')).toBeNull();
    });

    it('talks about the page and this browser, never the phone', () => {
      renderScreen(<NotificationsView access="undetermined" />);

      expect(screen.getByText(/banners while SnapWorth is open/)).toBeOnTheScreen();
      expect(screen.queryByText(/phone’s Settings/)).toBeNull();
      // No permission to ask for: the banners sit in the page.
      expect(screen.queryByText('Allow notifications')).toBeNull();
    });

    it('does not ask the browser for permission when a switch is turned on', () => {
      const onAllow = jest.fn();
      renderScreen(<NotificationsView access="undetermined" onAllow={onAllow} />);

      fireEvent(screen.getByLabelText('Messages'), 'valueChange', false);
      fireEvent(screen.getByLabelText('Messages'), 'valueChange', true);

      expect(onAllow).not.toHaveBeenCalled();
    });
  });

  it('keeps every switch, and the phone’s wording, on a phone', () => {
    renderScreen(<NotificationsView />);

    for (const label of ['Estimate ready', 'Messages', 'Price drops', 'Tips']) {
      expect(screen.getByLabelText(label)).toBeOnTheScreen();
    }
    expect(screen.getByText(/phone’s Settings/)).toBeOnTheScreen();
  });

  it('holds everything back while paused', () => {
    const paused = { ...defaultNotificationPreferences, paused: true };
    expect(wantsNotification(paused, 'estimates')).toBe(false);
    expect(wantsNotification(defaultNotificationPreferences, 'estimates')).toBe(true);
    expect(wantsNotification(defaultNotificationPreferences, 'tips')).toBe(false);
  });
});
