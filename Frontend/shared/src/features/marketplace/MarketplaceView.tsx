import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, LargeTitle, PressableScale, Reveal, Screen, SWText } from '../../components';
import { tokens } from '../../design';
import { previewListings } from '../preview/sample-data';
import { ProfileButton } from '../profile/ProfileButton';
import { ListingCard } from './ListingCard';

export interface MarketplaceViewProps {
  readonly onOpenListing?: (listingId: string) => void;
  readonly onSell?: () => void;
  readonly onFilter?: (filter: 'category' | 'price' | 'location') => void;
  readonly onOpenProfile?: () => void;
}

const filters = [
  { key: 'category', label: 'All Apparel' },
  { key: 'price', label: '₱0 - ₱5,000' },
  { key: 'location', label: 'Manila, PH' },
] as const;

export function MarketplaceView({
  onOpenListing,
  onSell,
  onFilter,
  onOpenProfile,
}: MarketplaceViewProps) {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]['key']>('category');

  return (
    <Screen clearTabBar>
      <LargeTitle
        title="Market"
        subtitle="Seller-set prices, checked by the community."
        trailing={
          <View style={styles.actions}>
            <Button label="Sell" variant="secondary" icon={Plus} onPress={onSell} />
            <ProfileButton onPress={onOpenProfile} />
          </View>
        }
      />

      <Reveal index={0} style={styles.filters}>
        {filters.map((filter) => {
          const active = filter.key === activeFilter;
          return (
            <PressableScale
              key={filter.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter: ${filter.label}`}
              onPress={() => {
                setActiveFilter(filter.key);
                onFilter?.(filter.key);
              }}
              style={[styles.filter, active ? styles.filterActive : null]}
            >
              <SWText variant="labelMedium" tone={active ? 'textPrimary' : 'textMuted'}>
                {filter.label}
              </SWText>
            </PressableScale>
          );
        })}
      </Reveal>

      <View style={styles.grid}>
        {previewListings.map((listing, index) => (
          <Reveal key={listing.id} index={index + 1} style={styles.cell}>
            <ListingCard listing={listing} onPress={() => onOpenListing?.(listing.id)} />
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[6],
  },
  filter: {
    minHeight: tokens.focus.minimumTarget - tokens.spacing[2],
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.full,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderSubtle,
  },
  filterActive: {
    backgroundColor: tokens.color.dark.surfaceRaised,
    borderColor: tokens.color.dark.borderStrong,
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
});
