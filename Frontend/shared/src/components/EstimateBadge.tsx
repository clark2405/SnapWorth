import { StyleSheet, View } from 'react-native';

import { themedStyles, tokens, useThemedStyles } from '../design';
import { SWText } from './SWText';

const estimateCaption = 'AI estimate, not a sale price';

export interface EstimateBadgeProps {
  /** The formatted AI estimate, e.g. "₱2,450". */
  readonly value: string;
  /**
   * `hero` is reserved for the item screen; `inline` right-aligns in list rows, price over label;
   * everywhere else uses `compact`.
   */
  readonly size?: 'hero' | 'compact' | 'inline';
  /** Formatted low–high range, e.g. "₱2,100 – ₱2,800". */
  readonly range?: string;
}

/**
 * The AI's number always wears the same mark: a small champagne diamond and a quiet "Est."
 * label. It is set apart from asking prices, which are the seller's and are always bare.
 */
export function EstimateBadge({ value, size = 'compact', range }: EstimateBadgeProps) {
  const styles = useThemedStyles(stylesFor);

  if (size === 'inline') {
    return (
      <View
        accessible
        accessibilityLabel={`AI estimate ${value}. ${estimateCaption}`}
        style={styles.inline}
      >
        <SWText variant="priceSmall">{value}</SWText>
        <View style={styles.heroLabel}>
          <EstimateMark size={5} />
          <SWText variant="tag" tone="textMuted">
            AI Est.
          </SWText>
        </View>
      </View>
    );
  }

  if (size === 'compact') {
    return (
      <View
        accessible
        accessibilityLabel={`AI estimate ${value}. ${estimateCaption}`}
        style={styles.pill}
      >
        <EstimateMark />
        <SWText variant="tag" tone="textSecondary">
          AI Est.
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
        <EstimateMark />
        <SWText variant="overline" tone="textSecondary">
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

/** The estimate's signature: a small accent diamond, used wherever the AI's number appears. */
export function EstimateMark({ size = 6 }: { readonly size?: number }) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.mark, { width: size, height: size }]}
    />
  );
}

const stylesFor = themedStyles((colors) => ({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingLeft: tokens.spacing[3],
    paddingRight: tokens.spacing[3],
    paddingVertical: tokens.spacing[1] + 2,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  hero: {
    gap: tokens.spacing[2],
  },
  inline: {
    alignItems: 'flex-end',
    gap: 2,
  },
  heroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  mark: {
    backgroundColor: colors.accent,
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
}));
