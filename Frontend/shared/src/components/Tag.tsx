import { StyleSheet, View } from 'react-native';

import { tokens, type SemanticColorName } from '../design';
import { SWText } from './SWText';

export type TagTone = 'mint' | 'neutral' | 'danger' | 'outline';

const toneStyles = {
  mint: { backgroundColor: tokens.glass.mintFillStrong, borderColor: 'transparent' },
  neutral: { backgroundColor: tokens.glass.fillPressed, borderColor: 'transparent' },
  danger: { backgroundColor: tokens.glass.dangerFill, borderColor: 'transparent' },
  outline: { backgroundColor: tokens.glass.fill, borderColor: tokens.glass.border },
} as const;

const textTone: Record<TagTone, SemanticColorName> = {
  mint: 'accent',
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
    paddingHorizontal: tokens.spacing[1] + 2,
    paddingVertical: 2,
  },
});
