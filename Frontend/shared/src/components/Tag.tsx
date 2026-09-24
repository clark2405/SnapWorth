import { StyleSheet, View } from 'react-native';

import { tokens, type SemanticColorName } from '../design';
import { SWText } from './SWText';

export type TagTone = 'accent' | 'neutral' | 'danger' | 'outline';

const toneStyles = {
  accent: { backgroundColor: tokens.color.dark.accent, borderColor: tokens.color.dark.accent },
  neutral: {
    backgroundColor: tokens.color.dark.surfaceRaised,
    borderColor: tokens.color.dark.surfaceRaised,
  },
  danger: { backgroundColor: 'transparent', borderColor: tokens.color.dark.danger },
  outline: { backgroundColor: 'transparent', borderColor: tokens.color.dark.borderStrong },
} as const;

const textTone: Record<TagTone, SemanticColorName> = {
  accent: 'onAccent',
  neutral: 'textSecondary',
  danger: 'danger',
  outline: 'textSecondary',
};

export interface TagProps {
  readonly label: string;
  readonly tone?: TagTone;
}

export function Tag({ label, tone = 'neutral' }: TagProps) {
  return (
    <View style={[styles.tag, toneStyles[tone]]}>
      <SWText variant="tag" tone={textTone[tone]}>
        {label}
      </SWText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.small,
    borderWidth: tokens.border.hairline,
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: tokens.spacing['0.5'],
  },
});
