import { Camera, Flame } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  LargeTitle,
  Overline,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  SearchButton,
  SWText,
  type SearchOrigin,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import type { VoteChoice } from '../../types';
import { previewPosts, previewTrending } from '../preview/sample-data';
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
}

type PreviewTrend = (typeof previewTrending)[number];

/**
 * The community's front page: what is trending this month, then every open question, newest
 * first. Nothing here is a hard card; posts are set apart by air, not rules.
 */
export function FeedView({ onOpenPost, onSearch, onOpenProfile, onSnap }: FeedViewProps) {
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
            <TrendingTile key={trend.key} trend={trend} />
          ))}
        </ScrollView>
      </Reveal>

      <View style={styles.list}>
        {previewPosts.map((post, index) => (
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
            />
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

function TrendingTile({ trend }: { readonly trend: PreviewTrend }) {
  const styles = useThemedStyles(stylesFor);
  const rising = trend.change.trim().startsWith('+');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${trend.label}, ${trend.change} this month`}
      depth="surface"
      style={styles.tile}
    >
      <Photo
        source={trend.photo}
        label={trend.label}
        radius={tokens.radius.large}
        style={styles.tilePhoto}
      />
      <SWText variant="labelSmall" numberOfLines={1}>
        {trend.label}
      </SWText>
      <SWText variant="caption" tone={rising ? 'success' : 'danger'}>
        {trend.change}
      </SWText>
    </PressableScale>
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
