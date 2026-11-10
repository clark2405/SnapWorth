import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createLocalFeedRepository } from '../../adapters/local/feed-repository';
import { renderScreen } from '../../testing/render-screen';
import { ok } from '../../types/result';
import { VotesView } from '../profile/VotesView';
import { useSession } from '../session';
import { TrendView } from '../trends/TrendView';
import { CommentServiceProvider } from './comment-thread';
import { CreatePostView } from './CreatePostView';
import { buildPreviewFeedPosts, buildPreviewFeedVotes, FeedProvider } from './feed-state';
import { FeedView } from './FeedView';
import { PostDetailView } from './PostDetailView';

function SignedInMember({ children }: { readonly children: ReactNode }) {
  const { startSession } = useSession();
  const signedInRef = useRef(false);
  useEffect(() => {
    if (signedInRef.current) return;
    signedInRef.current = true;
    startSession({ id: 'member-1', email: 'maya@snapworth.test' });
  }, [startSession]);
  return <>{children}</>;
}

const stubCommentService = {
  listThread: async () => ok([]),
  submit: async () => {
    throw new Error('unused');
  },
  remove: async () => ok(undefined),
  report: async () => ok(undefined),
};

describe('Feed, PostDetailView, CreatePostView, VotesView, and TrendView on real Feed state', () => {
  it('publishes a new price-check post from CreatePostView and shows it on FeedView', async () => {
    const repo = createLocalFeedRepository({
      seed: buildPreviewFeedPosts(),
      seedVotes: buildPreviewFeedVotes(),
      viewerHandle: 'retro_curator',
    });
    const onPublish = jest.fn();

    const { unmount } = renderScreen(
      <FeedProvider repository={repo}>
        <CreatePostView itemId="nike-neon-windbreaker" onPublish={onPublish} />
      </FeedProvider>,
    );

    const input = screen.getByLabelText('Your question for the community');
    fireEvent.changeText(input, 'Picked up this neon windbreaker at Carbon. Worth ₱2,450?');
    fireEvent.press(screen.getByRole('button', { name: 'Post to feed' }));

    await waitFor(() => {
      expect(onPublish).toHaveBeenCalledWith(
        'Picked up this neon windbreaker at Carbon. Worth ₱2,450?',
        expect.any(String),
      );
    });
    unmount();

    renderScreen(
      <GestureHandlerRootView>
        <CommentServiceProvider service={stubCommentService}>
          <FeedProvider repository={repo}>
            <FeedView />
          </FeedProvider>
        </CommentServiceProvider>
      </GestureHandlerRootView>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('Picked up this neon windbreaker at Carbon. Worth ₱2,450?'),
      ).toBeTruthy();
    });
  });

  it('casts a vote on PostDetailView and records it in VotesView', async () => {
    const repo = createLocalFeedRepository({
      seed: buildPreviewFeedPosts(),
      seedVotes: [],
      viewerHandle: 'retro_curator',
    });

    const { unmount } = renderScreen(
      <SignedInMember>
        <CommentServiceProvider service={stubCommentService}>
          <FeedProvider repository={repo}>
            <PostDetailView postId="retro-windbreaker" />
          </FeedProvider>
        </CommentServiceProvider>
      </SignedInMember>,
    );

    const justRightButton = await screen.findByLabelText(/Just Right, 38 votes/i);
    fireEvent.press(justRightButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/Just Right, 39 votes/i)).toBeTruthy();
    });
    unmount();

    renderScreen(
      <SignedInMember>
        <FeedProvider repository={repo}>
          <VotesView />
        </FeedProvider>
      </SignedInMember>,
    );

    await waitFor(() => {
      expect(screen.getByText('You said Just Right')).toBeTruthy();
    });
  });

  it('renders TrendView with live listings and feed posts in that category', async () => {
    const repo = createLocalFeedRepository({
      seed: buildPreviewFeedPosts(),
      seedVotes: buildPreviewFeedVotes(),
      viewerHandle: 'retro_curator',
    });

    renderScreen(
      <FeedProvider repository={repo}>
        <TrendView trendKey="film-cameras" />
      </FeedProvider>,
    );

    expect(await screen.findByText('Film is back in frame.')).toBeTruthy();
    expect(screen.getByText('Being priced on the feed')).toBeTruthy();
  });
});
