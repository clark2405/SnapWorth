import { PackageSearch, Users } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
  BottomBar,
  Button,
  ChoiceChips,
  CountUp,
  EmptyState,
  Field,
  ListRow,
  NavHeader,
  Photo,
  PriceRangeBar,
  Reveal,
  Screen,
  ScreenSkeleton,
  SelectField,
  Surface,
  SWText,
  TextField,
  useToast,
  Toggle,
} from '../../components';
import { haptic, themedStyles, tokens, useThemedStyles } from '../../design';
import type { MarketArea, MarketCategory, MarketListing } from '../../ports/marketplace';
import type { ModerationStatus } from '../../types/entities';
import { useFeed } from '../feed/feed-state';
import { useScanHistory } from '../history/scan-history-state';
import { useItemDetail, type ItemDetail } from '../item/item-source';
import { formatPeso, previewConditions, type PreviewCondition } from '../preview/sample-data';
import { listingPhotoSource, useMarketplace } from './marketplace-state';

export interface ConfirmPriceViewProps {
  readonly itemId?: string;
  readonly onBack?: () => void;
  /**
   * Receives the price the seller confirmed (the AI estimate is shown for reference only), and
   * whether to also post the listing to the feed so the community can vote on that price.
   */
  readonly onPublish?: (enteredPrice: number, alsoAskFeed: boolean, listingId?: string) => void;
}

const priceInput = /^\d{1,9}(?:\.\d{1,2})?$/;

const areaCycle: readonly { readonly key: MarketArea; readonly label: string }[] = [
  { key: 'cebu-city', label: 'Cebu City, PH' },
  { key: 'mandaue', label: 'Mandaue, PH' },
  { key: 'lapu-lapu', label: 'Lapu-Lapu, PH' },
  { key: 'metro-manila', label: 'Metro Manila, PH' },
];

const categoryCycle: readonly { readonly key: MarketCategory; readonly label: string }[] = [
  { key: 'fashion', label: 'Apparel & Fashion' },
  { key: 'collectibles', label: 'Collectibles' },
  { key: 'sneakers', label: 'Sneakers' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'home', label: 'Home' },
];

function inferCategory(title: string, fallback?: MarketCategory): MarketCategory {
  if (fallback) return fallback;
  const lower = title.toLowerCase();
  if (/jordan|sneaker|shoe|dunk/.test(lower)) return 'sneakers';
  if (/walkman|keyboard|keychron|sony|audio|headphone/.test(lower)) return 'electronics';
  if (/polaroid|camera|film|vintage|card|coin/.test(lower)) return 'collectibles';
  if (/lamp|chair|vase|table/.test(lower)) return 'home';
  return 'fashion';
}

/** A positive amount with at most two decimals, or null if the text is not a valid price. */
export function parseEnteredPrice(text: string): number | null {
  const trimmed = text.replace(/,/g, '').trim();
  if (!priceInput.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

function suggestedPrice(condition: PreviewCondition, baseAmount: number): number {
  const factor = previewConditions.find((entry) => entry.key === condition)?.factor ?? 1;
  return Math.round((baseAmount * factor) / 10) * 10;
}

/** What to tell the seller: live, or not yet because moderation hasn't cleared it. */
function liveLine(status: ModerationStatus, live: string): string {
  if (status === 'approved') return live;
  if (status === 'pending') return 'Others will see it once it has been checked.';
  return 'Held for review. Only you can see it until a moderator has looked.';
}

/**
 * Setting the asking price: for a saved scan about to be listed, or one of the seller's own
 * listings being edited. An item that isn't either (a stale link) says so; nothing is prefilled
 * from a sample.
 */
export function ConfirmPriceView(props: ConfirmPriceViewProps) {
  const { itemId, onBack } = props;
  const { myListings } = useMarketplace();
  const lookup = useItemDetail(itemId);

  const existingListing = itemId
    ? myListings.find(
        (entry) =>
          entry.id === itemId ||
          entry.slug === itemId ||
          entry.rowId === itemId ||
          (entry.scanId !== null && entry.scanId === itemId),
      )
    : undefined;
  const foundItem = lookup.status === 'found' ? lookup.item : undefined;

  if (existingListing || foundItem) {
    return <ConfirmPrice {...props} existingListing={existingListing} foundItem={foundItem} />;
  }
  if (lookup.status === 'loading') return <ScreenSkeleton kind="page" />;
  return (
    <Screen ambient="market" header={<NavHeader title="List for sale" onBack={onBack} banded />}>
      <EmptyState
        icon={PackageSearch}
        title="Nothing to list here"
        body="This item isn’t one of your saved snaps. Open it from History to list it."
        actionLabel="Go back"
        onAction={onBack}
      />
    </Screen>
  );
}

function ConfirmPrice({
  itemId,
  existingListing,
  foundItem,
  onBack,
  onPublish,
}: ConfirmPriceViewProps & {
  readonly existingListing?: MarketListing;
  readonly foundItem?: ItemDetail;
}) {
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const { publishListing, updateListing } = useMarketplace();
  const { publishPost } = useFeed();
  const { scans, reload: reloadScans } = useScanHistory();

  const savedScan = itemId ? scans.find((entry) => entry.id === itemId) : undefined;

  const title = existingListing?.title ?? foundItem?.title ?? '';
  const subtitle = foundItem?.explanation ?? '';
  // The AI's range for this item, from the listing's scan or the saved scan: none when it has none.
  const valuation =
    existingListing &&
    existingListing.estimatePhp !== null &&
    existingListing.estimateLowPhp !== null &&
    existingListing.estimateHighPhp !== null
      ? {
          estimate: existingListing.estimatePhp,
          low: existingListing.estimateLowPhp,
          high: existingListing.estimateHighPhp,
        }
      : foundItem
        ? { estimate: foundItem.estimate, low: foundItem.low, high: foundItem.high }
        : null;
  const baseValuation = valuation?.estimate ?? null;
  const photoSource = existingListing
    ? listingPhotoSource(existingListing)
    : (foundItem?.photos[0]?.source ?? null);
  const photoLabel = existingListing?.photoLabel ?? foundItem?.photos[0]?.label ?? title;

  const [alsoAskFeed, setAlsoAskFeed] = useState(false);
  const [condition, setCondition] = useState<PreviewCondition>(
    existingListing?.condition ?? 'good',
  );
  const [area, setArea] = useState<MarketArea>(existingListing?.area ?? 'cebu-city');
  const [category, setCategory] = useState<MarketCategory>(() =>
    inferCategory(title, existingListing?.category),
  );
  const [description, setDescription] = useState(
    existingListing?.description ?? foundItem?.explanation ?? '',
  );
  // Starts with the live suggestion so the seller always sees a number, and once they type
  // their own it stops following the condition.
  const [priceText, setPriceText] = useState(() =>
    existingListing
      ? String(existingListing.askingPrice)
      : baseValuation === null
        ? ''
        : String(suggestedPrice('good', baseValuation)),
  );
  const [edited, setEdited] = useState(Boolean(existingListing));
  const [publishing, setPublishing] = useState(false);

  const enteredPrice = parseEnteredPrice(priceText);
  const suggestion = baseValuation === null ? null : suggestedPrice(condition, baseValuation);
  const hint = previewConditions.find((entry) => entry.key === condition)?.hint ?? '';
  const areaLabel = areaCycle.find((entry) => entry.key === area)?.label ?? '';
  const categoryLabel = categoryCycle.find((entry) => entry.key === category)?.label ?? '';

  const handleCondition = (key: PreviewCondition) => {
    setCondition(key);
    if (!edited && baseValuation !== null) setPriceText(String(suggestedPrice(key, baseValuation)));
  };

  const cycleArea = () => {
    const idx = areaCycle.findIndex((entry) => entry.key === area);
    const next = areaCycle[(idx + 1) % areaCycle.length];
    if (next) setArea(next.key);
  };

  const cycleCategory = () => {
    const idx = categoryCycle.findIndex((entry) => entry.key === category);
    const next = categoryCycle[(idx + 1) % categoryCycle.length];
    if (next) setCategory(next.key);
  };

  const handlePublish = async () => {
    if (enteredPrice === null || publishing) return;
    setPublishing(true);

    if (existingListing && existingListing.mine) {
      const updated = await updateListing(existingListing.id, {
        title,
        askingPrice: enteredPrice,
        condition,
        category,
        area,
        description,
      });
      setPublishing(false);
      if (!updated.ok) {
        toast.show({
          title: 'Couldn’t update listing',
          body: 'Please check your connection and try again.',
          tone: 'error',
        });
        return;
      }
      toast.show({
        title: 'Listing updated',
        body: liveLine(updated.value.moderationStatus, `Live at ${formatPeso(enteredPrice)}.`),
        celebrate: updated.value.moderationStatus === 'approved',
      });
      onPublish?.(enteredPrice, alsoAskFeed, updated.value.id);
      return;
    }

    const published = await publishListing({
      scanId: savedScan?.id ?? null,
      title,
      askingPrice: enteredPrice,
      photoUrl: savedScan ? (savedScan.photoUrl ?? savedScan.photoUri) : null,
      photoPath: savedScan?.photoPath ?? null,
      category,
      condition,
      area,
      description:
        description.trim().length > 0
          ? description.trim()
          : `${title} in ${condition.replace('_', ' ')} condition.`,
      // Only the on-device repository records these; Supabase copies them from the scan.
      estimatePhp: valuation?.estimate ?? null,
      estimateLowPhp: valuation?.low ?? null,
      estimateHighPhp: valuation?.high ?? null,
    });
    setPublishing(false);

    if (!published.ok) {
      toast.show({
        title: 'Couldn’t publish listing',
        body:
          published.error.kind === 'rate_limited'
            ? 'You are listing items too quickly. Try again in a while.'
            : 'Please check your connection and try again.',
        tone: 'error',
      });
      return;
    }

    if (savedScan) {
      void reloadScans();
    }

    if (alsoAskFeed) {
      await publishPost({
        title,
        body: `I'm asking ${formatPeso(enteredPrice)} for this ${title.toLowerCase()}. Fair price?`,
        estimate: baseValuation,
        category,
        scanId: savedScan?.id ?? null,
        listingId: published.value.rowId ?? published.value.id,
        listingAskingPrice: enteredPrice,
        photoPath: savedScan?.photoPath ?? null,
        photoUrl: savedScan ? (savedScan.photoUrl ?? savedScan.photoUri) : null,
      });
    }

    toast.show({
      title:
        published.value.moderationStatus === 'approved' ? 'Listing published' : 'Listing saved',
      body: liveLine(
        published.value.moderationStatus,
        alsoAskFeed
          ? `Live at ${formatPeso(enteredPrice)}, and on the feed for a price check.`
          : `Live at ${formatPeso(enteredPrice)}.`,
      ),
      celebrate: published.value.moderationStatus === 'approved',
    });
    onPublish?.(enteredPrice, alsoAskFeed, published.value.id);
  };

  return (
    <Screen
      ambient="market"
      header={<NavHeader title="List for sale" onBack={onBack} banded />}
      footer={
        <BottomBar>
          <Button
            label="Publish listing"
            disabled={enteredPrice === null}
            loading={publishing}
            onPress={() => void handlePublish()}
          />
          {enteredPrice === null ? (
            <SWText
              variant="caption"
              tone="textMuted"
              align="center"
              accessibilityLiveRegion="polite"
            >
              Enter your asking price to publish.
            </SWText>
          ) : null}
        </BottomBar>
      }
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.item}>
        <Photo
          source={photoSource}
          label={photoLabel}
          radius={tokens.radius.medium}
          style={styles.thumb}
        />
        <View style={styles.itemText}>
          <SWText variant="headingSmall">{title}</SWText>
          <SWText variant="bodyCompact" tone="textMuted" numberOfLines={2}>
            {subtitle}
          </SWText>
        </View>
      </Reveal>

      <Reveal index={1} style={styles.conditionSection}>
        <SWText variant="overline" tone="textMuted">
          Condition
        </SWText>
        <ChoiceChips options={previewConditions} value={condition} onChange={handleCondition} />
        {suggestion === null ? null : (
          <View style={styles.suggestion}>
            <SWText variant="overline" tone="textMuted">
              Suggested price
            </SWText>
            <CountUp value={suggestion} format={formatPeso} variant="priceLarge" />
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
        )}
      </Reveal>

      {valuation ? (
        <Reveal index={2} style={styles.range}>
          <PriceRangeBar
            low={valuation.low}
            high={valuation.high}
            estimate={valuation.estimate}
            confidence={foundItem?.confidence}
            asking={enteredPrice ?? suggestion ?? undefined}
            format={formatPeso}
          />
        </Reveal>
      ) : null}

      <Reveal index={3} style={styles.fields}>
        <Field label="Your asking price">
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
        <Field label="About this item (optional)">
          <TextField
            value={description}
            onChangeText={setDescription}
            placeholder="Condition, size, or what’s included"
            maxLength={1000}
            accessibilityLabel="About this item"
          />
        </Field>
        <Field label="Location (optional)">
          <SelectField value={areaLabel} onPress={cycleArea} accessibilityLabel="Location" />
        </Field>
        <Field label="Category (optional)">
          <SelectField
            value={categoryLabel}
            onPress={cycleCategory}
            accessibilityLabel="Category"
          />
        </Field>
      </Reveal>

      <Reveal index={4}>
        <Surface>
          <ListRow
            label="Also ask the feed"
            detail="Let the community vote on your price"
            icon={Users}
            trailing={
              <Toggle
                value={alsoAskFeed}
                onValueChange={(value) => {
                  setAlsoAskFeed(value);
                  haptic('select');
                }}
                accessibilityLabel="Also post to the feed for a price check"
              />
            }
          />
        </Surface>
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
}));
