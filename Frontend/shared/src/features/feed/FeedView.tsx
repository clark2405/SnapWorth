import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  IconButton,
  LargeTitle,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  SWText,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import type { VoteChoice } from '../../types';
import { previewPosts, previewTrending } from '../preview/sample-data';
import { ProfileButton } from '../profile/ProfileButton';
import { PostCard } from './PostCard';

export interface FeedViewProps {
  readonly onOpenPost?: (postId: string) => void;
  readonly onSearch?: () => void;
  readonly onOpenProfile?: () => void;
}

type PreviewTrend = (typeof previewTrending)[number];

/**
 * The community's front page: what is trending this month, then every open question, newest
 * first. Nothing here is a hard card; posts are set apart by air, not rules.
 */
export function FeedView({ onOpenPost, onSearch, onOpenProfile }: FeedViewProps) {
  const styles = useThemedStyles(stylesFor);
  // Local until VoteService exists: tapping the same vote again withdraws it.
  const [votes, setVotes] = useState<Record<string, VoteChoice | null>>({});

  return (
    <Screen
      clearTabBar
      ambient="value"
      onRefresh={() => new Promise<void>((resolve) => setTimeout(resolve, 900))}
    >
      <LargeTitle
        title="Feed"
        subtitle="Vote on whether the AI got the price right."
        trailing={
          <View style={styles.actions}>
            <IconButton
              icon={Search}
              label="Search the feed"
              appearance="tinted"
              onPress={onSearch}
            />
            <ProfileButton onPress={onOpenProfile} />
          </View>
        }
      />

      <Reveal index={0} style={styles.trending}>
        <SWText
          variant="overline"
          tone="textMuted"
          style={styles.trendingTitle}
          accessibilityRole="header"
        >
          Trending this month
        </SWText>
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
          <Reveal key={post.id} index={index + 1}>
            <PostCard
              post={post}
              vote={votes[post.id] ?? null}
              onVote={(choice) =>
                setVotes((current) => ({
                  ...current,
                  [post.id]: current[post.id] === choice ? null : choice,
                }))
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

const stylesFor = themedStyles(() => ({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  trending: {
    gap: tokens.spacing[3],
    marginBottom: tokens.spacing[8],
  },
  trendingTitle: {
    paddingHorizontal: tokens.spacing['0.5'],
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
    width: 112,
    gap: tokens.spacing[1],
  },
  tilePhoto: {
    width: 112,
    height: 112,
  },
  list: {
    gap: tokens.spacing[8],
  },
}));
