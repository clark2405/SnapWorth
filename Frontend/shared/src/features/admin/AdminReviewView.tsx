import { Check, EyeOff, ShieldCheck, ShieldOff, Trash2, WifiOff, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import {
  paperLayout,
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
  type ButtonVariant,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import type { ReviewCase, ReviewDecision } from '../../ports/admin';
import { useAdminReview } from './admin-state';
import {
  ageLabel,
  decisionLabels,
  decisionToast,
  flagReason,
  kindLabel,
  reviewActions,
  reviewErrorCopy,
} from './review-model';

export interface AdminReviewViewProps {
  readonly onBack?: () => void;
}

const decisionButtons = {
  approve: { variant: 'secondary', icon: Check },
  hold: { variant: 'tertiary', icon: EyeOff },
  remove: { variant: 'danger', icon: Trash2 },
  dismiss: { variant: 'secondary', icon: X },
} as const satisfies Record<
  ReviewDecision,
  { readonly variant: ButtonVariant; readonly icon: typeof Check }
>;

/**
 * What moderation has held and what people have reported, for an admin to decide. The list and
 * every decision come from the database, which checks the caller is an admin: this screen only
 * shows what it's given, and says so plainly when the answer is no.
 */
export function AdminReviewView({ onBack }: AdminReviewViewProps) {
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const { status, cases, refresh, decide } = useAdminReview();
  const [deciding, setDeciding] = useState<string | null>(null);

  const act = async (item: ReviewCase, decision: ReviewDecision) => {
    setDeciding(item.id);
    const result = await decide(item, decision);
    setDeciding(null);
    toast.show(
      result.ok
        ? decisionToast(item, decision)
        : { ...reviewErrorCopy(result.error), tone: 'error' },
    );
  };

  return (
    <Screen
      header={<NavHeader title="Review queue" onBack={onBack} />}
      contentStyle={styles.content}
    >
      {status === 'denied' ? (
        <EmptyState
          icon={ShieldOff}
          title="This is for admins"
          body="Your account can’t review content. If that’s wrong, ask whoever runs SnapWorth."
        />
      ) : status === 'failed' ? (
        <EmptyState
          icon={WifiOff}
          tone="error"
          title="Couldn’t load the queue"
          body="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void refresh()}
        />
      ) : status === 'loading' ? null : (
        <>
          <Reveal index={0} style={styles.summary}>
            <SWText variant="displayMedium" accessibilityRole="header">
              {cases.length === 0 ? 'All clear.' : `${cases.length} to review`}
            </SWText>
            <SWText variant="bodySmall" tone="textMuted">
              Most reported first. Held content isn’t public until you approve it.
            </SWText>
          </Reveal>

          {cases.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="The queue is empty"
              body="New reports and flagged posts will appear here."
            />
          ) : (
            cases.map((item, index) => (
              <Animated.View key={item.id} exiting={FadeOut.duration(220)} layout={paperLayout}>
                <Reveal index={index + 1}>
                  <CaseCard
                    item={item}
                    busy={deciding === item.id}
                    onDecide={(decision) => void act(item, decision)}
                  />
                </Reveal>
              </Animated.View>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

function CaseCard({
  item,
  busy,
  onDecide,
}: {
  item: ReviewCase;
  busy: boolean;
  onDecide: (decision: ReviewDecision) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  return (
    <Surface padding={tokens.spacing[4]} contentStyle={styles.card}>
      <View style={styles.meta}>
        <SWText variant="overline" tone="warning">
          {item.reportCount > 0
            ? `${kindLabel(item.kind)} · ${item.reportCount} ${item.reportCount === 1 ? 'report' : 'reports'}`
            : kindLabel(item.kind)}
        </SWText>
        <SWText variant="caption" tone="textMuted">
          {`Flagged ${ageLabel(item.flaggedAt)}`}
        </SWText>
      </View>
      <SWText variant="labelMedium" tone="textSecondary">
        {flagReason(item)}
      </SWText>
      <View style={styles.author}>
        {item.authorAvatarUrl ? (
          <Avatar source={{ uri: item.authorAvatarUrl }} name={item.authorHandle} size={28} />
        ) : (
          <View accessibilityElementsHidden importantForAccessibility="no" style={styles.initial}>
            <SWText variant="labelSmall" tone="textSecondary">
              {item.authorHandle.charAt(0).toUpperCase()}
            </SWText>
          </View>
        )}
        <SWText variant="labelSmall">@{item.authorHandle}</SWText>
      </View>
      {item.title ? (
        <SWText variant="headingSmall" accessibilityRole="header">
          {item.title}
        </SWText>
      ) : null}
      {item.photoUrl ? (
        <Photo
          source={{ uri: item.photoUrl }}
          label={`Photo on the ${kindLabel(item.kind).toLowerCase()} by @${item.authorHandle}`}
          aspectRatio={4 / 3}
          style={styles.photo}
        />
      ) : null}
      {item.body ? <SWText variant="bodyMedium">{item.body}</SWText> : null}
      {item.context ? (
        <SWText variant="bodySmall" tone="textSecondary">
          {item.context}
        </SWText>
      ) : null}
      <View style={styles.actions}>
        {reviewActions(item).map((decision) => (
          <Button
            key={decision}
            label={decisionLabels[decision]}
            variant={decisionButtons[decision].variant}
            icon={decisionButtons[decision].icon}
            disabled={busy}
            onPress={() => onDecide(decision)}
            containerStyle={styles.action}
          />
        ))}
      </View>
    </Surface>
  );
}

const stylesFor = themedStyles((colors) => ({
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
  photo: {
    alignSelf: 'stretch',
    maxHeight: 280,
  },
  initial: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[3],
    marginTop: tokens.spacing[1],
  },
  action: {
    flexGrow: 1,
    flexBasis: 120,
  },
}));
