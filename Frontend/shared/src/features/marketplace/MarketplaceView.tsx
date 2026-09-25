import { Camera, PackageSearch } from 'lucide-react-native';
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
import { ListingCard } from './ListingCard';

export interface MarketplaceViewProps {
  readonly onOpenListing?: (listingId: string) => void;
  readonly onSell?: () => void;
  readonly onFilter?: (filter: 'category' | 'price' | 'location') => void;
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
  onFilter,
  onOpenProfile,
}: MarketplaceViewProps) {
  const styles = useThemedStyles(stylesFor);
  const [category, setCategory] = useState('all');

  const filtered =
    category === 'all'
      ? previewListings
      : previewListings.filter((listing) => categoryByListing[listing.id] === category);

  const underEstimate = previewListings
    .filter((listing) => listing.verdict === 'too_low')
    .slice(0, 2);

  return (
    <Screen
      clearTabBar
      ambient="value"
      onRefresh={() => new Promise<void>((resolve) => setTimeout(resolve, 900))}
    >
      <LargeTitle
        title="Market"
        subtitle="Seller-set prices, checked by the community."
        trailing={
          <View style={styles.actions}>
            <Button label="Sell" size="small" variant="accent" icon={Camera} onPress={onSell} />
            <ProfileButton onPress={onOpenProfile} />
          </View>
        }
      />

      <Reveal index={0} style={styles.filters}>
        <ChoiceChips
          options={previewMarketCategories}
          value={category}
          scroll
          onChange={(key) => {
            setCategory(key);
            onFilter?.('category');
          }}
        />
      </Reveal>

      {underEstimate.length > 0 ? (
        <Reveal index={1} style={styles.highlightSection}>
          <SWText variant="overline" tone="textMuted">
            Priced under estimate
          </SWText>
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
          body="Try a different category, or check back soon."
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
        </View>
      )}
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
    marginBottom: tokens.spacing[6],
  },
  highlightSection: {
    gap: tokens.spacing[3],
    marginBottom: tokens.spacing[6],
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
    backgroundColor: colors.estimateSurface,
    borderWidth: tokens.border.hairline,
    borderColor: colors.estimateBorder,
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
    columnGap: tokens.spacing[4],
    rowGap: tokens.spacing[6],
  },
  cell: {
    flexBasis: '46%',
    flexGrow: 1,
  },
}));
