import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  GlassCard,
  LargeTitle,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  SWText,
  Tag,
  type TagTone,
} from '../../components';
import { tokens } from '../../design';
import type { VoteChoice } from '../../types';
import { voteLabels } from '../feed/CommunityVerdict';
import { formatPeso, previewListings, type PreviewListing } from '../preview/sample-data';

export interface MarketplaceViewProps {
  readonly onOpenListing?: (listingId: string) => void;
  readonly onSell?: () => void;
  readonly onFilter?: (filter: 'category' | 'price' | 'location') => void;
}

// Consistent with the feed: only "Too High" reads as a warning; the design's red "Too Low"
// badge was an inconsistency.
const verdictTone: Record<VoteChoice, TagTone> = {
  just_right: 'mint',
  too_high: 'danger',
  too_low: 'neutral',
};

const filters = [
  { key: 'category', label: 'All Apparel' },
  { key: 'price', label: '₱0 - ₱5,000' },
  { key: 'location', label: 'Manila, PH' },
] as const;

export function MarketplaceView({ onOpenListing, onSell, onFilter }: MarketplaceViewProps) {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]['key']>('category');

  return (
    <Screen clearTabBar>
      <LargeTitle
        title="Market"
        trailing={
          <PressableScale accessibilityLabel="Sell an item" onPress={onSell} style={styles.sell}>
            <Plus size={16} strokeWidth={2.25} color={tokens.color.dark.accent} />
            <SWText variant="labelSmall" tone="accent">
              Sell
            </SWText>
          </PressableScale>
        }
      />

      <Reveal index={1} style={styles.filters}>
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
              <SWText variant="labelSmall" tone={active ? 'onAccent' : 'textMuted'}>
                {filter.label}
              </SWText>
            </PressableScale>
          );
        })}
      </Reveal>

      <View style={styles.grid}>
        {previewListings.map((listing, index) => (
          <Reveal key={listing.id} index={index + 2} style={styles.cell}>
            <ListingCard listing={listing} onPress={() => onOpenListing?.(listing.id)} />
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

function ListingCard({ listing, onPress }: { listing: PreviewListing; onPress: () => void }) {
  const verdict = `${listing.verdictShare}% ${voteLabels[listing.verdict]}`;

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${listing.title}, asking ${formatPeso(listing.askingPrice)}, community says ${verdict}`}
      onPress={onPress}
    >
      <GlassCard>
        <Photo
          source={listing.photo}
          label={listing.photoLabel}
          aspectRatio={172 / 129}
          radius={0}
        />
        <View style={styles.cardBody}>
          <SWText variant="priceMedium">{formatPeso(listing.askingPrice)}</SWText>
          <SWText variant="bodyCompact" numberOfLines={1}>
            {listing.title}
          </SWText>
          <Tag label={verdict} tone={verdictTone[listing.verdict]} />
        </View>
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  sell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    minHeight: 34,
    paddingHorizontal: tokens.spacing[3],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.glass.mintFill,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.border,
  },
  filters: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[8],
  },
  filter: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.glass.fill,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.border,
  },
  filterActive: {
    backgroundColor: tokens.color.dark.accent,
    borderColor: tokens.color.dark.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[4],
  },
  cell: {
    width: '47.6%',
    flexGrow: 1,
  },
  cardBody: {
    padding: tokens.spacing[3],
    gap: tokens.spacing[1],
  },
});
