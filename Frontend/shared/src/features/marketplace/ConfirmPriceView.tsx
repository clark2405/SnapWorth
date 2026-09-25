import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
  BottomBar,
  Button,
  ChoiceChips,
  CountUp,
  Field,
  NavHeader,
  Photo,
  PriceRangeBar,
  Reveal,
  Screen,
  SelectField,
  SWText,
  TextField,
  useToast,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewConditions,
  previewItem,
  previewValuation,
  type PreviewCondition,
} from '../preview/sample-data';

export interface ConfirmPriceViewProps {
  readonly itemId?: string;
  readonly onBack?: () => void;
  /** Receives the price the seller confirmed. The AI estimate is shown for reference only. */
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

function suggestedPrice(condition: PreviewCondition): number {
  const factor = previewConditions.find((entry) => entry.key === condition)?.factor ?? 1;
  return Math.round((previewItem.estimate * factor) / 10) * 10;
}

export function ConfirmPriceView({ onBack, onPublish }: ConfirmPriceViewProps) {
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const item = previewItem;
  const [condition, setCondition] = useState<PreviewCondition>('good');
  // Prefilled with the live suggestion so the seller always sees a number, but once they type
  // their own it stops following the condition — the price they publish is always theirs, seen
  // and editable, never silently swapped in behind the scenes.
  const [priceText, setPriceText] = useState(() => String(suggestedPrice('good')));
  const [edited, setEdited] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const enteredPrice = parseEnteredPrice(priceText);
  const suggestion = suggestedPrice(condition);
  const hint = previewConditions.find((entry) => entry.key === condition)?.hint ?? '';

  const handleCondition = (key: PreviewCondition) => {
    setCondition(key);
    if (!edited) setPriceText(String(suggestedPrice(key)));
  };

  const handlePublish = () => {
    if (enteredPrice === null) return;
    setPublishing(true);
    setTimeout(() => {
      setPublishing(false);
      toast.show({ title: 'Listing published', body: `Live at ${formatPeso(enteredPrice)}.` });
      onPublish?.(enteredPrice);
    }, 700);
  };

  return (
    <Screen
      header={<NavHeader title="List for sale" onBack={onBack} banded />}
      footer={
        <BottomBar style={styles.footer}>
          <Button
            label="Publish listing"
            disabled={enteredPrice === null}
            loading={publishing}
            onPress={handlePublish}
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

      <Reveal index={1} style={styles.conditionSection}>
        <SWText variant="overline" tone="textMuted">
          Condition
        </SWText>
        <ChoiceChips options={previewConditions} value={condition} onChange={handleCondition} />
        <View style={styles.suggestion}>
          <SWText variant="overline" tone="accent">
            Suggested price
          </SWText>
          <CountUp value={suggestion} format={formatPeso} variant="priceLarge" tone="accent" />
          <Animated.View
            key={condition}
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
          >
            <SWText variant="caption" tone="textMuted">
              {hint}
            </SWText>
          </Animated.View>
        </View>
      </Reveal>

      <Reveal index={2} style={styles.range}>
        <PriceRangeBar
          low={previewValuation.low}
          high={previewValuation.high}
          estimate={item.estimate}
          confidence={previewValuation.confidence}
          asking={enteredPrice ?? suggestion}
          format={formatPeso}
        />
      </Reveal>

      <Reveal index={3} style={styles.fields}>
        <Field
          label="Your asking price"
          helper="This is yours to set. Edit it, or publish the suggestion above."
        >
          <TextField
            size="large"
            prefix="₱"
            value={priceText}
            onChangeText={(text) => {
              setEdited(true);
              setPriceText(text);
            }}
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

const stylesFor = themedStyles(() => ({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[6],
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
  conditionSection: {
    gap: tokens.spacing[3],
  },
  suggestion: {
    gap: tokens.spacing[1],
    marginTop: tokens.spacing[2],
  },
  range: {
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
}));
