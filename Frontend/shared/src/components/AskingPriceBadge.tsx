import { StyleSheet, View } from 'react-native';

import { tokens } from '../design';
import { SWText } from './SWText';

export interface AskingPriceBadgeProps {
  /** The formatted price the seller typed. Never an AI estimate. */
  readonly value: string;
  readonly size?: 'large' | 'compact';
}

/** The seller's own price: a settled, solid treatment with no estimate language. */
export function AskingPriceBadge({ value, size = 'large' }: AskingPriceBadgeProps) {
  return (
    <View accessible accessibilityLabel={`Asking price ${value}`} style={styles.asking}>
      <SWText variant="overline" tone="textMuted">
        Asking Price
      </SWText>
      <SWText variant={size === 'large' ? 'priceLarge' : 'priceMedium'}>{value}</SWText>
    </View>
  );
}

const styles = StyleSheet.create({
  asking: {
    gap: tokens.spacing[1],
  },
});
