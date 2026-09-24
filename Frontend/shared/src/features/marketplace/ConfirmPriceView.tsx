import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  BottomBar,
  Button,
  EstimateBadge,
  Field,
  NavHeader,
  Photo,
  Reveal,
  Screen,
  SelectField,
  SWText,
  TextField,
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
      header={<NavHeader title="Set your price" onBack={onBack} />}
      footer={
        <BottomBar style={styles.footer}>
          <Button
            label="Publish listing"
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
              ? 'Enter your asking price to publish.'
              : `Your listing will go live at ${formatPeso(enteredPrice)}.`}
          </SWText>
        </BottomBar>
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

      <Reveal index={1} style={styles.reference}>
        <SWText variant="overline" tone="textMuted">
          For reference
        </SWText>
        <EstimateBadge value={formatPeso(item.estimate)} />
      </Reveal>

      <Reveal index={2} style={styles.fields}>
        <Field
          label="Your asking price"
          helper="You set this. The estimate above is never copied into it."
        >
          <TextField
            size="large"
            prefix="₱"
            value={priceText}
            onChangeText={setPriceText}
            placeholder="Enter price"
            keyboardType="decimal-pad"
            inputMode="decimal"
            accessibilityLabel="Your asking price in pesos"
          />
        </Field>
        <Field label="Location (optional)">
          <SelectField value={item.location} accessibilityLabel="Location" />
        </Field>
        <Field label="Category (optional)">
          <SelectField value={item.category} accessibilityLabel="Category" />
        </Field>
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
    width: tokens.layout.thumbnail,
    height: tokens.layout.thumbnail,
  },
  itemText: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  reference: {
    gap: tokens.spacing[2],
  },
  fields: {
    gap: tokens.spacing[5],
  },
  footer: {
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
});
