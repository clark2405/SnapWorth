import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import {
  BottomBar,
  Button,
  EstimateBadge,
  Field,
  hideWebFocusOutline,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  SWText,
} from '../../components';
import { tokens } from '../../design';
import { formatPeso, previewItem } from '../preview/sample-data';

export interface CreatePostViewProps {
  readonly itemId?: string;
  readonly onBack?: () => void;
  readonly onPublish?: (question: string) => void;
}

const maxLength = 280;

/**
 * Asking the community about an estimate. The estimate travels with the post exactly as it was
 * given, so voters judge the AI's number, not a number the author edited.
 */
export function CreatePostView({ onBack, onPublish }: CreatePostViewProps) {
  const item = previewItem;
  const [question, setQuestion] = useState(
    `Is ${formatPeso(item.estimate)} right for this ${item.title.toLowerCase()}?`,
  );
  const trimmed = question.trim();
  const canPost = trimmed.length > 0 && trimmed.length <= maxLength;

  return (
    <Screen
      header={<NavHeader title="Ask the feed" onBack={onBack} />}
      footer={
        <BottomBar style={styles.footer}>
          <Button
            label="Post to feed"
            disabled={!canPost}
            onPress={() => {
              if (canPost) onPublish?.(trimmed);
            }}
          />
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
            placeholderTextColor={tokens.color.dark.textMuted}
            selectionColor={tokens.color.dark.accent}
            accessibilityLabel="Your question for the community"
            style={[styles.input, hideWebFocusOutline]}
          />
        </Field>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    borderColor: tokens.color.dark.borderStrong,
    backgroundColor: tokens.color.dark.sunken,
    color: tokens.color.dark.textPrimary,
    fontFamily: tokens.typography.family.bodyRegular,
    fontSize: tokens.typography.style.bodyLarge.size,
    lineHeight: tokens.typography.style.bodyLarge.lineHeight,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingVertical: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
});
