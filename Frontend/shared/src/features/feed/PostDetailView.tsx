import { ArrowUpRight, Flag, Menu, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  Avatar,
  BottomBar,
  hideWebFocusOutline,
  IconButton,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  SWText,
  VoteChips,
} from '../../components';
import { tokens } from '../../design';
import type { VoteChoice } from '../../types';
import { previewPostDetail } from '../preview/sample-data';

export interface PostDetailViewProps {
  readonly postId?: string;
  readonly onBack?: () => void;
  readonly onMenu?: () => void;
  readonly onSubmitComment?: (body: string) => void;
  readonly onReportComment?: (commentId: string) => void;
  readonly onDeleteComment?: (commentId: string) => void;
}

export function PostDetailView({
  onBack,
  onMenu,
  onSubmitComment,
  onReportComment,
  onDeleteComment,
}: PostDetailViewProps) {
  const post = previewPostDetail;
  const [vote, setVote] = useState<VoteChoice | null>(null);
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0;

  return (
    <Screen
      header={
        <NavHeader
          title="Discussion"
          onBack={onBack}
          banded
          trailing={<IconButton icon={Menu} label="Post menu" onPress={onMenu} />}
        />
      }
      footer={
        <BottomBar>
          <View style={styles.composerRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add your take on the price"
              placeholderTextColor={tokens.color.dark.textMuted}
              selectionColor={tokens.color.dark.accent}
              accessibilityLabel="Write a comment"
              style={[styles.composerInput, hideWebFocusOutline]}
            />
            <IconButton
              icon={ArrowUpRight}
              label="Post comment"
              appearance="accent"
              size={18}
              onPress={() => {
                if (!canSend) return;
                onSubmitComment?.(draft.trim());
                setDraft('');
              }}
            />
          </View>
        </BottomBar>
      }
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.author}>
        <Avatar source={post.author.avatar} name={post.author.handle} size={40} />
        <View>
          <SWText variant="label">@{post.author.handle}</SWText>
          <SWText variant="caption" tone="textMuted">
            {post.createdAgo}
          </SWText>
        </View>
      </Reveal>

      <Reveal index={1} style={styles.post}>
        <SWText variant="bodyMedium">{post.body}</SWText>
        <Photo source={post.photo} label={post.photoLabel} aspectRatio={362 / 239} />
        <VoteChips
          tally={post.votes}
          selected={vote}
          onVote={(choice) => setVote((current) => (current === choice ? null : choice))}
        />
      </Reveal>

      <Reveal index={2} style={styles.discussion}>
        <SWText variant="headingMedium" accessibilityRole="header">
          {post.comments.length} comments
        </SWText>
        {post.comments.map((comment) => (
          <View key={comment.id} style={styles.comment}>
            <Avatar source={comment.author.avatar} name={comment.author.handle} size={32} />
            <View style={styles.commentBody}>
              <View style={styles.commentHeader}>
                <SWText variant="labelSmall">@{comment.author.handle}</SWText>
                <View style={styles.commentActions}>
                  <IconButton
                    icon={Flag}
                    label={`Report comment by ${comment.author.handle}`}
                    tone="textMuted"
                    size={16}
                    onPress={() => onReportComment?.(comment.id)}
                  />
                  {comment.mine ? (
                    <IconButton
                      icon={Trash2}
                      label="Delete your comment"
                      tone="textMuted"
                      size={16}
                      onPress={() => onDeleteComment?.(comment.id)}
                    />
                  ) : null}
                </View>
              </View>
              <SWText variant="bodyCompact">{comment.body}</SWText>
              <SWText variant="caption" tone="textMuted">
                {comment.postedAgo}
              </SWText>
            </View>
          </View>
        ))}
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: tokens.spacing[5],
    gap: tokens.spacing[4],
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  post: {
    gap: tokens.spacing[4],
    paddingBottom: tokens.spacing[6],
    borderBottomWidth: tokens.border.hairline,
    borderBottomColor: tokens.color.dark.borderSubtle,
  },
  discussion: {
    gap: tokens.spacing[4],
    paddingTop: tokens.spacing[2],
  },
  comment: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
  },
  commentBody: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: -tokens.spacing[3],
  },
  commentActions: {
    flexDirection: 'row',
    marginRight: -tokens.spacing[3],
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingVertical: tokens.spacing[3],
  },
  composerInput: {
    flex: 1,
    minHeight: tokens.focus.minimumTarget,
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderStrong,
    backgroundColor: tokens.color.dark.sunken,
    color: tokens.color.dark.textPrimary,
    fontFamily: tokens.typography.family.bodyRegular,
    fontSize: tokens.typography.style.bodyMedium.size,
  },
});
