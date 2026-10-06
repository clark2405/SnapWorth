import { ChevronDown, MapPin, Wallet, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  Button,
  ChoiceChips,
  PressableScale,
  SegmentedControl,
  Sheet,
  SWText,
  TextField,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewListingPlaces,
  previewMarketAreas,
  previewPriceBrackets,
  type PreviewListing,
} from '../preview/sample-data';

/** What a buyer has narrowed the market to. `null` bounds mean "no limit". */
export interface MarketFilters {
  readonly category: string;
  readonly minPrice: number | null;
  readonly maxPrice: number | null;
  /** An area key from the area list, `near-me`, or `anywhere`. */
  readonly area: string;
  /** Only used with `near-me`. */
  readonly radiusKm: RadiusKey;
}

export type RadiusKey = '5' | '10' | '25';

export const defaultMarketFilters: MarketFilters = {
  category: 'all',
  minPrice: null,
  maxPrice: null,
  area: 'anywhere',
  radiusKm: '10',
};

const radiusOptions: readonly { readonly key: RadiusKey; readonly label: string }[] = [
  { key: '5', label: '5 km' },
  { key: '10', label: '10 km' },
  { key: '25', label: '25 km' },
];

/**
 * Preview-only matching against the sample listings. The real query belongs to the listing
 * service; this keeps the screen honest about what each filter would show.
 */
export function matchesPriceAndPlace(
  listing: PreviewListing,
  filters: Pick<MarketFilters, 'minPrice' | 'maxPrice' | 'area' | 'radiusKm'>,
): boolean {
  if (filters.minPrice !== null && listing.askingPrice < filters.minPrice) return false;
  if (filters.maxPrice !== null && listing.askingPrice > filters.maxPrice) return false;
  const place = previewListingPlaces[listing.id];
  if (filters.area === 'anywhere' || !place) return true;
  if (filters.area === 'near-me') return place.distanceKm <= Number(filters.radiusKm);
  return place.area === filters.area;
}

export function priceLabel(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min === null) return `Under ${formatPeso(max ?? 0)}`;
  if (max === null) return `${formatPeso(min)}+`;
  return `${formatPeso(min)}–${formatPeso(max)}`;
}

export function areaLabel(area: string, radiusKm: RadiusKey): string | null {
  if (area === 'anywhere') return null;
  if (area === 'near-me') return `Within ${radiusKm} km`;
  return previewMarketAreas.find((entry) => entry.key === area)?.label ?? null;
}

/**
 * A dropdown-style pill under the category chips. Empty, it names the filter; set, it turns
 * ink and shows the value with a clear button.
 */
export function FilterPill({
  icon: Icon,
  placeholder,
  value,
  onOpen,
  onClear,
}: {
  readonly icon: LucideIcon;
  readonly placeholder: string;
  readonly value: string | null;
  readonly onOpen: () => void;
  readonly onClear: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const active = value !== null;
  const ink = active ? colors.onInverse : colors.textPrimary;

  return (
    <Animated.View layout={LinearTransition.springify().damping(20)} style={styles.pillSlot}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={
          active ? `${placeholder}: ${value}. Change` : `Filter by ${placeholder}`
        }
        haptic="select"
        onPress={onOpen}
        style={[styles.pill, active ? styles.pillActive : null]}
      >
        <Icon size={15} strokeWidth={2} color={ink} />
        <SWText variant="labelSmall" tone={active ? 'onInverse' : 'textPrimary'} numberOfLines={1}>
          {value ?? placeholder}
        </SWText>
        {active ? null : <ChevronDown size={15} strokeWidth={2} color={ink} />}
      </PressableScale>
      {active ? (
        <Animated.View
          entering={FadeIn.duration(tokens.motion.duration.fast)}
          exiting={FadeOut}
          style={styles.clearSlot}
        >
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Clear ${placeholder} filter`}
            haptic="select"
            hitSlop={tokens.spacing[2]}
            onPress={onClear}
            style={styles.clear}
          >
            <X size={14} strokeWidth={2.2} color={colors.onInverse} />
          </PressableScale>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function parseAmount(text: string): number | null {
  const value = Number(text.replace(/[,\s]/g, ''));
  return text.trim() === '' || !Number.isFinite(value) || value < 0 ? null : Math.round(value);
}

/** Minimum and maximum asking price, with quick brackets and a live count of matches. */
export function PriceFilterSheet({
  visible,
  filters,
  countFor,
  onClose,
  onApply,
}: {
  readonly visible: boolean;
  readonly filters: MarketFilters;
  readonly countFor: (min: number | null, max: number | null) => number;
  readonly onClose: () => void;
  readonly onApply: (min: number | null, max: number | null) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');

  useEffect(() => {
    if (!visible) return;
    setMinText(filters.minPrice === null ? '' : String(filters.minPrice));
    setMaxText(filters.maxPrice === null ? '' : String(filters.maxPrice));
  }, [filters.maxPrice, filters.minPrice, visible]);

  const min = parseAmount(minText);
  const max = parseAmount(maxText);
  const inverted = min !== null && max !== null && min > max;
  const bracket =
    previewPriceBrackets.find((entry) => entry.min === min && entry.max === max)?.key ?? null;
  const count = countFor(min, max);

  return (
    <Sheet visible={visible} onClose={onClose} title="Price range">
      <ChoiceChips
        options={previewPriceBrackets}
        value={bracket}
        onChange={(key) => {
          const picked = previewPriceBrackets.find((entry) => entry.key === key);
          setMinText(picked?.min === null || !picked ? '' : String(picked.min));
          setMaxText(picked?.max === null || !picked ? '' : String(picked.max));
        }}
      />
      <View style={styles.rangeRow}>
        <View style={styles.rangeField}>
          <TextField
            prefix="₱"
            value={minText}
            onChangeText={setMinText}
            placeholder="Min"
            keyboardType="number-pad"
            inputMode="numeric"
            accessibilityLabel="Minimum price in pesos"
          />
        </View>
        <View style={styles.rangeDash} />
        <View style={styles.rangeField}>
          <TextField
            prefix="₱"
            value={maxText}
            onChangeText={setMaxText}
            placeholder="Max"
            keyboardType="number-pad"
            inputMode="numeric"
            accessibilityLabel="Maximum price in pesos"
          />
        </View>
      </View>
      {inverted ? (
        <SWText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          The minimum is above the maximum.
        </SWText>
      ) : null}
      <SheetActions
        count={count}
        disabled={inverted}
        onClear={() => {
          setMinText('');
          setMaxText('');
        }}
        onApply={() => onApply(min, max)}
      />
    </Sheet>
  );
}

/** A named area, or anything within a distance of the buyer. */
export function LocationFilterSheet({
  visible,
  filters,
  countFor,
  onClose,
  onApply,
}: {
  readonly visible: boolean;
  readonly filters: MarketFilters;
  readonly countFor: (area: string, radiusKm: RadiusKey) => number;
  readonly onClose: () => void;
  readonly onApply: (area: string, radiusKm: RadiusKey) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [area, setArea] = useState(filters.area);
  const [radius, setRadius] = useState<RadiusKey>(filters.radiusKm);

  useEffect(() => {
    if (!visible) return;
    setArea(filters.area);
    setRadius(filters.radiusKm);
  }, [filters.area, filters.radiusKm, visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Location">
      <ChoiceChips options={previewMarketAreas} value={area} onChange={setArea} />
      {area === 'near-me' ? (
        <Animated.View
          entering={FadeIn.duration(tokens.motion.duration.base)}
          exiting={FadeOut.duration(tokens.motion.duration.fast)}
          style={styles.radius}
        >
          <SWText variant="overline" tone="textMuted">
            Distance
          </SWText>
          <SegmentedControl options={radiusOptions} value={radius} onChange={setRadius} />
        </Animated.View>
      ) : null}
      <SheetActions
        count={countFor(area, radius)}
        onClear={() => setArea('anywhere')}
        onApply={() => onApply(area, radius)}
      />
    </Sheet>
  );
}

function SheetActions({
  count,
  disabled = false,
  onClear,
  onApply,
}: {
  readonly count: number;
  readonly disabled?: boolean;
  readonly onClear: () => void;
  readonly onApply: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.actions}>
      <Button label="Clear" variant="tertiary" onPress={onClear} />
      <Button
        label={count === 1 ? 'Show 1 item' : `Show ${count} items`}
        disabled={disabled}
        onPress={onApply}
        containerStyle={styles.apply}
      />
    </View>
  );
}

export const filterIcons = { price: Wallet, location: MapPin } as const;

const stylesFor = themedStyles((colors) => ({
  pillSlot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    minHeight: 36,
    paddingHorizontal: tokens.spacing[3],
    borderRadius: tokens.radius.full,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  // Set filters close up against their clear button, so the pair reads as one control.
  pillActive: {
    paddingRight: tokens.spacing[8],
    borderColor: colors.inverse,
    backgroundColor: colors.inverse,
  },
  clearSlot: {
    position: 'absolute',
    right: tokens.spacing[2],
    top: (36 - 22) / 2,
  },
  clear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  rangeField: {
    flex: 1,
  },
  rangeDash: {
    width: tokens.spacing[3],
    height: tokens.border.focus,
    borderRadius: 1,
    backgroundColor: colors.borderStrong,
  },
  radius: {
    gap: tokens.spacing[2],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    marginTop: tokens.spacing[2],
  },
  apply: {
    flex: 1,
  },
}));
