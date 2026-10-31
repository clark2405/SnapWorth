import { BadgePercent, LayoutGrid, PackageSearch } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  paperIn,
  paperLayout,
  paperOut,
  AskingPriceBadge,
  Button,
  ChoiceChips,
  EmptyState,
  EstimateBadge,
  LargeTitle,
  Photo,
  Reveal,
  Screen,
  Sign,
  SnapIcon,
  Sticker,
  SWText,
  useGridColumns,
  ZoomLink,
} from '../../components';
import { held, themedStyles, tokens, useThemedStyles, useWideLayout } from '../../design';
import {
  formatPeso,
  previewListings,
  previewMarketAreas,
  previewMarketCategories,
  previewPriceBrackets,
  type PreviewListing,
} from '../preview/sample-data';
import { HanapEntry } from '../hanap/HanapEntry';
import { ProfileButton } from '../profile/ProfileButton';
import { Tip } from '../tips';
import { FilterMenu } from './FilterMenu';
import { ListingCard } from './ListingCard';
import {
  areaLabel,
  defaultMarketFilters,
  filterIcons,
  LocationFilterSheet,
  matchesPriceAndPlace,
  PriceFilterSheet,
  priceLabel,
  type MarketFilters,
} from './MarketFilters';

export interface MarketplaceViewProps {
  readonly onOpenListing?: (listingId: string) => void;
  readonly onSell?: () => void;
  /** Every change to category, price range or location, for the listing query to follow. */
  readonly onFiltersChange?: (filters: MarketFilters) => void;
  readonly onOpenProfile?: () => void;
  /** Opens Hanap, where buyers post what they're looking for. */
  readonly onOpenHanap?: () => void;
}

// Preview-only: listings don't carry a category field yet, so map them locally against
// `previewMarketCategories` until that field exists on the real listing.
const categoryByListing: Readonly<Record<string, string>> = {
  'polaroid-sun-600': 'collectibles',
  'air-jordan-1-bred': 'sneakers',
  'retro-walkman': 'electronics',
  'keychron-keyboard': 'electronics',
  'nike-teal-windbreaker': 'fashion',
  'colour-block-windbreaker': 'fashion',
  'black-puffer-jacket': 'fashion',
  'polaroid-film-bundle': 'collectibles',
};

/** A rough read on whether a listing sits under its likely fair value, from its community verdict. */
function impliedEstimate(listing: PreviewListing): number {
  const factor = listing.verdict === 'too_low' ? 1.18 : listing.verdict === 'too_high' ? 0.82 : 1;
  return Math.round((listing.askingPrice * factor) / 10) * 10;
}

export function MarketplaceView({
  onOpenListing,
  onSell,
  onFiltersChange,
  onOpenProfile,
  onOpenHanap,
}: MarketplaceViewProps) {
  const styles = useThemedStyles(stylesFor);
  const [filters, setFilters] = useState<MarketFilters>(defaultMarketFilters);
  const [openSheet, setOpenSheet] = useState<'price' | 'location' | null>(null);
  const ios = Platform.OS === 'ios';

  const update = (change: Partial<MarketFilters>) => {
    const next = { ...filters, ...change };
    setFilters(next);
    onFiltersChange?.(next);
  };

  const matching = (candidate: MarketFilters) =>
    previewListings.filter(
      (listing) =>
        (candidate.category === 'all' || categoryByListing[listing.id] === candidate.category) &&
        matchesPriceAndPlace(listing, candidate),
    );

  const filtered = matching(filters);
  // Two listings a row on a phone; on a wide window as many as fit, up to four.
  const wide = useWideLayout();
  const grid = useGridColumns(filtered.length, {
    minWidth: listingMinWidth,
    maxColumns: 4,
    gap: tokens.spacing[4],
  });
  const narrowed =
    filters.minPrice !== null || filters.maxPrice !== null || filters.area !== 'anywhere';

  // Steals sit above the grid only while browsing everything; once narrowed, the grid is the answer.
  const underEstimate = narrowed
    ? []
    : previewListings.filter((listing) => listing.verdict === 'too_low').slice(0, 2);

  return (
    <Screen
      clearTabBar
      place="market"
      ambient="market"
      onRefresh={() => new Promise<void>((resolve) => setTimeout(resolve, 900))}
    >
      <LargeTitle
        brand
        title="Market"
        trailing={
          <View style={styles.actions}>
            {/* On iOS, Snap rides above the tab bar; shells without it pass onSell. */}
            {onSell ? (
              <Button
                label="Sell"
                size="small"
                variant="secondary"
                icon={SnapIcon}
                onPress={onSell}
              />
            ) : null}
            <ProfileButton onPress={onOpenProfile} />
          </View>
        }
      />

      <Tip id="save" style={styles.tip} />

      <Reveal index={0} style={styles.filters}>
        {/* iOS shows every filter as one of its own menus, Category too; elsewhere the
            categories are chips and price and place open sheets. */}
        {ios ? null : (
          <ChoiceChips
            options={previewMarketCategories}
            value={filters.category}
            scroll
            onChange={(key) => update({ category: key })}
          />
        )}
        <View style={styles.pills}>
          {ios ? (
            <FilterMenu
              icon={LayoutGrid}
              systemImage="square.grid.2x2"
              placeholder="Category"
              value={
                filters.category === 'all'
                  ? null
                  : (previewMarketCategories.find((entry) => entry.key === filters.category)
                      ?.label ?? null)
              }
              choices={previewMarketCategories}
              chosenKey={filters.category}
              onChoose={(key) => update({ category: key })}
              onOpenSheet={() => undefined}
              onClear={() => update({ category: 'all' })}
            />
          ) : null}
          <FilterMenu
            icon={filterIcons.price}
            systemImage="creditcard"
            placeholder="Price"
            value={priceLabel(filters.minPrice, filters.maxPrice)}
            choices={priceChoices}
            chosenKey={
              filters.minPrice === null && filters.maxPrice === null
                ? 'any'
                : (previewPriceBrackets.find(
                    (entry) => entry.min === filters.minPrice && entry.max === filters.maxPrice,
                  )?.key ?? null)
            }
            onChoose={(key) => {
              const bracket = previewPriceBrackets.find((entry) => entry.key === key);
              update({ minPrice: bracket?.min ?? null, maxPrice: bracket?.max ?? null });
            }}
            more={{
              label: 'Custom range…',
              systemImage: 'slider.horizontal.3',
              onOpen: () => setOpenSheet('price'),
            }}
            onOpenSheet={() => setOpenSheet('price')}
            onClear={() => update({ minPrice: null, maxPrice: null })}
          />
          <FilterMenu
            icon={filterIcons.location}
            systemImage="mappin.and.ellipse"
            placeholder="Location"
            value={areaLabel(filters.area, filters.radiusKm)}
            choices={areaChoices}
            chosenKey={filters.area === 'near-me' ? null : filters.area}
            onChoose={(key) => update({ area: key })}
            more={{
              label: 'Near me…',
              systemImage: 'location',
              onOpen: () => setOpenSheet('location'),
            }}
            onOpenSheet={() => setOpenSheet('location')}
            onClear={() => update({ area: 'anywhere' })}
          />
        </View>
      </Reveal>

      <Reveal index={1} style={styles.hanap}>
        <HanapEntry onOpen={onOpenHanap} />
      </Reveal>

      {underEstimate.length > 0 ? (
        <Reveal index={1} style={styles.highlightSection}>
          <Sign icon={BadgePercent} label="Steals · Under estimate" tone="cobalt" />
          <View style={[styles.highlightRow, wide ? styles.highlightRowWide : null]}>
            {underEstimate.map((listing) => (
              <UnderEstimateCard
                key={listing.id}
                listing={listing}
                wide={wide}
                onOpen={() => onOpenListing?.(listing.id)}
              />
            ))}
          </View>
        </Reveal>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nothing here yet"
          body={
            narrowed
              ? 'Nothing matches these filters. Widen the price range or location.'
              : 'Try a different category, or check back soon.'
          }
          actionLabel={narrowed ? 'Clear filters' : undefined}
          onAction={
            narrowed
              ? () => update({ minPrice: null, maxPrice: null, area: 'anywhere' })
              : undefined
          }
        />
      ) : (
        <View style={[styles.grid, wide ? styles.gridWide : null]} onLayout={grid.onLayout}>
          {filtered.map((listing, index) => (
            <Animated.View
              key={listing.id}
              entering={paperIn(Math.min(index, 4) * 50)}
              exiting={paperOut}
              layout={paperLayout}
              style={wide ? { width: grid.cellWidth } : styles.cell}
            >
              <ListingCard listing={listing} onOpen={() => onOpenListing?.(listing.id)} />
            </Animated.View>
          ))}
          {/* An odd count keeps its last card at half width instead of stretching. */}
          {!wide && filtered.length % 2 === 1 ? <View style={styles.cell} /> : null}
        </View>
      )}

      <PriceFilterSheet
        visible={openSheet === 'price'}
        brackets={!ios}
        filters={filters}
        countFor={(minPrice, maxPrice) => matching({ ...filters, minPrice, maxPrice }).length}
        onClose={() => setOpenSheet(null)}
        onApply={(minPrice, maxPrice) => {
          update({ minPrice, maxPrice });
          setOpenSheet(null);
        }}
      />
      <LocationFilterSheet
        visible={openSheet === 'location'}
        nearMeOnly={ios}
        filters={filters}
        countFor={(area, radiusKm) => matching({ ...filters, area, radiusKm }).length}
        onClose={() => setOpenSheet(null)}
        onApply={(area, radiusKm) => {
          update({ area, radiusKm });
          setOpenSheet(null);
        }}
      />
    </Screen>
  );
}

/** Price's quick choices: none, then the brackets. */
const priceChoices = [
  { key: 'any', label: 'Any price' },
  ...previewPriceBrackets.map(({ key, label }) => ({ key, label })),
];

/** Location's quick choices: the named areas. "Near me" needs a distance, so it opens a sheet. */
const areaChoices = previewMarketAreas.filter((entry) => entry.key !== 'near-me');

/** The narrowest a listing card can be and still fit its title, price and estimate. */
const listingMinWidth = 220;

function UnderEstimateCard({
  listing,
  wide,
  onOpen,
}: {
  readonly listing: PreviewListing;
  readonly wide: boolean;
  readonly onOpen: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const estimate = impliedEstimate(listing);
  const under = Math.round((1 - listing.askingPrice / estimate) * 100);
  return (
    <ZoomLink
      href={`/listing/${listing.id}`}
      label={`${listing.title}, asking ${formatPeso(listing.askingPrice)}, estimated ${formatPeso(estimate)}`}
      onPress={onOpen}
      style={styles.highlightCard}
      containerStyle={[styles.highlightSlot, wide ? styles.highlightSlotWide : null]}
    >
      <Photo
        source={listing.photo}
        label={listing.photoLabel}
        aspectRatio={1}
        radius={tokens.radius.medium}
        style={styles.highlightPhoto}
      />
      <View style={styles.highlightText}>
        <SWText
          variant="bodyCompact"
          tone="textSecondary"
          numberOfLines={1}
          style={under > 0 ? styles.underTitle : null}
        >
          {listing.title}
        </SWText>
        <AskingPriceBadge value={formatPeso(listing.askingPrice)} size="compact" />
        <View style={styles.highlightEstimate}>
          <EstimateBadge value={formatPeso(estimate)} />
        </View>
      </View>
      {under > 0 ? (
        <View style={styles.underSpot} pointerEvents="none">
          <Sticker label={`${under}% under`} tone="marigold" side="end" />
        </View>
      ) : null}
    </ZoomLink>
  );
}

const stylesFor = themedStyles((colors) => ({
  // How far under the AI's estimate a steal is asking, slapped over the card's top corner.
  underSpot: {
    position: 'absolute',
    top: -tokens.spacing[3],
    right: -tokens.spacing[2],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  filters: {
    gap: tokens.spacing[3],
    marginBottom: tokens.spacing[6],
  },
  hanap: {
    marginBottom: tokens.spacing[8],
  },
  // Tight enough that iOS's three filters (Category, Price, Location) share one row.
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
  },
  highlightSection: {
    gap: tokens.spacing[4],
    marginBottom: tokens.spacing[10],
  },
  // Stacked, so each steal gets the full width for its asking price and estimate side by side.
  // The gap leaves room for each card's sticker, which overhangs its top edge.
  highlightRow: {
    gap: tokens.spacing[6],
  },
  highlightSlot: {
    alignSelf: 'stretch',
  },
  // Side by side on a wide window, two to a row.
  highlightRowWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spacing[6],
  },
  highlightSlotWide: {
    flexBasis: '40%',
    flexGrow: 1,
  },
  highlightCard: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    padding: tokens.spacing[3],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.surface,
    ...held(colors),
  },
  highlightPhoto: {
    width: 64,
    height: 64,
    ...held(colors, 0),
  },
  highlightText: {
    flex: 1,
    gap: tokens.spacing['0.5'],
    justifyContent: 'center',
  },
  // The title stops short of the sticker in the card's corner.
  underTitle: {
    marginRight: tokens.spacing[16] + tokens.spacing[4],
  },
  // The AI's tag sits a step apart from the asking price, so the two never read as one.
  highlightEstimate: {
    marginTop: tokens.spacing[2],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spacing[3],
    rowGap: tokens.spacing[4],
  },
  cell: {
    flexBasis: '46%',
    flexGrow: 1,
  },
  gridWide: {
    columnGap: tokens.spacing[4],
    rowGap: tokens.spacing[6],
  },
  tip: {
    marginBottom: tokens.spacing[4],
  },
}));
