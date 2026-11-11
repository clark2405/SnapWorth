import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createLocalAdminRepository } from '../../adapters';
import type { AdminRepository, ReviewCase } from '../../ports/admin';
import { renderScreen } from '../../testing/render-screen';
import type { UtcDateTime } from '../../types/date-time';
import { err, ok } from '../../types/result';
import { AdminProvider } from './admin-state';
import { AdminReviewView } from './AdminReviewView';

const at = (hoursAgo: number) =>
  new Date(Date.now() - hoursAgo * 3_600_000).toISOString() as UtcDateTime;

const seed: readonly ReviewCase[] = [
  {
    id: 'comment:c1',
    kind: 'comment',
    targetId: 'c1',
    status: 'held',
    body: 'This is a scam, do not buy.',
    authorHandle: 'bo',
    authorAvatarUrl: null,
    flagRef: 'rules (scam accusation)',
    reportCount: 0,
    reportReasons: [],
    flaggedAt: at(3),
    context: null,
  },
  {
    id: 'comment:c2',
    kind: 'comment',
    targetId: 'c2',
    status: 'approved',
    body: 'You are all idiots.',
    authorHandle: 'cy',
    authorAvatarUrl: null,
    flagRef: null,
    reportCount: 2,
    reportReasons: ['harassment', 'spam'],
    flaggedAt: at(2),
    context: null,
  },
  {
    id: 'conversation:v1',
    kind: 'conversation',
    targetId: 'v1',
    status: null,
    body: '',
    authorHandle: 'dee',
    authorAvatarUrl: null,
    flagRef: null,
    reportCount: 1,
    reportReasons: ['scam'],
    flaggedAt: at(1),
    context: 'About "Brass lamp", reported by @fay',
  },
];

const showing = (repository: AdminRepository) =>
  renderScreen(
    <AdminProvider repository={repository}>
      <AdminReviewView />
    </AdminProvider>,
  );

it('lists what is held and reported, with why, most reported first', async () => {
  showing(createLocalAdminRepository({ seed }));

  expect(await screen.findByText('3 to review')).toBeOnTheScreen();
  expect(screen.getByText('This is a scam, do not buy.')).toBeOnTheScreen();
  expect(screen.getByText('Flagged by the word rules: scam accusation')).toBeOnTheScreen();
  expect(screen.getByText('Comment · 2 reports')).toBeOnTheScreen();
  expect(screen.getByText('Reported for harassment, spam')).toBeOnTheScreen();
  // A conversation's messages are private: only who and why.
  expect(screen.getByText('About "Brass lamp", reported by @fay')).toBeOnTheScreen();
  expect(screen.getByText('Chat report · 1 report')).toBeOnTheScreen();
});

it('offers each case the decisions that fit it', async () => {
  showing(createLocalAdminRepository({ seed }));
  await screen.findByText('3 to review');

  // Held content: approve or remove. Reported public content: also hold, or dismiss the reports.
  expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: 'Hold' })).toHaveLength(1);
  // The conversation's one decision, and the reported comment's.
  expect(screen.getAllByRole('button', { name: 'Dismiss reports' })).toHaveLength(2);
});

it('approves held content, tells the admin and clears it from the queue', async () => {
  showing(createLocalAdminRepository({ seed }));
  await screen.findByText('3 to review');

  fireEvent.press(screen.getByRole('button', { name: 'Approve' }));

  expect(await screen.findByText('Comment by @bo is now public.')).toBeOnTheScreen();
  await waitFor(() => expect(screen.getByText('2 to review')).toBeOnTheScreen());
  expect(screen.queryByText('This is a scam, do not buy.')).toBeNull();
});

it('removes content and dismisses reports', async () => {
  showing(createLocalAdminRepository({ seed }));
  await screen.findByText('3 to review');

  fireEvent.press(screen.getAllByRole('button', { name: 'Dismiss reports' })[1]!);
  await waitFor(() => expect(screen.getByText('2 to review')).toBeOnTheScreen());
  expect(screen.queryByText('Chat report · 1 report')).toBeNull();

  fireEvent.press(screen.getAllByRole('button', { name: 'Remove' })[0]!);
  await waitFor(() => expect(screen.getByText('1 to review')).toBeOnTheScreen());
});

it('shows the queue is clear once every case is decided', async () => {
  showing(createLocalAdminRepository({ seed: [seed[0]!] }));

  fireEvent.press(await screen.findByRole('button', { name: 'Remove' }));

  expect(await screen.findByText('All clear.')).toBeOnTheScreen();
  expect(screen.getByText('The queue is empty')).toBeOnTheScreen();
});

it('says so, and shows nothing, when the database says the account is not an admin', async () => {
  const decide = jest.fn();
  showing({
    queue: () => Promise.resolve(err({ kind: 'authorization', code: 'not_found_or_denied' })),
    decide,
  });

  expect(await screen.findByText('This is for admins')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  expect(decide).not.toHaveBeenCalled();
});

it('shows nothing to review without a repository: nobody is an admin by default', async () => {
  renderScreen(<AdminReviewView />);

  expect(await screen.findByText('This is for admins')).toBeOnTheScreen();
});

it('offers a retry when the queue can not be loaded', async () => {
  let loads = 0;
  showing({
    queue: () => {
      loads += 1;
      return Promise.resolve(
        loads === 1
          ? err({ kind: 'offline', operation: 'load_moderation_queue', retryable: true })
          : ok(seed),
      );
    },
    decide: () => Promise.resolve(ok(undefined)),
  });

  fireEvent.press(await screen.findByRole('button', { name: 'Retry' }));

  expect(await screen.findByText('3 to review')).toBeOnTheScreen();
});

it('tells the admin when a decision did not go through, and keeps the case', async () => {
  showing({
    queue: () => Promise.resolve(ok([seed[0]!])),
    decide: () =>
      Promise.resolve(
        err({ kind: 'offline', operation: 'resolve_moderation_case', retryable: true }),
      ),
  });

  fireEvent.press(await screen.findByRole('button', { name: 'Approve' }));

  expect(await screen.findByText('Not saved')).toBeOnTheScreen();
  expect(screen.getByText('This is a scam, do not buy.')).toBeOnTheScreen();
});
