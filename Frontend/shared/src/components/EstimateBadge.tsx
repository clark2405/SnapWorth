import { View } from 'react-native';

import { themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { AiFoil, AiFoilDot } from './AiFoil';
import { TagShape } from './PriceTag';
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
 * The AI's number always hangs on a price tag: a manila tag with an eyelet, its label printed
 * in mono, and the holographic AI foil on it (`AiFoil`), so it reads as the AI's at a glance.
 * It sets the estimate apart from asking prices, which are the seller's and always bare. Text on
 * the tag uses the tag's own ink in either appearance, since the tag stays manila.
 */
export function EstimateBadge({ value, size = 'compact', range }: EstimateBadgeProps) {
  const { colors } = useTheme();
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
          <EstimateMark size={7} />
          <SWText variant="stamp" tone="textMuted">
            AI Est.
          </SWText>
        </View>
      </View>
    );
  }

  if (size === 'compact') {
    return (
      <View accessible accessibilityLabel={`AI estimate ${value}. ${estimateCaption}`}>
        <TagShape style={styles.compact}>
          <AiFoil size="small" />
          <SWText variant="priceSmall" color={colors.kraftInk}>
            {value}
          </SWText>
        </TagShape>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`AI estimate ${value}${range ? `, range ${range}` : ''}. ${estimateCaption}`}
      style={styles.hero}
    >
      <TagShape hanging tilt={tokens.tilt.start} style={styles.heroTag}>
        {/* Slapped across the tag's far corner, the way a foil sticker goes on a label. */}
        <AiFoil size="large" shimmer style={styles.heroFoil} />
        <SWText variant="stamp" color={colors.kraftInk}>
          AI Estimate
        </SWText>
        <SWText variant="priceHero" color={colors.kraftInk}>
          {value}
        </SWText>
        {range ? (
          <SWText variant="caption" color={colors.kraftInk}>
            {range}
          </SWText>
        ) : null}
      </TagShape>
      <SWText variant="caption" tone="textMuted">
        {estimateCaption}
      </SWText>
    </View>
  );
}

/**
 * The estimate's signature where the AI's number appears without its full tag: a dot of the
 * same holographic foil, so it means the AI wherever it's seen.
 */
export function EstimateMark({ size = 8 }: { readonly size?: number }) {
  return <AiFoilDot size={size + 2} />;
}

const stylesFor = themedStyles(() => ({
  compact: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingRight: tokens.spacing[3],
    paddingVertical: tokens.spacing[1] + 2,
  },
  hero: {
    gap: tokens.spacing[3],
  },
  heroFoil: {
    position: 'absolute',
    top: -16,
    right: -18,
    transform: [{ rotate: `${tokens.tilt.end * 2}deg` }],
  },
  heroTag: {
    alignSelf: 'flex-start',
    paddingRight: tokens.spacing[6],
    paddingVertical: tokens.spacing[4],
    gap: tokens.spacing[1],
    marginTop: tokens.spacing[4],
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
}));
