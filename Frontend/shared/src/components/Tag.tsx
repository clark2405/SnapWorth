import { StyleSheet, View } from 'react-native';

import { themedStyles, tokens, useThemedStyles, type SemanticColorName } from '../design';
import { SWText } from './SWText';

export type TagTone = 'accent' | 'neutral' | 'danger' | 'outline' | 'success' | 'inverse';

const textTone: Record<TagTone, SemanticColorName> = {
  accent: 'accent',
  neutral: 'textSecondary',
  danger: 'danger',
  outline: 'textSecondary',
  success: 'success',
  inverse: 'onInverse',
};

export interface TagProps {
  readonly label: string;
  readonly tone?: TagTone;
}

export function Tag({ label, tone = 'neutral' }: TagProps) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={[styles.tag, styles[tone]]}>
      <SWText variant="tag" tone={textTone[tone]}>
        {label}
      </SWText>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingHorizontal: tokens.spacing[2] + 2,
    paddingVertical: 3,
  },
  accent: { backgroundColor: colors.accentSoft },
  neutral: { backgroundColor: colors.sunken },
  danger: { borderColor: colors.danger },
  outline: { borderColor: colors.borderStrong },
  success: { backgroundColor: colors.sunken },
  inverse: { backgroundColor: colors.inverse },
}));
