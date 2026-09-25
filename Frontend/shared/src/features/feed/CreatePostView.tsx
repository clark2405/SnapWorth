import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';

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
  hideWebFocusOutline,
  typeStyle,
  useToast,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { formatPeso, previewItem } from '../preview/sample-data';

export interface CreatePostViewProps {
  readonly itemId?: string;
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
export function CreatePostView({ onBack, onPublish }: CreatePostViewProps) {
  const item = previewItem;
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [question, setQuestion] = useState(
    `Is ${formatPeso(item.estimate)} right for this ${item.title.toLowerCase()}?`,
  );
  const [publishing, setPublishing] = useState(false);
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
      toast.show({ title: 'Posted to the feed' });
      onPublish?.(trimmed);
    }, publishDelayMs);
  };

  return (
    <Screen
      header={<NavHeader title="Ask the community" onBack={onBack} banded />}
      footer={
        <BottomBar style={styles.footer}>
          <Button label="Post to feed" disabled={!canPost} loading={publishing} onPress={publish} />
          <SWText variant="caption" tone="textMuted" align="center">
            Posts are public. The community votes Too High, Just Right, or Too Low.
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
        <EstimateBadge value={formatPeso(item.estimate)} />
      </Reveal>

      <Reveal index={1}>
        <Field
          label="Your question"
          helper={`${trimmed.length}/${maxLength} · Mention condition, size, or anything the photo does not show.`}
        >
          <TextInput
            value={question}
            onChangeText={setQuestion}
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
  input: {
    minHeight: tokens.spacing[16] + tokens.spacing[8],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderStrong,
    backgroundColor: colors.sunken,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingVertical: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
}));
