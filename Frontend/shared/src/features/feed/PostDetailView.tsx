import { ArrowUp, Flag, Share as ShareIcon, Trash2 } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { TextInput, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import {
  Avatar,
  BottomBar,
  EstimateBadge,
  IconButton,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  SWText,
  VerdictBar,
  VoteChips,
  ZoomTarget,
  hideWebFocusOutline,
  typeStyle,
  useToast,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { VoteChoice } from '../../types';
import { previewPostDetail, previewProfile } from '../preview/sample-data';

export interface PostDetailViewProps {
  readonly postId?: string;
  readonly onBack?: () => void;
  readonly onShare?: () => void;
  readonly onSubmitComment?: (body: string) => void;
  readonly onReportComment?: (commentId: string) => void;
  readonly onDeleteComment?: (commentId: string) => void;
}

interface PostComment {
  readonly id: string;
  readonly author: { readonly handle: string; readonly avatar: ImageSourcePropType };
  readonly body: string;
  readonly postedAgo: string;
  readonly mine: boolean;
}

/**
 * The discussion behind one post: the photo runs full-bleed under a floating header, the
 * question and community verdict sit below it, and comments arrive from a floating composer,
 * appended live with the same entrance every reveal on the page uses.
 */
export function PostDetailView({
  onBack,
  onShare,
  onSubmitComment,
  onReportComment,
  onDeleteComment,
}: PostDetailViewProps) {
  const post = previewPostDetail;
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [vote, setVote] = useState<VoteChoice | null>(null);
  const [comments, setComments] = useState<readonly PostComment[]>(post.comments);
  const [draft, setDraft] = useState('');
  const counter = useRef(0);
  const canSend = draft.trim().length > 0;
  // The detail preview has no discrete `estimate` field yet; the AI number the author is asking
  // about lives inside their question, so it is read from there for the hero badge.
  const estimateValue = post.body.match(/₱[\d,]+/)?.[0];

  const submit = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    counter.current += 1;
    setComments((current) => [
      {
        id: `local-${counter.current}`,
        author: previewProfile.user,
        body,
        postedAgo: 'Just now',
        mine: true,
      },
      ...current,
    ]);
    setDraft('');
    onSubmitComment?.(body);
    toast.show({ title: 'Comment posted' });
  }, [draft, onSubmitComment, toast]);

  return (
    <Screen
      bleedTop
      header={
        <NavHeader
          title="Discussion"
          onBack={onBack}
          trailing={
            <IconButton
              icon={ShareIcon}
              label="Share this post"
              appearance="glass"
              onPress={onShare}
            />
          }
        />
      }
      footer={
        <BottomBar>
          <View style={styles.composerRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add your take on the price"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.accent}
              accessibilityLabel="Write a comment"
              multiline
              style={[
                styles.composerInput,
                typeStyle('bodyLarge'),
                { color: colors.textPrimary, lineHeight: undefined },
                hideWebFocusOutline,
              ]}
            />
            <IconButton
              icon={ArrowUp}
              label="Post comment"
              appearance="accent"
              size={18}
              haptic={canSend ? 'pop' : 'none'}
              onPress={submit}
            />
          </View>
        </BottomBar>
      }
      contentStyle={styles.content}
    >
      <ZoomTarget>
        <Photo source={post.photo} label={post.photoLabel} aspectRatio={4 / 3} radius={0} />
      </ZoomTarget>

      <View style={styles.body}>
        <Reveal index={0} style={styles.author}>
          <Avatar source={post.author.avatar} name={post.author.handle} size={40} />
          <View>
            <SWText variant="label">@{post.author.handle}</SWText>
            <SWText variant="caption" tone="textMuted">
              {post.createdAgo}
            </SWText>
          </View>
        </Reveal>

        <Reveal index={1} style={styles.question}>
          {estimateValue ? <EstimateBadge value={estimateValue} size="hero" /> : null}
          <SWText variant="bodyLarge">{post.body}</SWText>
        </Reveal>

        <Reveal index={2} style={styles.verdict}>
          <VerdictBar tally={post.votes} />
          <VoteChips
            tally={post.votes}
            selected={vote}
            onVote={(choice) => setVote((current) => (current === choice ? null : choice))}
          />
        </Reveal>

        <Reveal index={3}>
          <SWText variant="headingMedium" accessibilityRole="header">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </SWText>
        </Reveal>

        <View style={styles.discussion}>
          {comments.map((comment, index) => (
            <Animated.View
              key={comment.id}
              entering={FadeInDown.springify()
                .damping(18)
                .delay(Math.min(index, 4) * 50)}
              layout={LinearTransition.springify().damping(20)}
              style={styles.comment}
            >
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
                        onPress={() => {
                          setComments((current) => current.filter((c) => c.id !== comment.id));
                          onDeleteComment?.(comment.id);
                        }}
                      />
                    ) : null}
                  </View>
                </View>
                <SWText variant="bodyCompact">{comment.body}</SWText>
                <SWText variant="caption" tone="textMuted">
                  {comment.postedAgo}
                </SWText>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  body: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingTop: tokens.spacing[5],
    gap: tokens.spacing[5],
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  question: {
    gap: tokens.spacing[2],
  },
  verdict: {
    gap: tokens.spacing[3],
  },
  discussion: {
    gap: tokens.spacing[4],
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
    maxHeight: tokens.spacing[16] + tokens.spacing[8],
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderStrong,
    backgroundColor: colors.sunken,
  },
}));
