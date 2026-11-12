import { BadgePercent, LayoutGrid, PackageSearch, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
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
  ScreenSkeleton,
  Sign,
  SnapIcon,
  Sticker,
  Surface,
  SWText,
  useGridColumns,
  ZoomLink,
} from '../../components';
import { held, themedStyles, tokens, useThemedStyles, useWideLayout } from '../../design';
import {
  formatPeso,
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
import { toPreviewListing, useMarketplace } from './marketplace-state';
import { distanceKm, listingCoordinates } from './places';
import { useViewerLocation } from './viewer-location';

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
  const { listings, refresh, status } = useMarketplace();
  const location = useViewerLocation();
  const [filters, setFilters] = useState<MarketFilters>(defaultMarketFilters);
  const [openSheet, setOpenSheet] = useState<'price' | 'location' | null>(null);
  const ios = Platform.OS === 'ios';

  const update = (change: Partial<MarketFilters>) => {
    const next = { ...filters, ...change };
    setFilters(next);
    onFiltersChange?.(next);
  };

  // "Near me" asks where the viewer is the first time it's picked, never at launch.
  const nearMe = filters.area === 'near-me';
  const askForLocation = location.request;
  useEffect(() => {
    if (nearMe && location.status === 'idle') void askForLocation();
  }, [askForLocation, location.status, nearMe]);

  const matching = (candidate: MarketFilters) =>
    listings.filter((listing) => {
      const category = listing.category ?? categoryByListing[listing.id];
      const preview = toPreviewListing(listing);
      const distance = location.position
        ? distanceKm(location.position, listingCoordinates(listing))
        : null;
      return (
        (candidate.category === 'all' || category === candidate.category) &&
        matchesPriceAndPlace({ ...preview, area: listing.area, distanceKm: distance }, candidate)
      );
    });

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
    : listings
        .filter((listing) => listing.verdict === 'too_low')
        .slice(0, 2)
        .map(toPreviewListing);

  // The first load is not an empty Market, and neither is one that failed.
  if (status === 'loading' && listings.length === 0) {
    return <ScreenSkeleton kind="tab" place="market" />;
  }

  return (
    <Screen clearTabBar place="market" ambient="market" onRefresh={() => refresh()}>
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

      {nearMe && location.position === null ? (
        <Reveal index={1}>
          <NearMeNotice
            status={location.status}
            onTryAgain={() => void location.request()}
            onClear={() => update({ area: 'anywhere' })}
          />
        </Reveal>
      ) : null}

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

      {status === 'failed' && listings.length === 0 ? (
        <EmptyState
          icon={WifiOff}
          tone="error"
          title="Couldn’t load the market"
          body="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void refresh()}
        />
      ) : filtered.length === 0 ? (
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
              <ListingCard
                listing={toPreviewListing(listing)}
                onOpen={() => onOpenListing?.(listing.id)}
              />
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

/**
 * Why "Near me" isn't narrowing anything: still looking, or the viewer's position can't be had.
 * While it can't, every listing shows, and this says so with a way out.
 */
function NearMeNotice({
  status,
  onTryAgain,
  onClear,
}: {
  readonly status: ReturnType<typeof useViewerLocation>['status'];
  readonly onTryAgain: () => void;
  readonly onClear: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const looking = status === 'idle' || status === 'locating';
  return (
    <Surface padding={tokens.spacing[4]} contentStyle={styles.nearMe}>
      <SWText variant="label" accessibilityRole="header">
        {looking
          ? 'Finding where you are…'
          : status === 'denied'
            ? 'Location is off for SnapWorth'
            : 'Couldn’t find where you are'}
      </SWText>
      {looking ? null : (
        <>
          <SWText variant="bodySmall" tone="textSecondary">
            {status === 'denied'
              ? 'Allow location for SnapWorth in Settings to see what’s near you. Until then, every listing shows. Your position stays on your phone.'
              : 'Check that location services are on. Until then, every listing shows.'}
          </SWText>
          <View style={styles.nearMeActions}>
            {status === 'denied' ? null : (
              <Button label="Try again" size="small" variant="secondary" onPress={onTryAgain} />
            )}
            <Button label="Clear Near me" size="small" variant="tertiary" onPress={onClear} />
          </View>
        </>
      )}
    </Surface>
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
  nearMe: {
    gap: tokens.spacing[2],
  },
  nearMeActions: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
  },
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
