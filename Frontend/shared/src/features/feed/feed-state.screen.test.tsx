import { jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createLocalFeedRepository } from '../../adapters/local/feed-repository';
import type { AccountObserver } from '../../ports/account';
import type { FeedPost, FeedRepository } from '../../ports/feed';
import { err, ok } from '../../types/result';
import { renderScreen } from '../../testing/render-screen';
import { useSession } from '../session';
import { buildPreviewFeedPosts, buildPreviewFeedVotes } from './feed-seed';
import { CommentServiceProvider } from './comment-thread';
import { FeedProvider, useFeed, type FeedContextValue } from './feed-state';
import { FeedView } from './FeedView';

function SignedIn({ children }: { readonly children: ReactNode }) {
  const { startSession } = useSession();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSession({ id: 'member-1', email: 'maya@snapworth.test' });
  }, [startSession]);
  return <>{children}</>;
}

/** Mounts the provider the way the shells do and hands back what `useFeed` currently says. */
function mountFeed(repository: FeedRepository) {
  const result: { current: FeedContextValue } = { current: undefined as never };
  function Probe() {
    result.current = useFeed();
    return null;
  }
  renderScreen(
    <SignedIn>
      <FeedProvider repository={repository}>
        <Probe />
      </FeedProvider>
    </SignedIn>,
  );
  return { result };
}

function localRepository() {
  return createLocalFeedRepository({
    seed: buildPreviewFeedPosts(),
    seedVotes: [],
    viewerHandle: 'retro_curator',
  });
}

describe('FeedProvider voting', () => {
  it('rolls the tally and the person’s choice back and returns the error when a vote fails', async () => {
    const repository: FeedRepository = {
      ...localRepository(),
      setVote: async () => err({ kind: 'offline', operation: 'submit_comment', retryable: true }),
    };
    // Not signed in as a member, so the provider's own list is what the hook shows.
    const { result } = mountFeed(repository);
    await waitFor(() => expect(result.current.posts.length).toBeGreaterThan(0));

    const post = result.current.posts[0]!;
    const before = post.votes;
    let outcome: Awaited<ReturnType<typeof result.current.toggleVote>> | undefined;
    await act(async () => {
      outcome = await result.current.toggleVote(post.id, 'too_high');
    });

    expect(outcome?.ok).toBe(false);
    if (outcome && !outcome.ok) expect(outcome.error.kind).toBe('offline');
    expect(result.current.findPost(post.id)?.votes).toEqual(before);
    expect(result.current.userVotes.find((vote) => vote.postId === post.id)).toBeUndefined();
  });

  it('restores the vote someone already had when changing it fails', async () => {
    const seeded = buildPreviewFeedVotes();
    const existing = seeded[0]!;
    const repository: FeedRepository = {
      ...createLocalFeedRepository({
        seed: buildPreviewFeedPosts(),
        seedVotes: seeded,
        viewerHandle: 'retro_curator',
      }),
      setVote: async () => err({ kind: 'offline', operation: 'submit_comment', retryable: true }),
    };
    const { result } = mountFeed(repository);
    await waitFor(() => expect(result.current.userVotes.length).toBeGreaterThan(0));
    const post = result.current.posts.find(
      (entry) => entry.id === existing.postId || entry.slug === existing.postSlug,
    )!;
    const before = post.votes;
    const other = existing.choice === 'too_high' ? 'too_low' : 'too_high';

    await act(async () => {
      await result.current.toggleVote(post.id, other);
    });

    expect(result.current.findPost(post.id)?.votes).toEqual(before);
    expect(result.current.voteFor(post.id)).toBe(existing.choice);
  });

  it('keeps a vote that goes through', async () => {
    const { result } = mountFeed(localRepository());
    await waitFor(() => expect(result.current.posts.length).toBeGreaterThan(0));
    const post = result.current.posts[0]!;
    let outcome: Awaited<ReturnType<typeof result.current.toggleVote>> | undefined;
    await act(async () => {
      outcome = await result.current.toggleVote(post.id, 'just_right');
    });
    expect(outcome).toEqual({ ok: true, value: 'just_right' });
    expect(result.current.findPost(post.id)?.votes.just_right).toBe(post.votes.just_right + 1);
  });
});

describe('FeedProvider loading', () => {
  const offline = { kind: 'offline', operation: 'load_post', retryable: true } as const;

  it('is loading until the posts arrive, then ready', async () => {
    const { result } = mountFeed(localRepository());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.posts.length).toBeGreaterThan(0);
  });

  it('says failed, not empty, when the posts cannot be loaded, and recovers on a retry', async () => {
    let failing = true;
    const base = localRepository();
    const repository: FeedRepository = {
      ...base,
      list: async () => (failing ? err(offline) : base.list()),
    };
    const { result } = mountFeed(repository);
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.posts).toEqual([]);

    failing = false;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.posts.length).toBeGreaterThan(0);
  });

  it('keeps the posts on screen when a later refresh fails', async () => {
    let failing = false;
    const base = localRepository();
    const repository: FeedRepository = {
      ...base,
      list: async () => (failing ? err(offline) : base.list()),
    };
    const { result } = mountFeed(repository);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const count = result.current.posts.length;

    failing = true;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.posts).toHaveLength(count);
  });
});

describe('FeedView while the Feed loads', () => {
  const offline = { kind: 'offline', operation: 'load_post', retryable: true } as const;
  const comments = {
    listThread: async () => ok([]),
    submit: async () => {
      throw new Error('unused');
    },
    remove: async () => ok(undefined),
    report: async () => ok(undefined),
  };

  it('offers a retry when the Feed could not be loaded, instead of an empty Feed', async () => {
    let failing = true;
    const base = localRepository();
    const repository: FeedRepository = {
      ...base,
      list: async () => (failing ? err(offline) : base.list()),
    };
    renderScreen(
      <GestureHandlerRootView>
        <CommentServiceProvider service={comments}>
          <FeedProvider repository={repository}>
            <FeedView />
          </FeedProvider>
        </CommentServiceProvider>
      </GestureHandlerRootView>,
    );

    expect(await screen.findByText('Couldn’t load the feed')).toBeOnTheScreen();
    failing = false;
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText('Couldn’t load the feed')).toBeNull());
    expect(await screen.findByText(/windbreaker/i)).toBeOnTheScreen();
  });
});

/** Sign-ins the test controls, the way Supabase's observer announces them. */
function fakeAccount(first: string | null) {
  let listener: ((accountId: string | null) => void) | null = null;
  const account: AccountObserver = {
    observe(next) {
      listener = next;
      next(first);
      return () => (listener = null);
    },
  };
  return { account, signIn: (accountId: string | null) => listener?.(accountId) };
}

/** One post, mine and voted on only for Ana; for anyone else it is just a post. */
function phoneFeed(
  whoIsSignedIn: () => string | null,
  delay?: (accountId: string | null) => Promise<void>,
) {
  const post = (mine: boolean): FeedPost => ({
    ...buildPreviewFeedPosts()[0]!,
    id: 'p1',
    slug: 'p1',
    isMine: mine,
  });
  const repository: FeedRepository = {
    ...localRepository(),
    list: async () => {
      const asked = whoIsSignedIn();
      await delay?.(asked);
      return ok([post(asked === 'ana')]);
    },
    listVotes: async () =>
      ok(
        whoIsSignedIn() === 'ana'
          ? [
              {
                postId: 'p1',
                postSlug: 'p1',
                choice: 'too_high' as const,
                castAt: new Date().toISOString() as never,
              },
            ]
          : [],
      ),
  };
  return repository;
}

describe('FeedProvider following the account', () => {
  function mountFor(repository: FeedRepository, account: AccountObserver) {
    const result: { current: FeedContextValue } = { current: undefined as never };
    function Probe() {
      result.current = useFeed();
      return null;
    }
    renderScreen(
      <SignedIn>
        <FeedProvider repository={repository} account={account}>
          <Probe />
        </FeedProvider>
      </SignedIn>,
    );
    return { result };
  }

  it('drops the last person’s votes and mine flags at once, then loads the next person’s', async () => {
    let who: string | null = 'ana';
    const { account, signIn } = fakeAccount('ana');
    const { result } = mountFor(
      phoneFeed(() => who),
      account,
    );
    await waitFor(() => expect(result.current.voteFor('p1')).toBe('too_high'));
    expect(result.current.posts[0]?.isMine).toBe(true);

    who = 'ben';
    act(() => signIn('ben'));
    // Straight away, before anything has loaded: nothing of Ana's is left.
    expect(result.current.posts).toEqual([]);
    expect(result.current.userVotes).toEqual([]);
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.posts[0]?.isMine).toBe(false);
    expect(result.current.voteFor('p1')).toBeNull();

    who = 'ana';
    act(() => signIn('ana'));
    await waitFor(() => expect(result.current.voteFor('p1')).toBe('too_high'));
    expect(result.current.posts[0]?.isMine).toBe(true);
  });

  it('shows no votes after signing out, and Ana’s again on signing back in', async () => {
    let who: string | null = 'ana';
    const { account, signIn } = fakeAccount('ana');
    const { result } = mountFor(
      phoneFeed(() => who),
      account,
    );
    await waitFor(() => expect(result.current.voteFor('p1')).toBe('too_high'));

    who = null;
    act(() => signIn(null));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.userVotes).toEqual([]);
    expect(result.current.posts[0]?.isMine).toBe(false);
  });

  it('drops a load still on its way for the last person', async () => {
    let who: string | null = 'ana';
    let releaseAna: () => void = () => undefined;
    const anaGate = new Promise<void>((resolve) => (releaseAna = resolve));
    const { account, signIn } = fakeAccount('ana');
    const { result } = mountFor(
      phoneFeed(
        () => who,
        async (asked) => {
          if (asked === 'ana') await anaGate;
        },
      ),
      account,
    );
    // Ana's load is held; Ben signs in and his arrives first.
    who = 'ben';
    act(() => signIn('ben'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.posts[0]?.isMine).toBe(false);

    // Ana's slow load now finishes: it must not overwrite Ben's Feed.
    await act(async () => {
      releaseAna();
      await anaGate;
    });
    expect(result.current.posts[0]?.isMine).toBe(false);
    expect(result.current.voteFor('p1')).toBeNull();
  });

  it('does not load until it knows who is signed in', async () => {
    const list = jest.fn(async () => ok([] as FeedPost[]));
    let announce: (accountId: string | null) => void = () => undefined;
    const account: AccountObserver = {
      observe(next) {
        announce = next;
        return () => undefined;
      },
    };
    mountFor({ ...localRepository(), list }, account);
    expect(list).not.toHaveBeenCalled();
    act(() => announce(null));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  });
});
