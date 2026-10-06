import { Clock3, CornerDownRight, Flag, ShieldAlert, Trash2 } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Avatar, IconButton, PressableScale, SWText, Tag } from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { ThreadComment } from '../../types/entities';
import { previewAvatarByHandle } from '../preview/sample-data';
import { relativeTime, type ThreadGroup } from './comment-thread-model';

export interface CommentListProps {
  readonly groups: readonly ThreadGroup[];
  readonly onReply: (comment: ThreadComment) => void;
  readonly onDelete: (comment: ThreadComment) => void;
  readonly onReport: (comment: ThreadComment) => void;
}

/**
 * A post's discussion, one level deep: each comment with its replies tucked beneath it. Replies
 * whose parent was deleted keep their place under a quiet placeholder.
 */
export function CommentList({ groups, onReply, onDelete, onReport }: CommentListProps) {
  const styles = useThemedStyles(stylesFor);

  return (
    <View style={styles.list}>
      {groups.map((group, index) => (
        <Animated.View
          key={group.id}
          entering={FadeInDown.springify()
            .damping(18)
            .delay(Math.min(index, 4) * 50)}
          layout={LinearTransition.springify().damping(20)}
          style={styles.group}
        >
          {group.comment ? (
            <CommentRow
              comment={group.comment}
              onReply={onReply}
              onDelete={onDelete}
              onReport={onReport}
            />
          ) : (
            <SWText variant="bodySmall" tone="textMuted" style={styles.removed}>
              This comment was removed.
            </SWText>
          )}
          {group.replies.length > 0 ? (
            <View style={styles.replies}>
              {group.replies.map((reply) => (
                <Animated.View
                  key={reply.id}
                  entering={FadeIn.duration(tokens.motion.duration.base)}
                  layout={LinearTransition.springify().damping(20)}
                >
                  <CommentRow
                    comment={reply}
                    compact
                    onReply={onReply}
                    onDelete={onDelete}
                    onReport={onReport}
                  />
                </Animated.View>
              ))}
            </View>
          ) : null}
        </Animated.View>
      ))}
    </View>
  );
}

function CommentRow({
  comment,
  compact = false,
  onReply,
  onDelete,
  onReport,
}: {
  readonly comment: ThreadComment;
  readonly compact?: boolean;
  readonly onReply: (comment: ThreadComment) => void;
  readonly onDelete: (comment: ThreadComment) => void;
  readonly onReport: (comment: ThreadComment) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const { author } = comment;
  // Only approved comments can be answered: anything else is invisible to everyone else.
  const canReply = comment.moderationStatus === 'approved';

  return (
    <View style={styles.row}>
      <AuthorAvatar handle={author.handle} avatarUrl={author.avatarUrl} size={compact ? 28 : 36} />
      <View style={styles.body}>
        <View style={styles.header}>
          <SWText variant="labelSmall" numberOfLines={1} style={styles.handle}>
            @{author.handle}
          </SWText>
          <SWText variant="caption" tone="textMuted">
            {relativeTime(comment.createdAt)}
          </SWText>
        </View>

        <SWText variant="bodyCompact">{comment.body}</SWText>

        {comment.isMine && comment.moderationStatus === 'pending' ? (
          <Tag label="Checking before it goes public" tone="sand" icon={Clock3} />
        ) : null}
        {comment.isMine && comment.moderationStatus === 'held' ? (
          <Tag label="Held for review · only you can see this" tone="warn" icon={ShieldAlert} />
        ) : null}

        <View style={styles.actions}>
          {canReply ? (
            <PressableScale
              accessibilityLabel={`Reply to @${author.handle}`}
              haptic="select"
              hitSlop={tokens.spacing[2]}
              onPress={() => onReply(comment)}
              style={styles.reply}
            >
              <CornerDownRight size={14} strokeWidth={2} color={colors.textSecondary} />
              <SWText variant="labelSmall" tone="textSecondary">
                Reply
              </SWText>
            </PressableScale>
          ) : null}
          <View style={styles.spacer} />
          {comment.isMine ? (
            <IconButton
              icon={Trash2}
              label={compact ? 'Delete your reply' : 'Delete your comment'}
              tone="textMuted"
              size={16}
              onPress={() => onDelete(comment)}
            />
          ) : comment.reportedByMe ? (
            <View style={styles.reported} accessible accessibilityLabel="You reported this comment">
              <Flag size={14} strokeWidth={2} color={colors.textMuted} />
              <SWText variant="caption" tone="textMuted">
                Reported
              </SWText>
            </View>
          ) : (
            <IconButton
              icon={Flag}
              label={`Report comment by ${author.handle}`}
              tone="textMuted"
              size={16}
              onPress={() => onReport(comment)}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/** The author's photo; demo accounts use their bundled photo, anyone else their initial. */
function AuthorAvatar({
  handle,
  avatarUrl,
  size,
}: {
  readonly handle: string;
  readonly avatarUrl?: string;
  readonly size: number;
}) {
  const styles = useThemedStyles(stylesFor);
  const source = avatarUrl ? { uri: avatarUrl } : previewAvatarByHandle[handle];
  if (source) return <Avatar source={source} name={handle} size={size} />;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.initial, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <SWText variant="labelSmall" tone="textSecondary">
        {handle.charAt(0).toUpperCase()}
      </SWText>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  list: {
    gap: tokens.spacing[6],
  },
  group: {
    gap: tokens.spacing[4],
  },
  removed: {
    paddingVertical: tokens.spacing[1],
  },
  // Replies sit under their parent's text column, set off by a hairline.
  replies: {
    marginLeft: 36 + tokens.spacing[3],
    paddingLeft: tokens.spacing[3],
    borderLeftWidth: 2,
    borderLeftColor: colors.borderSubtle,
    gap: tokens.spacing[4],
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
  },
  body: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: tokens.spacing[2],
  },
  handle: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    marginTop: -tokens.spacing[1],
    marginBottom: -tokens.spacing[2],
  },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    paddingVertical: tokens.spacing[1],
  },
  spacer: {
    flex: 1,
  },
  reported: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    minHeight: tokens.focus.minimumTarget,
    paddingHorizontal: tokens.spacing[3],
  },
  initial: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sand,
  },
}));
