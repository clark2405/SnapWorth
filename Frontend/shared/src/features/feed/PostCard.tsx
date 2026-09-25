import { Check, MessageCircle } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  Avatar,
  EstimateBadge,
  Photo,
  SWText,
  VerdictBar,
  VoteChips,
  ZoomLink,
  useToast,
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { VoteChoice } from '../../types';
import { formatPeso, type PreviewPost } from '../preview/sample-data';

export interface PostCardProps {
  readonly post: PreviewPost;
  readonly vote?: VoteChoice | null;
  readonly onVote?: (vote: VoteChoice) => void;
  readonly onOpen?: () => void;
  readonly onShare?: () => void;
  readonly onSave?: () => void;
  readonly onReport?: () => void;
}

/**
 * One feed beat: photo and estimate lead, the author's question frames them, and the vote is
 * the action. No card chrome; posts are separated by space alone. The photo opens the discussion
 * on tap and carries a long-press menu; double-tapping its estimate corner casts "Just Right"
 * without leaving the feed, the way a double-tap-to-like works elsewhere.
 */
export function PostCard({ post, vote, onVote, onOpen, onShare, onSave, onReport }: PostCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [burst, setBurst] = useState(0);

  const castJustRight = useCallback(() => {
    haptic('pop');
    setBurst((current) => current + 1);
    onVote?.('just_right');
  }, [onVote]);

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(280)
        .onEnd((_event, success) => {
          if (success) runOnJS(castJustRight)();
        }),
    [castJustRight],
  );

  const menu = useMemo(
    () => [
      {
        title: 'Share',
        symbol: 'square.and.arrow.up',
        onPress: () => {
          onShare?.();
          toast.show({ title: 'Link copied' });
        },
      },
      {
        title: 'Save',
        symbol: 'bookmark',
        onPress: () => {
          onSave?.();
          toast.show({ title: 'Saved' });
        },
      },
      {
        title: 'Report',
        symbol: 'flag',
        destructive: true,
        onPress: () => {
          onReport?.();
          toast.show({ title: 'Reported', body: 'We will take a look.' });
        },
      },
    ],
    [onReport, onSave, onShare, toast],
  );

  return (
    <View style={styles.post}>
      <View style={styles.header}>
        <Avatar source={post.author.avatar} name={post.author.handle} size={32} />
        <View style={styles.byline}>
          <SWText variant="labelSmall">@{post.author.handle}</SWText>
          <SWText variant="caption" tone="textMuted">
            {post.postedAgo}
          </SWText>
        </View>
      </View>

      <ZoomLink
        href={`/post/${post.id}`}
        label={`Open discussion: ${post.body}`}
        onPress={onOpen}
        menu={menu}
      >
        <View style={styles.photoWrap}>
          <Photo
            source={post.photo}
            label={post.photoLabel}
            aspectRatio={4 / 3}
            radius={tokens.radius.large}
          />
          <JustRightBurst trigger={burst} />
          <GestureDetector gesture={doubleTap}>
            <Animated.View style={styles.badgeOverlay}>
              <EstimateBadge value={formatPeso(post.estimate)} />
            </Animated.View>
          </GestureDetector>
        </View>
      </ZoomLink>

      <SWText variant="bodyMedium">{post.body}</SWText>

      <VoteChips tally={post.votes} selected={vote} onVote={onVote} />

      <View style={styles.meta}>
        <VerdictBar tally={post.votes} />
        <View style={styles.comments} accessibilityLabel={`${post.commentCount} comments`}>
          <MessageCircle size={16} strokeWidth={1.75} color={colors.textMuted} />
          <SWText variant="labelMedium" tone="textMuted">
            {post.commentCount}
          </SWText>
        </View>
      </View>
    </View>
  );
}

/** A large check that pops over the photo when a double tap casts "Just Right". */
function JustRightBurst({ trigger }: { readonly trigger: number }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (reduceMotion) {
      opacity.value = withSequence(
        withTiming(1, { duration: 140 }),
        withDelay(260, withTiming(0, { duration: 160 })),
      );
      scale.value = 1;
      return;
    }
    scale.value = 0.6;
    opacity.value = 1;
    scale.value = withSequence(
      withTiming(1.15, { duration: 220, easing: Easing.out(Easing.back(1.8)) }),
      withTiming(1, { duration: 140 }),
    );
    opacity.value = withDelay(360, withTiming(0, { duration: 220 }));
  }, [opacity, reduceMotion, scale, trigger]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.burst, style]}>
      <View style={[styles.burstCircle, { backgroundColor: colors.voteRight }]}>
        <Check size={40} strokeWidth={3} color={colors.onAccent} />
      </View>
    </Animated.View>
  );
}

const stylesFor = themedStyles((colors, name) => ({
  post: {
    gap: tokens.spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  byline: {
    flex: 1,
  },
  photoWrap: {
    position: 'relative',
    borderRadius: tokens.radius.large,
    overflow: 'hidden',
  },
  badgeOverlay: {
    position: 'absolute',
    left: tokens.spacing[3],
    bottom: tokens.spacing[3],
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  burst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstCircle: {
    width: 88,
    height: 88,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  meta: {
    gap: tokens.spacing[2],
  },
  comments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
}));
