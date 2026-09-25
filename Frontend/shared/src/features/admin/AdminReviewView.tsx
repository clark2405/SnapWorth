import { Check, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  Avatar,
  Button,
  EmptyState,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  Surface,
  SWText,
  useToast,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import { previewHeldContent, type PreviewHeldContent } from '../preview/sample-data';

export type ModerationDecision = 'approve' | 'remove';

export interface AdminReviewViewProps {
  readonly onBack?: () => void;
  readonly onDecide?: (contentId: string, decision: ModerationDecision) => void;
}

export function AdminReviewView({ onBack, onDecide }: AdminReviewViewProps) {
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [queue, setQueue] = useState<readonly PreviewHeldContent[]>(previewHeldContent);

  const decide = (content: PreviewHeldContent, decision: ModerationDecision) => {
    onDecide?.(content.id, decision);
    setQueue((current) => current.filter((entry) => entry.id !== content.id));
    toast.show({
      title: decision === 'approve' ? 'Approved' : 'Removed',
      body: `${content.kind === 'post' ? 'Post' : 'Comment'} by @${content.author.handle} ${
        decision === 'approve' ? 'is now public.' : 'was removed.'
      }`,
    });
  };

  return (
    <Screen
      header={<NavHeader title="Review queue" onBack={onBack} />}
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.summary}>
        <SWText variant="displayTitle" accessibilityRole="header">
          {queue.length === 0 ? 'All clear.' : `${queue.length} held`}
        </SWText>
        <SWText variant="bodySmall" tone="textMuted">
          Most reported first. Nothing here is public until you approve it.
        </SWText>
      </Reveal>

      {queue.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="The queue is empty"
          body="New reports and flagged posts will appear here."
        />
      ) : (
        queue.map((content, index) => (
          <Animated.View
            key={content.id}
            exiting={FadeOut.duration(220)}
            layout={LinearTransition.springify().damping(20)}
          >
            <Reveal index={index + 1}>
              <HeldCard content={content} onDecide={(decision) => decide(content, decision)} />
            </Reveal>
          </Animated.View>
        ))
      )}
    </Screen>
  );
}

function HeldCard({
  content,
  onDecide,
}: {
  content: PreviewHeldContent;
  onDecide: (decision: ModerationDecision) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  return (
    <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
      <View style={styles.meta}>
        <SWText variant="overline" tone="warning">
          {`${content.kind} · ${content.reports} ${content.reports === 1 ? 'report' : 'reports'}`}
        </SWText>
        <SWText variant="caption" tone="textMuted">
          {`Held ${content.heldAgo}`}
        </SWText>
      </View>
      <SWText variant="labelMedium" tone="textSecondary">
        {content.reason}
      </SWText>
      <View style={styles.author}>
        <Avatar source={content.author.avatar} name={content.author.handle} size={28} />
        <SWText variant="labelSmall">@{content.author.handle}</SWText>
      </View>
      <SWText variant="bodyMedium">{content.body}</SWText>
      {content.photo ? (
        <Photo
          source={content.photo}
          label={content.photoLabel ?? 'Photo attached to the held post'}
          aspectRatio={16 / 9}
        />
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Remove"
          variant="danger"
          icon={Trash2}
          onPress={() => onDecide('remove')}
          containerStyle={styles.action}
        />
        <Button
          label="Approve"
          variant="primary"
          icon={Check}
          onPress={() => onDecide('approve')}
          containerStyle={styles.action}
        />
      </View>
    </Surface>
  );
}

const stylesFor = themedStyles(() => ({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[4],
  },
  summary: {
    gap: tokens.spacing[1],
    marginBottom: tokens.spacing[2],
  },
  card: {
    gap: tokens.spacing[3],
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    marginTop: tokens.spacing[1],
  },
  action: {
    flex: 1,
  },
}));
