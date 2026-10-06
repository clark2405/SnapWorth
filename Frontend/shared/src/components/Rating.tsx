import { Star } from 'lucide-react-native';
import { View } from 'react-native';

import {
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type SemanticColorName,
  type TypographyStyleName,
} from '../design';
import { SWText } from './SWText';

export interface RatingProps {
  /** The score as shown, e.g. 4.8 or "4.8". */
  readonly value: number | string;
  /** Trailing context, e.g. "42 sales". */
  readonly detail?: string;
  readonly variant?: TypographyStyleName;
  readonly tone?: SemanticColorName;
}

/** A seller rating: a small filled star drawn as an SVG, then the score and any context. */
export function Rating({ value, detail, variant = 'caption', tone = 'textMuted' }: RatingProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const size = variant === 'caption' ? 12 : 14;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Rated ${value}${detail ? `, ${detail}` : ''}`}
    >
      <Star size={size} strokeWidth={0} fill={colors.textPrimary} />
      <SWText variant={variant} tone={tone}>
        {value}
        {detail ? ` · ${detail}` : ''}
      </SWText>
    </View>
  );
}

const stylesFor = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
}));
