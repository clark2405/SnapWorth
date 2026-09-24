import { EllipsisVertical, MessageCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  EstimateBadge,
  IconButton,
  Photo,
  PressableScale,
  SWText,
  VoteChips,
} from '../../components';
import { tokens } from '../../design';
import type { VoteChoice } from '../../types';
import { formatPeso, type PreviewPost } from '../preview/sample-data';
import { CommunityVerdict } from './CommunityVerdict';

export interface PostCardProps {
  readonly post: PreviewPost;
  readonly vote?: VoteChoice | null;
  readonly onVote?: (vote: VoteChoice) => void;
  readonly onOpen?: () => void;
  readonly onMore?: () => void;
}

/**
 * One feed beat: photo and estimate lead, the author's question frames them, and the vote is
 * the action. No card chrome; posts are separated by rules and space.
 */
export function PostCard({ post, vote, onVote, onOpen, onMore }: PostCardProps) {
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
        <IconButton
          icon={EllipsisVertical}
          label="Post options"
          tone="textMuted"
          onPress={onMore}
          size={18}
        />
      </View>

      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`Open discussion: ${post.body}`}
        onPress={onOpen}
        style={styles.lockup}
      >
        <Photo
          source={post.photo}
          label={post.photoLabel}
          aspectRatio={4 / 3}
          radius={tokens.radius.large}
        />
        <EstimateBadge value={formatPeso(post.estimate)} />
        <SWText variant="bodyMedium">{post.body}</SWText>
      </PressableScale>

      <VoteChips tally={post.votes} selected={vote} onVote={onVote} />

      <View style={styles.footer}>
        <CommunityVerdict votes={post.votes} />
        <View style={styles.comments} accessibilityLabel={`${post.commentCount} comments`}>
          <MessageCircle size={16} strokeWidth={1.75} color={tokens.color.dark.textMuted} />
          <SWText variant="labelMedium" tone="textMuted">
            {post.commentCount}
          </SWText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    gap: tokens.spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    marginRight: -tokens.spacing[3],
  },
  byline: {
    flex: 1,
  },
  lockup: {
    gap: tokens.spacing[3],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
});
