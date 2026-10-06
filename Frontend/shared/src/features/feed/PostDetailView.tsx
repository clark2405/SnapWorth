import {
  ArrowUp,
  ChevronRight,
  ShieldX,
  ShoppingBag,
  Tag as TagIcon,
  X,
} from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
  Avatar,
  BottomBar,
  Button,
  EstimateBadge,
  IconButton,
  NavHeader,
  PressableScale,
  Reveal,
  Screen,
  SWText,
  Surface,
  Tag,
  VerdictBar,
  VoteChips,
  hideWebFocusOutline,
  typeStyle,
  useToast,
  shareIcon,
  DetailHero,
  DetailSheet,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { commentBodyMaxLength, type ThreadComment } from '../../types/entities';
import type { AppError } from '../../types/errors';
import type { VoteChoice } from '../../types';
import {
  formatPeso,
  previewOlderPosts,
  previewPostDetail,
  previewPosts,
  previewProfile,
  previewVotesCast,
  type PreviewPost,
} from '../preview/sample-data';
import { useAccountGate, useSession } from '../session';
import { Tip, useTip } from '../tips';
import { CommentList } from './CommentList';
import { useCommentThread } from './comment-thread';

export interface PostDetailViewProps {
  readonly postId?: string;
  readonly onBack?: () => void;
  readonly onShare?: () => void;
  /** Opens the marketplace listing a reposted post links to. */
  readonly onOpenListing?: (listingId: string) => void;
  /** The author only: list the item from this post on the marketplace. */
  readonly onListForSale?: (postId: string) => void;
}

/** What to tell someone when posting, deleting or reporting did not go through. */
function failureCopy(error: AppError): string {
  switch (error.kind) {
    case 'validation':
      if (error.code === 'blocked') {
        return 'This breaks a community guideline, so it was not posted. Edit it and try again.';
      }
      return error.code === 'too_long'
        ? `Keep it under ${commentBodyMaxLength} characters.`
        : 'Write something first.';
    case 'offline':
    case 'timeout':
      return 'You are offline. Your text is still here; try again when you reconnect.';
    case 'rate_limited':
      return 'You are commenting quickly. Give it a minute.';
    case 'authorization':
      return 'That comment is no longer available.';
    default:
      return 'Something went wrong. Try again.';
  }
}

/**
 * The discussion behind one post: the photo runs full-bleed under a floating header, the
 * question and community verdict sit below it, and the thread loads from the comment service.
 * Replying puts the composer into reply mode for that person; new comments land in the thread
 * as moderation left them, approved or visibly pending.
 */
export function PostDetailView({
  postId,
  onBack,
  onShare,
  onOpenListing,
  onListForSale,
}: PostDetailViewProps) {
  // The post the user tapped; a link to a post outside the preview feed falls back to a sample.
  const post =
    [...previewPosts, ...previewOlderPosts].find((entry) => entry.id === postId) ??
    previewPostDetail;
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const thread = useCommentThread(post.id);
  const { isGuest } = useSession();
  const requireAccount = useAccountGate();
  const voteTip = useTip('vote');
  const [vote, setVote] = useState<VoteChoice | null>(() =>
    isGuest ? null : (previewVotesCast.find((entry) => entry.postId === post.id)?.vote ?? null),
  );
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ThreadComment | null>(null);
  const [sending, setSending] = useState(false);
  const [blockedNote, setBlockedNote] = useState(false);
  const input = useRef<TextInput>(null);
  const scrollRef = useRef<Animated.ScrollView>(null);
  // Where the discussion starts in the scroll content, so a new comment can be scrolled to.
  const bodyY = useRef(0);
  const discussionY = useRef(0);
  const canSend = draft.trim().length > 0 && !sending;

  const startReply = useCallback((comment: ThreadComment) => {
    setReplyingTo(comment);
    input.current?.focus();
  }, []);

  const submit = useCallback(async () => {
    if (!canSend) return;
    setSending(true);
    const target = replyingTo;
    const result = await thread.submit(draft, target?.id);
    setSending(false);
    if (!result.ok) {
      toast.show({
        title: target ? 'Reply not posted' : 'Comment not posted',
        body: failureCopy(result.error),
      });
      // A blocked comment keeps its text so the author can fix it, with the reason on screen.
      if (result.error.kind === 'validation' && result.error.code === 'blocked') {
        setBlockedNote(true);
      }
      return;
    }
    setDraft('');
    setReplyingTo(null);
    const status = result.value.comment.moderationStatus;
    if (status === 'approved') {
      toast.show({ title: target ? 'Reply posted' : 'Comment posted' });
    } else if (status === 'held') {
      toast.show({
        title: 'Held for review',
        body: 'It may break a community guideline, so only you can see it for now.',
      });
    } else {
      toast.show({ title: 'Posted', body: 'Others will see it once it has been checked.' });
    }
    if (!target) {
      // New conversations go to the top of the thread; bring it into view.
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, bodyY.current + discussionY.current - tokens.spacing[16] * 2),
          animated: true,
        });
      }, 120);
    }
  }, [canSend, draft, replyingTo, thread, toast]);

  const remove = useCallback(
    async (comment: ThreadComment) => {
      const result = await thread.remove(comment);
      toast.show(
        result.ok
          ? { title: comment.parentId ? 'Reply deleted' : 'Comment deleted' }
          : { title: 'Not deleted', body: failureCopy(result.error) },
      );
    },
    [thread, toast],
  );

  const report = useCallback(
    async (comment: ThreadComment) => {
      const result = await thread.report(comment);
      toast.show(
        result.ok
          ? { title: 'Comment reported', body: 'Our moderators will take a look.' }
          : { title: 'Not reported', body: failureCopy(result.error) },
      );
    },
    [thread, toast],
  );

  const count = thread.comments.length;

  return (
    <Screen
      bleedTop
      scrollRef={scrollRef}
      header={
        <NavHeader
          title="Discussion"
          onBack={onBack}
          trailing={
            <IconButton
              icon={shareIcon}
              label="Share this post"
              appearance="glass"
              onPress={onShare}
            />
          }
        />
      }
      footer={
        <BottomBar>
          {replyingTo ? (
            <Animated.View
              entering={FadeIn.duration(tokens.motion.duration.base)}
              exiting={FadeOut.duration(tokens.motion.duration.fast)}
              style={styles.replyingRow}
            >
              <SWText
                variant="labelSmall"
                tone="textSecondary"
                numberOfLines={1}
                style={styles.replyingLabel}
              >
                Replying to @{replyingTo.author.handle}
              </SWText>
              <PressableScale
                accessibilityLabel="Cancel reply"
                haptic="select"
                hitSlop={tokens.spacing[2]}
                onPress={() => setReplyingTo(null)}
                style={styles.cancelReply}
              >
                <X size={14} strokeWidth={2.2} color={colors.textSecondary} />
              </PressableScale>
            </Animated.View>
          ) : null}
          {blockedNote ? (
            <Animated.View
              entering={FadeIn.duration(tokens.motion.duration.base)}
              exiting={FadeOut.duration(tokens.motion.duration.fast)}
              style={styles.blockedRow}
              accessibilityLiveRegion="polite"
            >
              <ShieldX size={14} strokeWidth={2.2} color={colors.danger} />
              <SWText variant="labelSmall" tone="danger" style={styles.replyingLabel}>
                Not posted: it breaks a community guideline
              </SWText>
            </Animated.View>
          ) : null}
          {isGuest ? (
            // A guest sees where their take would go; tapping it asks for an account first.
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Add your take on the price"
              accessibilityHint="Asks you to sign in or create an account"
              haptic="select"
              onPress={() => requireAccount('comment', () => input.current?.focus())}
              style={styles.composerRow}
            >
              <SWText variant="bodyLarge" tone="textMuted" style={styles.guestComposer}>
                Add your take on the price
              </SWText>
            </PressableScale>
          ) : (
            <View style={styles.composerRow}>
              <TextInput
                ref={input}
                value={draft}
                onChangeText={(text) => {
                  setDraft(text);
                  setBlockedNote(false);
                }}
                placeholder={
                  replyingTo
                    ? `Reply to @${replyingTo.author.handle}`
                    : 'Add your take on the price'
                }
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.accent}
                accessibilityLabel={replyingTo ? 'Write a reply' : 'Write a comment'}
                maxLength={commentBodyMaxLength}
                multiline
                style={[
                  styles.composerInput,
                  typeStyle('bodyLarge'),
                  { color: colors.textPrimary, lineHeight: undefined },
                  hideWebFocusOutline,
                ]}
              />
              <IconButton
                icon={ArrowUp}
                label={replyingTo ? 'Post reply' : 'Post comment'}
                appearance="accent"
                size={18}
                haptic="pop"
                disabled={!canSend}
                onPress={() => void submit()}
              />
            </View>
          )}
        </BottomBar>
      }
      contentStyle={styles.content}
    >
      <DetailHero source={post.photo} label={post.photoLabel} />

      <DetailSheet
        style={styles.body}
        onLayout={(event) => {
          bodyY.current = event.nativeEvent.layout.y;
        }}
      >
        <Reveal index={0} style={styles.author}>
          <Avatar source={post.author.avatar} name={post.author.handle} size={40} />
          <View>
            <SWText variant="label">@{post.author.handle}</SWText>
            <SWText variant="caption" tone="textMuted">
              {post.postedAgo}
            </SWText>
          </View>
        </Reveal>

        <Reveal index={1} style={styles.question}>
          <EstimateBadge value={formatPeso(post.estimate)} size="hero" />
          <SWText variant="bodyLarge">{post.body}</SWText>
          <CrossPost post={post} onOpenListing={onOpenListing} onListForSale={onListForSale} />
        </Reveal>

        <Reveal index={2} style={styles.verdict}>
          <VerdictBar tally={post.votes} />
          <Tip id="vote" />
          <VoteChips
            tally={post.votes}
            selected={vote}
            onVote={(choice) =>
              requireAccount('vote', () => {
                voteTip.done();
                setVote((current) => (current === choice ? null : choice));
              })
            }
          />
        </Reveal>

        <View
          style={styles.discussion}
          onLayout={(event) => {
            discussionY.current = event.nativeEvent.layout.y;
          }}
        >
          <SWText variant="headingMedium" accessibilityRole="header">
            {thread.status === 'ready'
              ? `${count} ${count === 1 ? 'comment' : 'comments'}`
              : 'Comments'}
          </SWText>

          {thread.status === 'loading' ? (
            <SWText variant="bodySmall" tone="textMuted" accessibilityLiveRegion="polite">
              Loading the discussion…
            </SWText>
          ) : thread.status === 'failed' ? (
            <View style={styles.problem} accessibilityLiveRegion="polite">
              <SWText variant="bodySmall" tone="textSecondary">
                {thread.error ? failureCopy(thread.error) : 'The discussion did not load.'}
              </SWText>
              <Button label="Try again" variant="secondary" size="small" onPress={thread.reload} />
            </View>
          ) : count === 0 ? (
            <SWText variant="bodySmall" tone="textMuted">
              No comments yet. Be the first to weigh in on the price.
            </SWText>
          ) : (
            <CommentList
              groups={thread.groups}
              onReply={(comment) => requireAccount('comment', () => startReply(comment))}
              onDelete={(comment) => void remove(comment)}
              onReport={(comment) => requireAccount('report', () => void report(comment))}
            />
          )}
        </View>
      </DetailSheet>
    </Screen>
  );
}

/**
 * The link between a post and the marketplace. A reposted listing points back to it; the
 * author's own unlisted post offers to list it. Everyone else sees nothing here.
 */
function CrossPost({
  post,
  onOpenListing,
  onListForSale,
}: {
  readonly post: PreviewPost;
} & Pick<PostDetailViewProps, 'onOpenListing' | 'onListForSale'>) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const { isGuest } = useSession();
  const mine = !isGuest && post.author.handle === previewProfile.user.handle;
  const { listing } = post;

  if (listing) {
    return (
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`For sale, asking ${formatPeso(listing.askingPrice)}. View listing`}
        haptic="select"
        depth="surface"
        onPress={() => onOpenListing?.(listing.id)}
      >
        <Surface padding={tokens.spacing[3]} contentStyle={styles.crossPost}>
          <View style={styles.crossIcon}>
            <TagIcon size={18} strokeWidth={2} color={colors.mintInk} />
          </View>
          <View style={styles.crossText}>
            <SWText variant="label">For sale on the market</SWText>
            <SWText variant="caption" tone="textSecondary">
              Asking {formatPeso(listing.askingPrice)}
            </SWText>
          </View>
          <ChevronRight size={18} strokeWidth={2} color={colors.textMuted} />
        </Surface>
      </PressableScale>
    );
  }

  if (!mine) return null;
  return (
    <Surface padding={tokens.spacing[4]} contentStyle={styles.ownerCard}>
      <View style={styles.ownerHead}>
        <Tag label="Your post" tone="sand" />
      </View>
      <SWText variant="bodySmall" tone="textSecondary">
        Happy with what the community thinks? List it and set your own price.
      </SWText>
      <Button
        label="List on the market"
        variant="secondary"
        icon={ShoppingBag}
        accessibilityHint="Opens price confirmation. You set the asking price yourself."
        onPress={() => onListForSale?.(post.id)}
      />
    </Surface>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  body: {
    gap: tokens.spacing[8],
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  question: {
    gap: tokens.spacing[4],
  },
  crossPost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  crossIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  crossText: {
    flex: 1,
  },
  ownerCard: {
    gap: tokens.spacing[3],
  },
  ownerHead: {
    flexDirection: 'row',
  },
  verdict: {
    gap: tokens.spacing[4],
  },
  discussion: {
    gap: tokens.spacing[5],
  },
  problem: {
    alignItems: 'flex-start',
    gap: tokens.spacing[3],
  },
  // The cancel sits right after the name rather than at the far edge, where floating chrome
  // (the companion orb) could cover it.
  replyingLabel: {
    flexShrink: 1,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingLeft: tokens.spacing[2],
  },
  replyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingLeft: tokens.spacing[2],
  },
  cancelReply: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  composerInput: {
    flex: 1,
    minHeight: tokens.focus.minimumTarget,
    maxHeight: tokens.spacing[16] + tokens.spacing[8],
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderStrong,
    backgroundColor: colors.sunken,
  },
  guestComposer: {
    flex: 1,
    minHeight: tokens.focus.minimumTarget,
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderStrong,
    backgroundColor: colors.sunken,
    overflow: 'hidden',
  },
}));
