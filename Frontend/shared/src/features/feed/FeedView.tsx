import { Flame } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  LargeTitle,
  Photo,
  Sign,
  SnapIcon,
  Sticker,
  ZoomLink,
  ZoomSource,
  Reveal,
  Screen,
  SearchButton,
  SWText,
  useGridColumns,
  type SearchOrigin,
} from '../../components';
import { held, themedStyles, tokens, useThemedStyles, useWideLayout } from '../../design';
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
  // One column of posts on a phone; on a wide window as many as fit, up to three.
  const grid = useGridColumns(feedPosts.length, {
    minWidth: postMinWidth,
    maxColumns: 3,
    gap: tokens.spacing[8],
  });
  const gridded = grid.columns > 1;
  const wide = useWideLayout();

  return (
    <Screen
      clearTabBar
      place="feed"
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
                icon={SnapIcon}
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
        <Sign icon={Flame} label="Hot this month" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.trendingBleed}
          contentContainerStyle={styles.trendingRow}
        >
          {previewTrending.map((trend) => (
            <TrendingTile
              key={trend.key}
              trend={trend}
              size={wide ? wideTile : tile}
              onOpen={() => onOpenTrend?.(trend.key)}
            />
          ))}
        </ScrollView>
      </Reveal>

      <View style={gridded ? styles.grid : styles.list} onLayout={grid.onLayout}>
        {feedPosts.map((post, index) => (
          <Reveal
            key={post.id}
            index={index + 1}
            style={gridded ? { width: grid.cellWidth } : index > 0 ? styles.divided : null}
          >
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

/** A trend tile's photo: a thumb's width on a phone, larger where there's room. */
const tile = 116;
const wideTile = 172;
/** The narrowest a post can be and still give its photo and vote chips room. */
const postMinWidth = 340;

function TrendingTile({
  trend,
  size,
  onOpen,
}: {
  readonly trend: PreviewTrend;
  readonly size: number;
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
      style={[styles.tile, { width: size + 4 }]}
    >
      <View style={styles.tileFrame}>
        <ZoomSource>
          <Photo
            source={trend.photo}
            label={trend.label}
            radius={tokens.radius.large - 2}
            style={{ width: size, height: size }}
          />
        </ZoomSource>
        {/* The month's move, slapped on like a market sticker. */}
        <Sticker
          label={trend.change}
          tone={rising ? 'marigold' : 'cobalt'}
          style={styles.tileSticker}
        />
      </View>
      <SWText variant="labelSmall" numberOfLines={1}>
        {trend.label}
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
  trendingBleed: {
    marginHorizontal: -tokens.layout.pageGutterCompact,
    flexGrow: 0,
  },
  trendingRow: {
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.pageGutterCompact,
  },
  tile: {
    gap: tokens.spacing['0.5'],
  },
  tileFrame: {
    borderRadius: tokens.radius.large,
    marginBottom: tokens.spacing[2],
    ...held(colors),
  },
  tileSticker: {
    position: 'absolute',
    left: tokens.spacing[2],
    bottom: tokens.spacing[4],
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  list: {
    gap: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    columnGap: tokens.spacing[8],
    rowGap: tokens.spacing[6],
  },
  tip: {
    marginBottom: tokens.spacing[6],
  },
}));
