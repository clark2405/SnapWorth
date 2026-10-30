import { FolderOpen, Pencil, Share2, Trash2, Wallet, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  CountUp,
  Divider,
  EmptyState,
  IconButton,
  NavHeader,
  Overline,
  Photo,
  Reveal,
  Screen,
  Surface,
  SWText,
  Tag,
  Toggle,
  useToast,
  ZoomLink,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import { formatPeso } from '../preview/peso';
import { previewHistory } from '../preview/sample-data';
import type { ChecklistItem } from './checklist';
import { CollectionItemsSheet, CollectionNameSheet } from './CollectionSheets';
import { collectionTotals, useCollections } from './collections';
import { flipOf, gainLabel } from './flips';
import { usePaidPrices } from './paid-prices';
import { ShareCollectionCard } from './ShareCollectionCard';
import { SharePictureSheet } from './SharePictureSheet';

export interface CollectionViewProps {
  readonly collectionId?: string;
  readonly onBack?: () => void;
  readonly onOpenItem?: (itemId: string) => void;
  /** Called once the collection is deleted, to leave its page. */
  readonly onDeleted?: () => void;
}

/** The owner's things, as History holds them (sample data until History is stored). */
export const historyChecklist: readonly ChecklistItem[] = previewHistory.map((item) => ({
  id: item.id,
  title: item.title,
  worth: item.estimate,
  photo: item.photo,
  photoLabel: item.photoLabel,
}));

/**
 * One collection: what it's all worth, how the flip went across the things in it with a price
 * paid, and the things themselves. The owner renames it, changes what's in it, shares it as one
 * picture, or deletes it (the things stay in History).
 */
export function CollectionView({
  collectionId,
  onBack,
  onOpenItem,
  onDeleted,
}: CollectionViewProps) {
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const { collections, rename, setItems, remove } = useCollections();
  const { paid } = usePaidPrices();
  const [sheet, setSheet] = useState<'rename' | 'items' | 'share' | null>(null);
  const [showPaid, setShowPaid] = useState(false);
  const collection = collections.find((entry) => entry.id === collectionId);

  if (!collection) {
    return (
      <Screen ambient="history" header={<NavHeader title="Collection" onBack={onBack} banded />}>
        <EmptyState
          icon={FolderOpen}
          title="This collection is gone"
          body="It may have been deleted. Your things are still in History."
          actionLabel="Back to History"
          onAction={onBack}
        />
      </Screen>
    );
  }

  const items = historyChecklist.filter((item) => collection.itemIds.includes(item.id));
  const totals = collectionTotals(collection, historyChecklist, paid);

  return (
    <Screen
      ambient="history"
      header={
        <NavHeader
          title={collection.name}
          onBack={onBack}
          banded
          trailing={
            items.length > 0 ? (
              <IconButton
                icon={Share2}
                label="Share this collection"
                appearance="glass"
                onPress={() => {
                  setShowPaid(false);
                  setSheet('share');
                }}
              />
            ) : null
          }
        />
      }
      contentStyle={styles.content}
    >
      <Reveal index={0}>
        <Surface tone="feature" padding={tokens.spacing[5]} contentStyle={styles.hero}>
          <Overline icon={Wallet} label="What it's all worth" tone="onFeatureDim" />
          <CountUp value={totals.worth} format={formatPeso} variant="priceHero" tone="onFeature" />
          <SWText variant="bodySmall" tone="onFeatureDim">
            {totals.count === 1 ? '1 item' : `${totals.count} items`}
            {totals.flip
              ? ` · paid ${formatPeso(totals.flip.paid)} for ${totals.flip.count} of them`
              : ''}
          </SWText>
          {totals.flip ? (
            <View style={styles.heroTag}>
              <Tag
                label={`${gainLabel(totals.flip.gain)} flip`}
                tone={totals.flip.gain >= 0 ? 'mint' : 'grave'}
              />
            </View>
          ) : null}
        </Surface>
      </Reveal>

      <Reveal index={1}>
        {items.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Nothing in it yet"
            body="Pick things from your History to put in this collection."
            actionLabel="Add things"
            onAction={() => setSheet('items')}
          />
        ) : (
          <Surface padding={tokens.spacing[2]}>
            {items.map((item, index) => {
              const price = paid[item.id];
              const flip = price === undefined ? null : flipOf(price, item.worth);
              return (
                <View key={item.id}>
                  {index > 0 ? <Divider style={styles.divider} /> : null}
                  <View style={styles.row}>
                    <ZoomLink
                      href={`/item/${item.id}`}
                      label={`${item.title}, AI estimate ${formatPeso(item.worth)}`}
                      onPress={() => onOpenItem?.(item.id)}
                      // The row's width goes on the outer pressable: on iOS the link wraps it,
                      // and a width only on the inner one leaves the text no room.
                      containerStyle={styles.fill}
                      style={styles.link}
                    >
                      <Photo
                        source={item.photo}
                        label={item.photoLabel}
                        radius={tokens.radius.small}
                        style={styles.thumb}
                      />
                      <View style={styles.text}>
                        <SWText variant="headingSmall" numberOfLines={1}>
                          {item.title}
                        </SWText>
                        <SWText variant="labelSmall" tone="textSecondary">
                          {formatPeso(item.worth)} est.
                        </SWText>
                        {flip ? (
                          <Tag
                            label={`Paid ${formatPeso(flip.paid)} · ${gainLabel(flip.gain)}`}
                            tone={flip.gain >= 0 ? 'mint' : 'grave'}
                          />
                        ) : null}
                      </View>
                    </ZoomLink>
                    <IconButton
                      icon={X}
                      label={`Take ${item.title} out of this collection`}
                      onPress={() =>
                        setItems(
                          collection.id,
                          collection.itemIds.filter((id) => id !== item.id),
                        )
                      }
                    />
                  </View>
                </View>
              );
            })}
          </Surface>
        )}
      </Reveal>

      <Reveal index={2} style={styles.actions}>
        {items.length > 0 ? (
          <Button
            label="Add or take out things"
            variant="secondary"
            onPress={() => setSheet('items')}
          />
        ) : null}
        <Button
          label="Rename"
          variant="tertiary"
          icon={Pencil}
          onPress={() => setSheet('rename')}
        />
        <Button
          label="Delete collection"
          variant="tertiary"
          icon={Trash2}
          onPress={() => {
            remove(collection.id);
            toast.show({ title: 'Collection deleted', body: 'Your things are still in History.' });
            onDeleted?.();
          }}
        />
      </Reveal>

      <CollectionNameSheet
        visible={sheet === 'rename'}
        title="Rename collection"
        confirmLabel="Save"
        initialName={collection.name}
        onClose={() => setSheet(null)}
        onSave={(name) => {
          rename(collection.id, name);
          setSheet(null);
        }}
      />
      <CollectionItemsSheet
        visible={sheet === 'items'}
        items={historyChecklist}
        selected={collection.itemIds}
        onClose={() => setSheet(null)}
        onSave={(selected) => {
          setItems(collection.id, selected);
          setSheet(null);
        }}
      />
      <SharePictureSheet
        visible={sheet === 'share'}
        onClose={() => setSheet(null)}
        title="Share your collection"
        fallbackText={`My ${collection.name}: ${totals.count} things worth about ${formatPeso(totals.worth)} on SnapWorth.`}
        renderCard={(ref) => (
          <ShareCollectionCard
            ref={ref}
            name={collection.name}
            photos={items.map((item) => ({ photo: item.photo, label: item.photoLabel }))}
            count={totals.count}
            worth={totals.worth}
            flip={showPaid ? totals.flip : null}
          />
        )}
      >
        {totals.flip ? (
          <View style={styles.option}>
            <View style={styles.optionText}>
              <SWText variant="label">Show what I paid</SWText>
              <SWText variant="caption" tone="textMuted">
                {`Adds “Paid ${formatPeso(totals.flip.paid)}” to the picture.`}
              </SWText>
            </View>
            <Toggle
              value={showPaid}
              onValueChange={setShowPaid}
              accessibilityLabel="Show what I paid on the picture"
            />
          </View>
        ) : null}
      </SharePictureSheet>
    </Screen>
  );
}

const stylesFor = themedStyles(() => ({
  content: {
    gap: tokens.spacing[5],
    paddingTop: tokens.spacing[4],
  },
  hero: {
    gap: tokens.spacing[2],
  },
  heroTag: {
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: tokens.spacing[1],
  },
  fill: {
    flex: 1,
  },
  link: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
  },
  thumb: {
    width: 56,
    height: 56,
  },
  text: {
    flex: 1,
    gap: 3,
    alignItems: 'flex-start',
  },
  divider: {
    marginLeft: tokens.spacing[3] + 56 + tokens.spacing[3],
    marginRight: tokens.spacing[3],
  },
  actions: {
    gap: tokens.spacing[2],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
}));
