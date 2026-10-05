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

// Tags are labels, not buttons: a hairline and small tracked caps, never a coloured fill.
const stylesFor = themedStyles((colors) => ({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.small - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: 2,
  },
  accent: { borderColor: colors.estimateBorder },
  neutral: {},
  danger: { borderColor: colors.danger },
  outline: {},
  success: { borderColor: colors.success },
  inverse: { backgroundColor: colors.inverse, borderColor: colors.inverse },
}));
