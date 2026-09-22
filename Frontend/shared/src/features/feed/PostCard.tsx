import { EllipsisVertical, MessageCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  GlassCard,
  IconButton,
  Photo,
  PressableScale,
  SWText,
  VoteChips,
} from '../../components';
import { tokens } from '../../design';
import type { VoteChoice } from '../../types';
import type { PreviewPost } from '../preview/sample-data';
import { CommunityVerdict } from './CommunityVerdict';

export interface PostCardProps {
  readonly post: PreviewPost;
  readonly vote?: VoteChoice | null;
  readonly onVote?: (vote: VoteChoice) => void;
  readonly onOpen?: () => void;
  readonly onMore?: () => void;
}

export function PostCard({ post, vote, onVote, onOpen, onMore }: PostCardProps) {
  return (
    <GlassCard padding={tokens.spacing[4]}>
      <View style={styles.header}>
        <Avatar source={post.author.avatar} name={post.author.handle} />
        <View style={styles.byline}>
          <SWText variant="label">@{post.author.handle}</SWText>
          <SWText variant="caption" tone="textMuted">
            {post.postedAgo}
          </SWText>
        </View>
        <IconButton icon={EllipsisVertical} label="Post options" onPress={onMore} size={20} />
      </View>

      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`Open discussion: ${post.body}`}
        onPress={onOpen}
        style={styles.body}
      >
        <SWText variant="bodySmall">{post.body}</SWText>
        <Photo
          source={post.photo}
          label={post.photoLabel}
          aspectRatio={3 / 2}
          radius={tokens.radius.medium}
        />
      </PressableScale>

      <VoteChips tally={post.votes} selected={vote} onVote={onVote} />

      <View style={styles.footer}>
        <CommunityVerdict votes={post.votes} />
        <View style={styles.comments} accessibilityLabel={`${post.commentCount} comments`}>
          <MessageCircle size={18} strokeWidth={1.75} color={tokens.color.dark.textMuted} />
          <SWText variant="labelMedium" tone="textMuted">
            {post.commentCount}
          </SWText>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  byline: {
    flex: 1,
  },
  body: {
    gap: tokens.spacing[3],
    marginTop: tokens.spacing[3],
    marginBottom: tokens.spacing[4],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing[4],
    paddingTop: tokens.spacing[3],
    borderTopWidth: tokens.border.hairline,
    borderTopColor: tokens.glass.border,
  },
  comments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1] + 2,
  },
});
