import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createLocalAdminRepository } from '../../adapters';
import type { ReviewCase } from '../../ports/admin';
import { renderScreen } from '../../testing/render-screen';
import type { UtcDateTime } from '../../types/date-time';
import { AdminProvider } from './admin-state';
import { ModerationConsoleView } from './ModerationConsoleView';

// iOS draws its own segmented control and chips, which a test can't press: the app's own stand in.
jest.mock('../../components/SegmentedControl', () => {
  const { GlidingSegments } = jest.requireActual('../../components/GlidingSegments');
  return { SegmentedControl: GlidingSegments };
});
jest.mock('../../components/ChoiceChips', () => {
  const { ChipRow } = jest.requireActual('../../components/ChipRow');
  return { ChoiceChips: ChipRow };
});

const reported: ReviewCase = {
  id: 'comment:c2',
  kind: 'comment',
  targetId: 'c2',
  status: 'approved',
  title: null,
  photoUrl: null,
  body: 'You are all idiots.',
  authorHandle: 'troll',
  authorAvatarUrl: null,
  flagRef: null,
  reportCount: 3,
  reportReasons: ['harassment'],
  flaggedAt: '2026-11-16T00:00:00.000Z' as UtcDateTime,
  context: null,
};

function openConsole() {
  renderScreen(
    <AdminProvider repository={createLocalAdminRepository({ seed: [reported] })}>
      <ModerationConsoleView />
    </AdminProvider>,
  );
}

it('opens on the week at a glance', async () => {
  openConsole();
  expect(await screen.findByLabelText('1 Waiting for review')).toBeOnTheScreen();
  expect(screen.getByLabelText('3 Reports this week')).toBeOnTheScreen();
});

it('looks a case’s author up, suspends them with a reason, and logs it', async () => {
  openConsole();
  fireEvent.press(await screen.findByRole('tab', { name: 'Queue' }));
  fireEvent.press(await screen.findByText('Their record'));

  // People, searched for the author, with their record.
  expect(await screen.findByText('@troll')).toBeOnTheScreen();
  fireEvent.press(screen.getByText('Suspend…'));

  // No reason, no suspension.
  const confirm = await screen.findByRole('button', { name: 'Suspend account' });
  expect(confirm).toBeDisabled();
  fireEvent.press(screen.getAllByText('Harassment')[0]!);
  fireEvent.press(screen.getByRole('button', { name: 'Suspend account' }));

  expect(await screen.findByText('Suspended')).toBeOnTheScreen();
  expect(screen.getByText('Reinstate')).toBeOnTheScreen();

  fireEvent.press(screen.getByRole('tab', { name: 'History' }));
  await waitFor(() => expect(screen.getByText('@you suspended @troll')).toBeOnTheScreen());
  expect(screen.getAllByText('Harassment').length).toBeGreaterThan(0);
});
