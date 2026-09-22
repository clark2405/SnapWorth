import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  GlassCard,
  GlassField,
  GlassInput,
  GlassSelect,
  GlowButton,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  SWText,
} from '../../components';
import { tokens } from '../../design';
import { formatPeso, previewItem } from '../preview/sample-data';

export interface ConfirmPriceViewProps {
  readonly itemId?: string;
  readonly onBack?: () => void;
  /** Receives the price the seller typed. The AI estimate is shown for reference only. */
  readonly onPublish?: (enteredPrice: number) => void;
}

const priceInput = /^\d{1,9}(?:\.\d{1,2})?$/;

/** A positive amount with at most two decimals, or null if the text is not a valid price. */
export function parseEnteredPrice(text: string): number | null {
  const trimmed = text.replace(/,/g, '').trim();
  if (!priceInput.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

export function ConfirmPriceView({ onBack, onPublish }: ConfirmPriceViewProps) {
  const item = previewItem;
  // Starts empty on purpose: the seller must type their own price (SRS 3.1.5).
  const [priceText, setPriceText] = useState('');
  const enteredPrice = parseEnteredPrice(priceText);

  return (
    <Screen
      header={<NavHeader title="Confirm Pricing" onBack={onBack} />}
      footer={
        <View style={styles.footer}>
          <GlowButton
            label="Publish Listing"
            disabled={enteredPrice === null}
            onPress={() => {
              if (enteredPrice !== null) onPublish?.(enteredPrice);
            }}
          />
          <SWText
            variant="caption"
            tone="textMuted"
            align="center"
            accessibilityLiveRegion="polite"
          >
            {enteredPrice === null
              ? 'Please input a valid price above to list your item.'
              : `Your listing will go live at ${formatPeso(enteredPrice)}.`}
          </SWText>
        </View>
      }
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.item}>
        <Photo
          source={item.photo}
          label={item.photoLabel}
          radius={tokens.radius.medium}
          style={styles.thumb}
        />
        <View style={styles.itemText}>
          <SWText variant="headingSmall">{item.title}</SWText>
          <SWText variant="bodyCompact" tone="textMuted">
            {item.subtitle}
          </SWText>
        </View>
      </Reveal>

      <Reveal index={1}>
        <GlassCard tone="mint" padding={tokens.spacing[4]} contentStyle={styles.estimate}>
          <View>
            <SWText variant="overline" tone="accent">
              AI Estimate
            </SWText>
            <SWText variant="caption" tone="textMuted">
              Recommended reference range
            </SWText>
          </View>
          <SWText
            variant="priceMedium"
            tone="accent"
            accessibilityLabel={`AI estimate for reference, ${formatPeso(item.estimate)}`}
          >
            {formatPeso(item.estimate)}
          </SWText>
        </GlassCard>
      </Reveal>

      <Reveal index={2} style={styles.fields}>
        <GlassField
          label="Your Asking Price"
          helper="A fair price ensures faster marketplace sales."
        >
          <GlassInput
            size="large"
            prefix="₱"
            value={priceText}
            onChangeText={setPriceText}
            placeholder="Enter price"
            keyboardType="decimal-pad"
            inputMode="decimal"
            accessibilityLabel="Your asking price in pesos"
          />
        </GlassField>
        <GlassField label="Location (Optional)">
          <GlassSelect value={item.location} accessibilityLabel="Location" />
        </GlassField>
        <GlassField label="Category (Optional)">
          <GlassSelect value={item.category} accessibilityLabel="Category" />
        </GlassField>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[5],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[4],
  },
  thumb: {
    width: 80,
    height: 80,
  },
  itemText: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fields: {
    gap: tokens.spacing[5],
  },
  footer: {
    paddingHorizontal: tokens.spacing[6],
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[5],
    gap: tokens.spacing[4],
  },
});
