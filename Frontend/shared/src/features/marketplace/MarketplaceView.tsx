import { BadgePercent, Camera, PackageSearch } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  AskingPriceBadge,
  Button,
  ChoiceChips,
  EmptyState,
  EstimateBadge,
  LargeTitle,
  Overline,
  Photo,
  Reveal,
  Screen,
  SWText,
  ZoomLink,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewListings,
  previewMarketCategories,
  type PreviewListing,
} from '../preview/sample-data';
import { ProfileButton } from '../profile/ProfileButton';
import { Tip } from '../tips';
import { ListingCard } from './ListingCard';
import {
  areaLabel,
  defaultMarketFilters,
  FilterPill,
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
}

// Preview-only: listings don't carry a category field yet, so map them locally against
// `previewMarketCategories` until that field exists on the real listing.
const categoryByListing: Readonly<Record<string, string>> = {
  'polaroid-sun-600': 'collectibles',
  'air-jordan-1-bred': 'sneakers',
  'retro-walkman': 'electronics',
  'keychron-keyboard': 'electronics',
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
}: MarketplaceViewProps) {
  const styles = useThemedStyles(stylesFor);
  const [filters, setFilters] = useState<MarketFilters>(defaultMarketFilters);
  const [openSheet, setOpenSheet] = useState<'price' | 'location' | null>(null);

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
  const narrowed =
    filters.minPrice !== null || filters.maxPrice !== null || filters.area !== 'anywhere';

  // Steals sit above the grid only while browsing everything; once narrowed, the grid is the answer.
  const underEstimate = narrowed
    ? []
    : previewListings.filter((listing) => listing.verdict === 'too_low').slice(0, 2);

  return (
    <Screen
      clearTabBar
      ambient="market"
      onRefresh={() => new Promise<void>((resolve) => setTimeout(resolve, 900))}
    >
      <LargeTitle
        title="Market"
        trailing={
          <View style={styles.actions}>
            {/* On iOS, Snap rides above the tab bar; shells without it pass onSell. */}
            {onSell ? (
              <Button
                label="Sell"
                size="small"
                variant="secondary"
                icon={Camera}
                onPress={onSell}
              />
            ) : null}
            <ProfileButton onPress={onOpenProfile} />
          </View>
        }
      />

      <Tip id="save" style={styles.tip} />

      <Reveal index={0} style={styles.filters}>
        <ChoiceChips
          options={previewMarketCategories}
          value={filters.category}
          scroll
          onChange={(key) => update({ category: key })}
        />
        <View style={styles.pills}>
          <FilterPill
            icon={filterIcons.price}
            placeholder="Price"
            value={priceLabel(filters.minPrice, filters.maxPrice)}
            onOpen={() => setOpenSheet('price')}
            onClear={() => update({ minPrice: null, maxPrice: null })}
          />
          <FilterPill
            icon={filterIcons.location}
            placeholder="Location"
            value={areaLabel(filters.area, filters.radiusKm)}
            onOpen={() => setOpenSheet('location')}
            onClear={() => update({ area: 'anywhere' })}
          />
        </View>
      </Reveal>

      {underEstimate.length > 0 ? (
        <Reveal index={1} style={styles.highlightSection}>
          <Overline icon={BadgePercent} label="Steals · Under estimate" />
          <View style={styles.highlightRow}>
            {underEstimate.map((listing) => (
              <UnderEstimateCard
                key={listing.id}
                listing={listing}
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
        <View style={styles.grid}>
          {filtered.map((listing, index) => (
            <Animated.View
              key={listing.id}
              entering={FadeInDown.springify()
                .damping(18)
                .delay(Math.min(index, 4) * 50)}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition.springify().damping(20)}
              style={styles.cell}
            >
              <ListingCard listing={listing} onOpen={() => onOpenListing?.(listing.id)} />
            </Animated.View>
          ))}
          {/* An odd count keeps its last card at half width instead of stretching. */}
          {filtered.length % 2 === 1 ? <View style={styles.cell} /> : null}
        </View>
      )}

      <PriceFilterSheet
        visible={openSheet === 'price'}
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

function UnderEstimateCard({
  listing,
  onOpen,
}: {
  readonly listing: PreviewListing;
  readonly onOpen: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const estimate = impliedEstimate(listing);
  return (
    <ZoomLink
      href={`/listing/${listing.id}`}
      label={`${listing.title}, asking ${formatPeso(listing.askingPrice)}, estimated ${formatPeso(estimate)}`}
      onPress={onOpen}
      style={styles.highlightCard}
      containerStyle={styles.highlightSlot}
    >
      <Photo
        source={listing.photo}
        label={listing.photoLabel}
        aspectRatio={1}
        radius={tokens.radius.medium}
        style={styles.highlightPhoto}
      />
      <View style={styles.highlightText}>
        <SWText variant="bodyCompact" tone="textSecondary" numberOfLines={1}>
          {listing.title}
        </SWText>
        <AskingPriceBadge value={formatPeso(listing.askingPrice)} size="compact" />
        <EstimateBadge value={formatPeso(estimate)} />
      </View>
    </ZoomLink>
  );
}

const stylesFor = themedStyles((colors) => ({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  filters: {
    gap: tokens.spacing[3],
    marginBottom: tokens.spacing[8],
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
  },
  highlightSection: {
    gap: tokens.spacing[4],
    marginBottom: tokens.spacing[10],
  },
  highlightRow: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
  },
  highlightSlot: {
    flex: 1,
  },
  highlightCard: {
    flex: 1,
    flexDirection: 'row',
    gap: tokens.spacing[3],
    padding: tokens.spacing[3],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.surface,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderSubtle,
  },
  highlightPhoto: {
    width: 64,
    height: 64,
  },
  highlightText: {
    flex: 1,
    gap: tokens.spacing['0.5'],
    justifyContent: 'center',
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
  tip: {
    marginBottom: tokens.spacing[4],
  },
}));
