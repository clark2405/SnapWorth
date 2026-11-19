import { act, fireEvent, screen } from '@testing-library/react-native';

import type { LivePosition, PositionWatchPort } from '../../ports/location';
import type { MeetupLocationRepository, SharedPosition } from '../../ports/meetup-location';
import { renderScreen } from '../../testing/render-screen';
import type { UtcDateTime } from '../../types/date-time';
import type { ChatMeetup } from '../../types/entities';
import type { MessageId, UserId } from '../../types/ids';
import { ok } from '../../types/result';
import { MeetupCard } from './ChatCards';
import { MeetupLocationProvider } from './meetup-location-state';

const mockSession = { status: 'member' as 'member' | 'guest' };
jest.mock('../session', () => ({
  ...jest.requireActual('../session'),
  useSession: () => mockSession,
}));

const meetupId = 'm-agreed' as MessageId;
// SM Seaside's entrance; Maria is about 110 m north of it.
const spot = { lat: 10.282, lng: 123.881 };
const agreed: ChatMeetup = {
  place: 'SM Seaside, main entrance',
  when: 'Sat, Nov 21, 2:00 PM',
  status: 'confirmed',
  purpose: 'pickup',
  location: spot,
};

const maria: SharedPosition = {
  userId: 'maria' as UserId,
  mine: false,
  lat: 10.283,
  lng: 123.881,
  accuracyM: 10,
  updatedAt: new Date().toISOString() as UtcDateTime,
};

function show({
  theirs = [] as SharedPosition[],
  watchStatus = 'granted' as 'granted' | 'denied',
  meetup = agreed,
} = {}) {
  const repository = {
    share: jest.fn(() => Promise.resolve(ok(undefined))),
    stop: jest.fn(() => Promise.resolve(ok(undefined))),
    positions: jest.fn(() => Promise.resolve(ok(theirs))),
    watch: jest.fn(() => () => undefined),
  } satisfies MeetupLocationRepository;
  const stopWatching = jest.fn();
  const watcher: PositionWatchPort = {
    watch: jest.fn(async (onPosition: (position: LivePosition) => void) => {
      if (watchStatus === 'denied') return { status: 'denied' as const };
      onPosition({ lat: 10.2815, lng: 123.8812, accuracyM: 8 });
      return { status: 'granted' as const, stop: stopWatching };
    }),
  };
  renderScreen(
    <MeetupLocationProvider repository={repository} watcher={watcher}>
      <MeetupCard
        meetup={meetup}
        meetupId={meetupId}
        otherHandle="mariacruz"
        mine={false}
        onConfirm={() => undefined}
        onSuggestAnother={() => undefined}
      />
    </MeetupLocationProvider>,
  );
  return { repository, watcher, stopWatching };
}

it('shows where the other person is, and how far from the spot', async () => {
  show({ theirs: [maria] });

  expect(
    await screen.findByText(
      '@mariacruz is sharing their location · 110 m from the spot · just now',
    ),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Go to @mariacruz' })).toBeTruthy();
});

it('shares the phone’s position, then stops', async () => {
  const { repository, stopWatching } = show();

  expect(
    await screen.findByText(
      'On your way? Share where you are so you can find each other at the spot.',
    ),
  ).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Share my location' }));
  });

  expect(repository.share).toHaveBeenCalledWith(meetupId, {
    lat: 10.2815,
    lng: 123.8812,
    accuracyM: 8,
  });
  expect(screen.getByText(/^Sharing your location with @mariacruz until /)).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Stop sharing' }));
  });
  expect(stopWatching).toHaveBeenCalled();
  expect(repository.stop).toHaveBeenCalledWith(meetupId);
  expect(screen.getByRole('button', { name: 'Share my location' })).toBeTruthy();
});

it('says how to turn location on when the phone says no', async () => {
  const { repository } = show({ watchStatus: 'denied' });

  await act(async () => {
    fireEvent.press(await screen.findByRole('button', { name: 'Share my location' }));
  });

  expect(
    screen.getByText(
      'Location is off for SnapWorth. Turn it on in Settings to share where you are.',
    ),
  ).toBeTruthy();
  expect(repository.share).not.toHaveBeenCalled();
});

it('offers nothing to share until both have agreed', async () => {
  const { repository } = show({ meetup: { ...agreed, status: 'proposed' } });

  expect(screen.queryByRole('button', { name: 'Share my location' })).toBeNull();
  expect(repository.positions).not.toHaveBeenCalled();
});
