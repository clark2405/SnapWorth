import { Camera, Flame } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  LargeTitle,
  Overline,
  Photo,
  ZoomLink,
  ZoomSource,
  Reveal,
  Screen,
  SearchButton,
  SWText,
  type SearchOrigin,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import type { VoteChoice } from '../../types';
import { previewOlderPosts, previewPosts, previewTrending } from '../preview/sample-data';
import { ProfileButton } from '../profile/ProfileButton';
import { useAccountGate } from '../session';
import { Tip, useTip } from '../tips';
import { PostCard } from './PostCard';

export interface FeedViewProps {
  readonly onOpenPost?: (postId: string) => void;
  readonly onSearch?: (origin?: SearchOrigin) => void;
  readonly onOpenProfile?: () => void;
  /**
   * Opens the camera from the header, for shells without a persistent Snap control (the web);
   * on iOS, Snap rides above the tab bar instead.
   */
  readonly onSnap?: () => void;
  /** Opens a "Hot this month" category's trend screen, by its key (where links need a hand). */
  readonly onOpenTrend?: (trendKey: string) => void;
  /** Shares a link to a post, from its press-and-hold menu. */
  readonly onSharePost?: (postId: string) => void;
}

type PreviewTrend = (typeof previewTrending)[number];

/** Newest first, the older ones further down, as the feed reads once it has history. */
const feedPosts = [...previewPosts, ...previewOlderPosts];

/**
 * The community's front page: what is trending this month, then every open question, newest
 * first. Nothing here is a hard card; posts are set apart by air, not rules.
 */
export function FeedView({
  onOpenPost,
  onSearch,
  onOpenProfile,
  onSnap,
  onOpenTrend,
  onSharePost,
}: FeedViewProps) {
  const styles = useThemedStyles(stylesFor);
  // Local until VoteService exists: tapping the same vote again withdraws it.
  const [votes, setVotes] = useState<Record<string, VoteChoice | null>>({});
  const requireAccount = useAccountGate();
  const voteTip = useTip('vote');

  return (
    <Screen
      clearTabBar
      ambient="feed"
      onRefresh={() => new Promise<void>((resolve) => setTimeout(resolve, 900))}
    >
      <LargeTitle
        brand
        title="Feed"
        trailing={
          <View style={styles.actions}>
            {onSnap ? (
              <Button
                label="Snap"
                size="small"
                variant="secondary"
                icon={Camera}
                onPress={onSnap}
              />
            ) : null}
            {/* On iOS, search is a tab of its own; shells without one pass onSearch. */}
            {onSearch ? <SearchButton label="Search the feed" onOpen={onSearch} /> : null}
            <ProfileButton onPress={onOpenProfile} />
          </View>
        }
      />
      <Tip id="snap" style={styles.tip} />

      <Reveal index={0} style={styles.trending}>
        <Overline icon={Flame} label="Hot this month" style={styles.trendingTitle} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.trendingBleed}
          contentContainerStyle={styles.trendingRow}
        >
          {previewTrending.map((trend) => (
            <TrendingTile key={trend.key} trend={trend} onOpen={() => onOpenTrend?.(trend.key)} />
          ))}
        </ScrollView>
      </Reveal>

      <View style={styles.list}>
        {feedPosts.map((post, index) => (
          <Reveal key={post.id} index={index + 1} style={index > 0 ? styles.divided : null}>
            <PostCard
              post={post}
              vote={votes[post.id] ?? null}
              onVote={(choice) =>
                requireAccount('vote', () => {
                  voteTip.done();
                  setVotes((current) => ({
                    ...current,
                    [post.id]: current[post.id] === choice ? null : choice,
                  }));
                })
              }
              onOpen={() => onOpenPost?.(post.id)}
              onShare={onSharePost ? () => onSharePost(post.id) : undefined}
            />
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

function TrendingTile({
  trend,
  onOpen,
}: {
  readonly trend: PreviewTrend;
  readonly onOpen: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const rising = trend.change.trim().startsWith('+');

  // Zooms open into the trend's own screen on iOS, the photo carrying straight across.
  return (
    <ZoomLink
      href={`/trend/${trend.key}`}
      label={`${trend.label}, ${trend.change} this month. See what's selling`}
      onPress={onOpen}
      zoomFromSource
      style={styles.tile}
    >
      <ZoomSource>
        <Photo
          source={trend.photo}
          label={trend.label}
          radius={tokens.radius.large}
          style={styles.tilePhoto}
        />
      </ZoomSource>
      <SWText variant="labelSmall" numberOfLines={1}>
        {trend.label}
      </SWText>
      <SWText variant="caption" tone={rising ? 'success' : 'danger'}>
        {trend.change}
      </SWText>
    </ZoomLink>
  );
}

const stylesFor = themedStyles((colors) => ({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  trending: {
    gap: tokens.spacing[4],
    marginBottom: tokens.spacing[10],
  },
  trendingTitle: {},
  trendingBleed: {
    marginHorizontal: -tokens.layout.pageGutterCompact,
    flexGrow: 0,
  },
  trendingRow: {
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.pageGutterCompact,
  },
  tile: {
    width: 120,
    gap: tokens.spacing['0.5'],
  },
  tilePhoto: {
    width: 120,
    height: 120,
    marginBottom: tokens.spacing[2],
  },
  list: {
    gap: 0,
  },
  tip: {
    marginBottom: tokens.spacing[6],
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
}));
