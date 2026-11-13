import { screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import type { UtcDateTime } from '../../types/date-time';
import type { ThreadComment } from '../../types/entities';
import type { CommentId, UserId } from '../../types/ids';
import { CommentList } from './CommentList';

const noop = () => undefined;

const makeComment = (overrides: Partial<ThreadComment>): ThreadComment => ({
  id: 'c1' as CommentId,
  parentId: null,
  parentHidden: false,
  body: 'Looks clean.' as never,
  moderationStatus: 'approved',
  createdAt: '2026-11-10T10:00:00.000Z' as UtcDateTime,
  author: {
    userId: 'u1' as UserId,
    handle: 'user_a1b2c3d4e5',
    displayName: 'Maya Reyes',
  },
  isMine: false,
  reportedByMe: false,
  ...overrides,
});

describe('CommentList author names', () => {
  it('shows the account displayName instead of the generated handle when available, falling back to @handle', () => {
    renderScreen(
      <CommentList
        groups={[
          {
            id: 'c1' as CommentId,
            comment: makeComment({}),
            replies: [
              makeComment({
                id: 'c2' as CommentId,
                parentId: 'c1' as CommentId,
                author: { userId: 'u2' as UserId, handle: 'retro_curator' },
                body: 'Fair price.' as never,
              }),
            ],
          },
        ]}
        onReply={noop}
        onDelete={noop}
        onReport={noop}
      />,
    );

    expect(screen.getByText('Maya Reyes')).toBeOnTheScreen();
    expect(screen.queryByText('@user_a1b2c3d4e5')).toBeNull();
    expect(screen.getByText('@retro_curator')).toBeOnTheScreen();
  });
});
