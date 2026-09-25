import { PackageSearch, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  ChoiceChips,
  CountUp,
  EmptyState,
  EstimateBadge,
  IconButton,
  LargeTitle,
  Photo,
  Reveal,
  Screen,
  Sparkline,
  Surface,
  SWText,
  Tag,
  useToast,
  ZoomLink,
  type TagTone,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewHistory,
  previewPortfolio,
  type PreviewHistoryItem,
  type PreviewItemStatus,
} from '../preview/sample-data';
import { ProfileButton } from '../profile/ProfileButton';

export interface HistoryViewProps {
  readonly onOpenItem?: (itemId: string) => void;
  readonly onDeleteItem?: (itemId: string) => void;
  /** Opens the listing flow for this item, e.g. `/list/:id`. */
  readonly onListItem?: (itemId: string) => void;
  readonly onSearch?: () => void;
  readonly onOpenProfile?: () => void;
}

type FilterKey = 'all' | PreviewItemStatus;

// The accent marks the one state that is live for sale; every other state is a quiet label.
const statusTag: Record<PreviewItemStatus, { label: string; tone: TagTone }> = {
  listed: { label: 'Listed', tone: 'accent' },
  on_feed: { label: 'On feed', tone: 'outline' },
  private: { label: 'Private', tone: 'neutral' },
  sold: { label: 'Sold', tone: 'neutral' },
};

const filters: readonly { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'listed', label: 'Listed' },
  { key: 'on_feed', label: 'On feed' },
  { key: 'private', label: 'Private' },
  { key: 'sold', label: 'Sold' },
];

export function HistoryView({
  onOpenItem,
  onDeleteItem,
  onListItem,
  onSearch,
  onOpenProfile,
}: HistoryViewProps) {
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [items, setItems] = useState<readonly PreviewHistoryItem[]>(previewHistory);
  const [filter, setFilter] = useState<FilterKey>('all');

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.status === filter)),
    [filter, items],
  );

  const deleteItem = (item: PreviewHistoryItem) => {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    onDeleteItem?.(item.id);
    toast.show({ title: 'Removed from history', body: item.title });
  };

  const shareItem = (item: PreviewHistoryItem) => {
    void Share.share({
      message: `${item.title} — worth about ${formatPeso(item.estimate)} on SnapWorth.`,
    })
      .then((result) => {
        if (result.action === Share.sharedAction) toast.show({ title: 'Item shared' });
      })
      .catch(() => undefined);
  };

  return (
    <Screen
      clearTabBar
      ambient="value"
      onRefresh={() => new Promise((resolve) => setTimeout(resolve, 900))}
    >
      <LargeTitle
        title="History"
        subtitle={`${previewHistory.length} items checked`}
        trailing={
          <View style={styles.actions}>
            <IconButton
              icon={Search}
              label="Search your history"
              appearance="outline"
              onPress={onSearch}
              size={20}
            />
            <ProfileButton onPress={onOpenProfile} />
          </View>
        }
      />

      <Reveal index={0} style={styles.hero}>
        <Surface tone="raised" padding={tokens.spacing[5]} contentStyle={styles.heroContent}>
          <SWText variant="overline" tone="textMuted">
            Your collection
          </SWText>
          <CountUp value={previewPortfolio.total} format={formatPeso} variant="priceHero" />
          <View style={styles.heroMeta}>
            <Tag label={previewPortfolio.changeLabel} tone="success" />
            <SWText variant="caption" tone="textMuted">
              {previewPortfolio.itemCount} items tracked
            </SWText>
          </View>
          <Sparkline values={previewPortfolio.series} height={56} />
        </Surface>
      </Reveal>

      <Reveal index={1} style={styles.filters}>
        <ChoiceChips options={filters} value={filter} onChange={setFilter} scroll />
      </Reveal>

      {visible.length === 0 ? (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <EmptyState
            icon={PackageSearch}
            title="Nothing here"
            body="Nothing matches this filter yet. Try a different one, or check something new."
            actionLabel={filter === 'all' ? undefined : 'Show all'}
            onAction={filter === 'all' ? undefined : () => setFilter('all')}
          />
        </Animated.View>
      ) : (
        <View>
          {visible.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInDown.springify().damping(18)}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition.springify().damping(20)}
            >
              <Reveal index={index + 2}>
                <HistoryRow
                  item={item}
                  onOpen={() => onOpenItem?.(item.id)}
                  onList={() => onListItem?.(item.id)}
                  onShare={() => shareItem(item)}
                  onDelete={() => deleteItem(item)}
                />
              </Reveal>
            </Animated.View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function HistoryRow({
  item,
  onOpen,
  onList,
  onShare,
  onDelete,
}: {
  item: PreviewHistoryItem;
  onOpen: () => void;
  onList: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const status = statusTag[item.status];

  return (
    <ZoomLink
      href={`/item/${item.id}`}
      label={`${item.title}, AI estimate ${formatPeso(item.estimate)}, ${status.label}, captured ${item.capturedOn}`}
      onPress={onOpen}
      style={styles.row}
      menu={[
        { title: 'List for sale', symbol: 'tag', onPress: onList },
        { title: 'Share', symbol: 'square.and.arrow.up', onPress: onShare },
        { title: 'Delete', symbol: 'trash', destructive: true, onPress: onDelete },
      ]}
    >
      <Photo
        source={item.photo}
        label={item.photoLabel}
        radius={tokens.radius.medium}
        style={styles.thumb}
      />
      <View style={styles.text}>
        <SWText variant="headingSmall" numberOfLines={1}>
          {item.title}
        </SWText>
        <View style={styles.meta}>
          <Tag label={status.label} tone={status.tone} />
          <SWText variant="caption" tone="textMuted">
            {item.capturedOn}
          </SWText>
        </View>
      </View>
      <EstimateBadge value={formatPeso(item.estimate)} size="compact" />
    </ZoomLink>
  );
}

const stylesFor = themedStyles(() => ({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  hero: {
    marginBottom: tokens.spacing[6],
  },
  heroContent: {
    gap: tokens.spacing[3],
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  filters: {
    marginBottom: tokens.spacing[5],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radius.medium,
  },
  thumb: {
    width: tokens.layout.thumbnail - tokens.spacing[2],
    height: tokens.layout.thumbnail - tokens.spacing[2],
  },
  text: {
    flex: 1,
    gap: tokens.spacing[1],
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
}));
