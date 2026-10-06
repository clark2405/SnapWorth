import { ShieldX, Tag as TagIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import {
  BottomBar,
  Button,
  EstimateBadge,
  Field,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  SWText,
  Tag,
  hideWebFocusOutline,
  typeStyle,
  useToast,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { formatPeso, previewItem, previewMyListing } from '../preview/sample-data';

/**
 * What moderation decided about a new post. `approved` goes live; `pending` is live once
 * checked; `held` waits for a human moderator; `blocked` is refused outright and never posted.
 */
export type PostModerationOutcome = 'approved' | 'pending' | 'held' | 'blocked';

export interface CreatePostViewProps {
  readonly itemId?: string;
  /** `listing` reposts a marketplace listing so the community can judge its asking price. */
  readonly source?: 'item' | 'listing';
  /** The moderation result to show; until moderation is wired the post is approved. */
  readonly outcome?: PostModerationOutcome;
  readonly onBack?: () => void;
  readonly onPublish?: (question: string) => void;
}

const maxLength = 280;
const publishDelayMs = 900;

/**
 * Asking the community about an estimate. The estimate travels with the post exactly as it was
 * given, so voters judge the AI's number, not a number the author edited. Publishing pulses
 * briefly, then hands off with a toast so the moment reads as landed, not just dismissed.
 */
export function CreatePostView({
  source = 'item',
  outcome = 'approved',
  onBack,
  onPublish,
}: CreatePostViewProps) {
  const item = previewItem;
  const asking = source === 'listing' ? previewMyListing.askingPrice : null;
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [question, setQuestion] = useState(
    asking === null
      ? `Is ${formatPeso(item.estimate)} right for this ${item.title.toLowerCase()}?`
      : `I'm asking ${formatPeso(asking)} for this ${item.title.toLowerCase()}. Fair price?`,
  );
  const [publishing, setPublishing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimmed = question.trim();
  const canPost = trimmed.length > 0 && trimmed.length <= maxLength;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const publish = () => {
    if (!canPost || publishing) return;
    setPublishing(true);
    timer.current = setTimeout(() => {
      setPublishing(false);
      if (outcome === 'blocked') {
        setBlocked(true);
        return;
      }
      if (outcome === 'held') {
        toast.show({
          title: 'Held for review',
          body: 'A moderator will check it before it appears on the feed.',
        });
      } else if (outcome === 'pending') {
        toast.show({ title: 'Posted', body: 'Others will see it once it has been checked.' });
      } else {
        toast.show({ title: 'Posted to the feed', celebrate: true });
      }
      onPublish?.(trimmed);
    }, publishDelayMs);
  };

  return (
    <Screen
      header={<NavHeader title="Ask the community" onBack={onBack} banded />}
      footer={
        <BottomBar>
          <Button label="Post to feed" disabled={!canPost} loading={publishing} onPress={publish} />
          <SWText variant="caption" tone="textMuted" align="center">
            Posts are public.
          </SWText>
        </BottomBar>
      }
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.lockup}>
        <Photo
          source={item.photo}
          label={item.photoLabel}
          aspectRatio={4 / 3}
          radius={tokens.radius.large}
        />
        <View style={styles.badges}>
          <EstimateBadge value={formatPeso(item.estimate)} />
          {asking === null ? null : (
            <Tag label={`For sale · ${formatPeso(asking)}`} tone="mint" icon={TagIcon} />
          )}
        </View>
      </Reveal>

      {blocked ? (
        <Animated.View
          entering={FadeInDown.springify().damping(18)}
          exiting={FadeOut.duration(tokens.motion.duration.fast)}
          style={styles.blocked}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <ShieldX size={18} strokeWidth={2} color={colors.danger} />
          <View style={styles.blockedText}>
            <SWText variant="label">Not posted</SWText>
            <SWText variant="bodySmall" tone="textSecondary">
              This breaks a community guideline. Edit your question and try again.
            </SWText>
          </View>
        </Animated.View>
      ) : null}

      <Reveal index={1}>
        <Field label="Your question" helper={`${trimmed.length}/${maxLength}`}>
          <TextInput
            value={question}
            onChangeText={(text) => {
              setQuestion(text);
              setBlocked(false);
            }}
            multiline
            maxLength={maxLength}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
            accessibilityLabel="Your question for the community"
            style={[
              styles.input,
              typeStyle('bodyLarge'),
              { color: colors.textPrimary, lineHeight: undefined },
              hideWebFocusOutline,
            ]}
          />
        </Field>
      </Reveal>
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: tokens.spacing[2],
    gap: tokens.spacing[6],
  },
  lockup: {
    gap: tokens.spacing[3],
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
  },
  blocked: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
    backgroundColor: colors.dangerSoft,
  },
  blockedText: {
    flex: 1,
    gap: tokens.spacing['0.5'],
  },
  input: {
    minHeight: tokens.spacing[16] + tokens.spacing[8],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderStrong,
    backgroundColor: colors.sunken,
    textAlignVertical: 'top',
  },
}));
