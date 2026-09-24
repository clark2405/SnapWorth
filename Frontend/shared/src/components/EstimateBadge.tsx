import { StyleSheet, View } from 'react-native';

import { tokens } from '../design';
import { SWText } from './SWText';

export const estimateCaption = 'Estimate only — not a listing price.';

export interface EstimateBadgeProps {
  /** The formatted AI estimate, e.g. "₱2,450". */
  readonly value: string;
  /** `hero` is reserved for the item screen; everywhere else uses `compact`. */
  readonly size?: 'hero' | 'compact';
}

/**
 * The AI estimate. Always labelled, always dashed, always captioned: the label and caption are
 * not props, so no screen can show the number without them.
 */
export function EstimateBadge({ value, size = 'compact' }: EstimateBadgeProps) {
  const hero = size === 'hero';

  return (
    <View
      accessible
      accessibilityLabel={`AI estimate ${value}. ${estimateCaption}`}
      style={[styles.estimate, hero ? styles.estimateHero : styles.estimateCompact]}
    >
      <SWText variant="overline" tone="accent">
        AI Estimate
      </SWText>
      <SWText variant={hero ? 'priceHero' : 'priceMedium'}>{value}</SWText>
      <SWText variant="caption" tone="textSecondary">
        {estimateCaption}
      </SWText>
    </View>
  );
}

const styles = StyleSheet.create({
  estimate: {
    alignSelf: 'stretch',
    backgroundColor: tokens.color.dark.estimateSurface,
    borderColor: tokens.color.dark.estimateBorder,
    borderWidth: tokens.border.hairline,
    borderStyle: tokens.border.provisionalStyle,
    borderRadius: tokens.radius.medium,
  },
  estimateHero: {
    padding: tokens.spacing[5],
    gap: tokens.spacing[2],
  },
  estimateCompact: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    gap: tokens.spacing[1],
  },
});
