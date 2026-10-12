import { View } from 'react-native';

import { themedStyles, tokens, useThemedStyles } from '../design';
import { SWText } from './SWText';

export interface AskingPriceBadgeProps {
  /** The formatted price the seller typed. Never an AI estimate. */
  readonly value: string;
  readonly size?: 'large' | 'compact';
}

/** The seller's price: monochrome and plain, so it never borrows the estimate's authority. */
export function AskingPriceBadge({ value, size = 'large' }: AskingPriceBadgeProps) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View accessible accessibilityLabel={`Asking price ${value}`} style={styles.asking}>
      <SWText variant="overline" tone="textMuted">
        Asking
      </SWText>
      <SWText variant={size === 'large' ? 'priceLarge' : 'priceMedium'}>{value}</SWText>
    </View>
  );
}

const stylesFor = themedStyles(() => ({
  asking: {
    gap: tokens.spacing['0.5'],
  },
}));
