import { ArrowDown, ArrowUp, Check, Vote, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import {
  Divider,
  EmptyState,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  Surface,
  SWText,
  VerdictBar,
  ZoomLink,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { VoteChoice, VoteCounts } from '../../types';
import {
  formatPeso,
  previewOlderPosts,
  previewPosts,
  previewVotesCast,
  type PreviewPost,
} from '../preview/sample-data';

export interface VotesViewProps {
  readonly onBack?: () => void;
  readonly onOpenPost?: (postId: string) => void;
  readonly onBrowseFeed?: () => void;
}

const voteLook: Record<
  VoteChoice,
  {
    readonly label: string;
    readonly tone: 'voteHigh' | 'voteRight' | 'voteLow';
    readonly icon: LucideIcon;
  }
> = {
  too_high: { label: 'Too High', tone: 'voteHigh', icon: ArrowUp },
  just_right: { label: 'Just Right', tone: 'voteRight', icon: Check },
  too_low: { label: 'Too Low', tone: 'voteLow', icon: ArrowDown },
};

function leading(tally: VoteCounts): VoteChoice {
  const entries = Object.entries(tally) as [VoteChoice, number][];
  return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

/**
 * Every price the viewer has voted on, part of the account's running history. Each row shows
 * their call next to where the community landed, and the header how often they agreed.
 */
export function VotesView({ onBack, onOpenPost, onBrowseFeed }: VotesViewProps) {
  const styles = useThemedStyles(stylesFor);
  const posts = [...previewPosts, ...previewOlderPosts];
  const votes = previewVotesCast.flatMap((entry) => {
    const post = posts.find((candidate) => candidate.id === entry.postId);
    return post ? [{ ...entry, post }] : [];
  });
  const agreed = votes.filter((entry) => entry.vote === leading(entry.post.votes)).length;
  const agreement = votes.length > 0 ? Math.round((agreed / votes.length) * 100) : 0;

  return (
    <Screen
      header={<NavHeader title="Your votes" onBack={onBack} banded />}
      contentStyle={styles.content}
    >
      {votes.length === 0 ? (
        <EmptyState
          icon={Vote}
          title="No votes yet"
          body="Vote on a price in the feed and it shows up here."
          actionLabel="Open the feed"
          onAction={onBrowseFeed}
        />
      ) : (
        <>
          <Reveal index={0} style={styles.stats}>
            <Surface padding={tokens.spacing[4]} style={styles.statTile}>
              <View accessible accessibilityLabel={`${votes.length} votes cast`}>
                <SWText variant="priceMedium">{String(votes.length)}</SWText>
                <SWText variant="labelSmall" tone="textSecondary">
                  Votes cast
                </SWText>
              </View>
            </Surface>
            <Surface padding={tokens.spacing[4]} style={styles.statTile}>
              <View
                accessible
                accessibilityLabel={`You agreed with the community ${agreement} percent of the time`}
              >
                <SWText variant="priceMedium">{`${agreement}%`}</SWText>
                <SWText variant="labelSmall" tone="textSecondary">
                  With the crowd
                </SWText>
              </View>
            </Surface>
          </Reveal>

          <Reveal index={1}>
            <Surface padding={tokens.spacing[2]}>
              {votes.map((entry, index) => (
                <View key={entry.postId}>
                  {index > 0 ? <Divider style={styles.divider} /> : null}
                  <VoteRow
                    post={entry.post}
                    vote={entry.vote}
                    castAgo={entry.castAgo}
                    onOpen={() => onOpenPost?.(entry.postId)}
                  />
                </View>
              ))}
            </Surface>
          </Reveal>
        </>
      )}
    </Screen>
  );
}

function VoteRow({
  post,
  vote,
  castAgo,
  onOpen,
}: {
  readonly post: PreviewPost;
  readonly vote: VoteChoice;
  readonly castAgo: string;
  readonly onOpen: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const look = voteLook[vote];
  const Icon = look.icon;

  return (
    <ZoomLink
      href={`/post/${post.id}`}
      label={`You voted ${look.label} on ${formatPeso(post.estimate)}, ${castAgo}. ${post.body}`}
      onPress={onOpen}
      style={styles.row}
    >
      <Photo
        source={post.photo}
        label={post.photoLabel}
        radius={tokens.radius.small}
        style={styles.thumb}
      />
      <View style={styles.rowText}>
        <View style={styles.topLine}>
          <SWText variant="priceSmall">{formatPeso(post.estimate)}</SWText>
          <SWText variant="caption" tone="textMuted">
            {castAgo}
          </SWText>
        </View>
        <View style={styles.yourVote}>
          <Icon size={14} strokeWidth={2.4} color={colors[look.tone]} />
          <SWText variant="labelSmall" tone={look.tone}>
            You said {look.label}
          </SWText>
        </View>
        <VerdictBar tally={post.votes} />
      </View>
    </ZoomLink>
  );
}

const stylesFor = themedStyles(() => ({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[6],
  },
  stats: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
  },
  statTile: {
    flex: 1,
  },
  divider: {
    marginLeft: tokens.spacing[3] + 64 + tokens.spacing[3],
    marginRight: tokens.spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
  },
  thumb: {
    width: 64,
    height: 64,
  },
  rowText: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing[2],
  },
  yourVote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
}));
