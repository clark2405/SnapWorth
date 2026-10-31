import { FolderPlus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Photo, PressableScale, Surface, SWText, Tag } from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { formatPeso } from '../preview/peso';
import type { ChecklistItem } from './checklist';
import { CollectionNameSheet } from './CollectionSheets';
import { collectionTotals, useCollections, type Collection } from './collections';
import { gainLabel } from './flips';
import { usePaidPrices } from './paid-prices';

/**
 * History's collections, side by side: each with a peek at its photos, what it's worth and its
 * flip, and a card at the end to start a new one.
 */
export function CollectionsStrip({
  items,
  onOpenCollection,
}: {
  /** The owner's things in History. */
  readonly items: readonly ChecklistItem[];
  readonly onOpenCollection?: (collectionId: string) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const { collections, create } = useCollections();
  const [making, setMaking] = useState(false);

  return (
    <View style={styles.wrap}>
      <SWText variant="headingMedium" accessibilityRole="header">
        Collections
      </SWText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.row}
      >
        {collections.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            items={items}
            onPress={() => onOpenCollection?.(collection.id)}
          />
        ))}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="New collection"
          onPress={() => setMaking(true)}
          style={[styles.card, styles.newCard]}
        >
          <FolderPlus size={24} strokeWidth={1.75} color={colors.textSecondary} />
          <SWText variant="label" tone="textSecondary">
            New collection
          </SWText>
        </PressableScale>
      </ScrollView>
      <CollectionNameSheet
        visible={making}
        title="New collection"
        confirmLabel="Make collection"
        items={items}
        onClose={() => setMaking(false)}
        onSave={(name, selected) => {
          const id = create(name, selected);
          setMaking(false);
          onOpenCollection?.(id);
        }}
      />
    </View>
  );
}

function CollectionCard({
  collection,
  items,
  onPress,
}: {
  readonly collection: Collection;
  readonly items: readonly ChecklistItem[];
  readonly onPress: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { paid } = usePaidPrices();
  const totals = collectionTotals(collection, items, paid);
  const photos = items.filter((item) => collection.itemIds.includes(item.id)).slice(0, 4);

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${collection.name}, ${totals.count} items, worth ${formatPeso(totals.worth)}`}
      onPress={onPress}
    >
      <Surface padding={tokens.spacing[3]} style={styles.card}>
        <View style={styles.mosaic}>
          {[0, 1, 2, 3].map((slot) => {
            const item = photos[slot];
            return item ? (
              <Photo
                key={item.id}
                source={item.photo}
                label={item.photoLabel}
                radius={tokens.radius.small}
                style={styles.tile}
              />
            ) : (
              <View key={slot} style={[styles.tile, styles.emptyTile]} />
            );
          })}
        </View>
        <SWText variant="label" numberOfLines={1}>
          {collection.name}
        </SWText>
        <SWText variant="caption" tone="textSecondary">
          {`${totals.count === 1 ? '1 item' : `${totals.count} items`} · ${formatPeso(totals.worth)}`}
        </SWText>
        {totals.flip ? (
          <Tag
            label={gainLabel(totals.flip.gain)}
            tone={totals.flip.gain >= 0 ? 'mint' : 'grave'}
          />
        ) : null}
      </Surface>
    </PressableScale>
  );
}

const cardWidth = 156;
/** The card's edge, which the photos sit inside. */
const cardEdge = 2;
/** Two photos a row, inside the card's padding and edge. */
const tileSize = Math.floor(
  (cardWidth - (tokens.spacing[3] + cardEdge) * 2 - tokens.spacing[1]) / 2,
);

const stylesFor = themedStyles((colors) => ({
  wrap: {
    gap: tokens.spacing[3],
    marginBottom: tokens.spacing[6],
  },
  // Runs to the page's edges, so cards slide out of view at the edge.
  scroller: {
    marginHorizontal: -tokens.layout.pageGutterCompact,
  },
  row: {
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingVertical: tokens.spacing[1],
  },
  card: {
    width: cardWidth,
    gap: tokens.spacing[1],
  },
  newCard: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    borderRadius: tokens.radius.large,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.interactiveBoundary,
  },
  mosaic: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[1],
    marginBottom: tokens.spacing[1],
  },
  tile: {
    width: tileSize,
    height: tileSize,
  },
  emptyTile: {
    borderRadius: tokens.radius.small,
    backgroundColor: colors.sunken,
  },
}));
