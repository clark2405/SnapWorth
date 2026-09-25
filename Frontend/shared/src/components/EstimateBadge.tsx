import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { SWText } from './SWText';

const estimateCaption = 'AI estimate, not a sale price';

export interface EstimateBadgeProps {
  /** The formatted AI estimate, e.g. "₱2,450". */
  readonly value: string;
  /** `hero` is reserved for the item screen; everywhere else uses `compact`. */
  readonly size?: 'hero' | 'compact';
  /** Formatted low–high range, e.g. "₱2,100 – ₱2,800". */
  readonly range?: string;
}

/**
 * The AI's number always wears the same mark: a sparkle and the accent. It is set apart from
 * asking prices, which are the seller's and are always monochrome.
 */
export function EstimateBadge({ value, size = 'compact', range }: EstimateBadgeProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);

  if (size === 'compact') {
    return (
      <View
        accessible
        accessibilityLabel={`AI estimate ${value}. ${estimateCaption}`}
        style={styles.pill}
      >
        <Sparkles size={13} strokeWidth={2.2} color={colors.accent} />
        <SWText variant="labelSmall" tone="accent">
          AI
        </SWText>
        <SWText variant="priceSmall">{value}</SWText>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`AI estimate ${value}${range ? `, range ${range}` : ''}. ${estimateCaption}`}
      style={styles.hero}
    >
      <View style={styles.heroLabel}>
        <Sparkles size={14} strokeWidth={2.2} color={colors.accent} />
        <SWText variant="overline" tone="accent">
          AI Estimate
        </SWText>
      </View>
      <SWText variant="priceHero">{value}</SWText>
      <SWText variant="caption" tone="textMuted">
        {range ?? estimateCaption}
      </SWText>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    paddingLeft: tokens.spacing[2],
    paddingRight: tokens.spacing[3],
    paddingVertical: tokens.spacing[1] + 1,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.estimateBorder,
  },
  hero: {
    gap: tokens.spacing[1],
  },
  heroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
  },
}));
