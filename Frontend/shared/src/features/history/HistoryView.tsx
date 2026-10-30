import {
  Archive,
  ChevronRight,
  Handshake,
  Lock,
  PackageSearch,
  TrendingUp,
  Vote,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
  paperIn,
  paperLayout,
  paperOut,
  Button,
  ChoiceChips,
  CountUp,
  Divider,
  EmptyState,
  LargeTitle,
  Overline,
  Photo,
  PriceTagIcon,
  Reveal,
  Screen,
  SearchButton,
  type SearchOrigin,
  SnapIcon,
  Sparkline,
  Surface,
  SWText,
  Tag,
  type TagTone,
  useToast,
  ZoomLink,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles, useWideLayout } from '../../design';
import {
  formatPeso,
  previewHistory,
  previewPortfolio,
  type PreviewHistoryItem,
  type PreviewItemStatus,
} from '../preview/sample-data';
import { ProfileButton } from '../profile/ProfileButton';
import { CollectionsStrip } from './CollectionsStrip';
import { flipOf, flipTotals, gainLabel, type FlipTotals } from './flips';
import { usePaidPrices } from './paid-prices';
import { ShareTagSheet, type ShareableItem } from './ShareTagSheet';

export interface HistoryViewProps {
  readonly onOpenItem?: (itemId: string) => void;
  /** Opens a collection's page, e.g. `/collection/:id`. */
  readonly onOpenCollection?: (collectionId: string) => void;
  readonly onDeleteItem?: (itemId: string) => void;
  /** Opens the listing flow for this item, e.g. `/list/:id`. */
  readonly onListItem?: (itemId: string) => void;
  readonly onSearch?: (origin?: SearchOrigin) => void;
  readonly onOpenProfile?: () => void;
  /** Opens the camera from the header, for shells without a persistent Snap control. */
  readonly onSnap?: () => void;
  /** Opens on one status, e.g. `listed` from the profile's "Your listings". */
  readonly initialFilter?: string;
}

type FilterKey = 'all' | PreviewItemStatus;

// Statuses are soft tonal chips with a line icon: live states lean positive, private is
// neutral, and sold is archived.
const statusTag: Record<PreviewItemStatus, { label: string; tone: TagTone; icon: LucideIcon }> = {
  listed: { label: 'Listed', tone: 'mint', icon: PriceTagIcon },
  on_feed: { label: 'On feed', tone: 'sand', icon: Vote },
  private: { label: 'Private', tone: 'sand', icon: Lock },
  sold: { label: 'Sold', tone: 'grave', icon: Handshake },
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
  onOpenCollection,
  onDeleteItem,
  onListItem,
  onSearch,
  onOpenProfile,
  onSnap,
  initialFilter,
}: HistoryViewProps) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<readonly PreviewHistoryItem[]>(previewHistory);
  const [filter, setFilter] = useState<FilterKey>('all');
  const { paid } = usePaidPrices();
  const flips = useMemo(
    () =>
      flipTotals(
        items.map((item) => ({ id: item.id, worth: item.estimate })),
        paid,
      ),
    [items, paid],
  );

  // The tab stays mounted, so follow a new deep link's filter as well as the first one.
  useEffect(() => {
    const match = filters.find((entry) => entry.key === initialFilter);
    if (match) setFilter(match.key);
  }, [initialFilter]);

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.status === filter)),
    [filter, items],
  );

  const deleteItem = (item: PreviewHistoryItem) => {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    onDeleteItem?.(item.id);
    toast.show({ title: 'Removed from history', body: item.title });
  };

  const [sharing, setSharing] = useState<ShareableItem | null>(null);
  const shareItem = (item: PreviewHistoryItem) =>
    setSharing({
      id: item.id,
      title: item.title,
      photo: item.photo,
      photoLabel: item.photoLabel,
      worth: item.estimate,
    });

  // On a wide window the summary and filters sit in a column of their own beside the items.
  const wide = useWideLayout();

  return (
    <Screen
      clearTabBar
      place="history"
      ambient="history"
      onRefresh={() => new Promise((resolve) => setTimeout(resolve, 900))}
    >
      <LargeTitle
        brand
        title="History"
        overlineIcon={Archive}
        overline={`${previewHistory.length} items`}
        trailing={
          <View style={styles.actions}>
            {onSnap ? (
              <Button
                label="Snap"
                size="small"
                variant="secondary"
                icon={SnapIcon}
                onPress={onSnap}
              />
            ) : null}
            {/* On iOS, search is a tab of its own; shells without one pass onSearch. */}
            {onSearch ? <SearchButton label="Search your history" onOpen={onSearch} /> : null}
            <ProfileButton onPress={onOpenProfile} />
          </View>
        }
      />

      <View style={wide ? styles.split : null}>
        <View style={wide ? styles.aside : null}>
          <Reveal index={0} style={styles.hero}>
            {/* The screen's one feature slab: the number everything else here adds up to. */}
            <Surface tone="feature" padding={tokens.spacing[5]} contentStyle={styles.heroContent}>
              <Overline icon={Wallet} label="What it's all worth" tone="onFeatureDim" />
              <CountUp
                value={previewPortfolio.total}
                format={formatPeso}
                variant="priceHero"
                tone="onFeature"
              />
              <View style={styles.heroMeta}>
                <Tag label={previewPortfolio.changeLabel} tone="mint" />
              </View>
              <Sparkline values={previewPortfolio.series} height={56} color={colors.onFeature} />
              {flips ? <FlipSummary totals={flips} /> : null}
            </Surface>
          </Reveal>

          <Reveal index={1}>
            <CollectionsStrip
              items={items.map((item) => ({
                id: item.id,
                title: item.title,
                worth: item.estimate,
                photo: item.photo,
                photoLabel: item.photoLabel,
              }))}
              onOpenCollection={onOpenCollection}
            />
          </Reveal>

          <Reveal index={1} style={styles.filters}>
            {/* The side column is narrow, so its chips wrap instead of scrolling. */}
            <ChoiceChips options={filters} value={filter} onChange={setFilter} scroll={!wide} />
          </Reveal>
        </View>
        <View style={wide ? styles.main : null}>
          {visible.length === 0 ? (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <EmptyState
                icon={PackageSearch}
                title="Nothing in this pile"
                body="Nothing matches this filter yet. Try another, or snap something new."
                actionLabel={filter === 'all' ? undefined : 'Show all'}
                onAction={filter === 'all' ? undefined : () => setFilter('all')}
              />
            </Animated.View>
          ) : (
            // The card eases to its new height as rows come and go, instead of snapping.
            <Animated.View layout={paperLayout}>
              <Surface padding={tokens.spacing[2]}>
                {visible.map((item, index) => (
                  // One entrance per row, staggered down the list: switching filters lays the new
                  // rows down in a short cascade while the rest slide to their places.
                  <Animated.View
                    key={item.id}
                    entering={paperIn(Math.min(index, 6) * 40)}
                    exiting={paperOut}
                    layout={paperLayout}
                  >
                    {index > 0 ? <Divider style={styles.divider} /> : null}
                    <HistoryRow
                      item={item}
                      paid={paid[item.id]}
                      onOpen={() => onOpenItem?.(item.id)}
                      onList={() => onListItem?.(item.id)}
                      onShare={() => shareItem(item)}
                      onDelete={() => deleteItem(item)}
                    />
                  </Animated.View>
                ))}
              </Surface>
            </Animated.View>
          )}
        </View>
      </View>
      <ShareTagSheet item={sharing} onClose={() => setSharing(null)} />
    </Screen>
  );
}

/** The summary column beside the items on a wide window. */
const asideWidth = 360;

/** On the total card: what was paid for the items with a price, and what they're worth now. */
function FlipSummary({ totals }: { readonly totals: FlipTotals }) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.flips}>
      <SWText variant="bodySmall" tone="onFeatureDim" style={styles.flipsText}>
        {`Paid ${formatPeso(totals.paid)} for ${totals.count} of these, now worth ${formatPeso(totals.worth)}`}
      </SWText>
      <Tag
        label={totals.gain >= 0 ? `${gainLabel(totals.gain)} flip` : gainLabel(totals.gain)}
        tone={totals.gain >= 0 ? 'mint' : 'grave'}
        icon={TrendingUp}
      />
    </View>
  );
}

function HistoryRow({
  item,
  paid,
  onOpen,
  onList,
  onShare,
  onDelete,
}: {
  item: PreviewHistoryItem;
  /** What the owner paid for it, when they've noted it. */
  paid?: number;
  onOpen: () => void;
  onList: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const status = statusTag[item.status];
  const flip = paid === undefined ? null : flipOf(paid, item.estimate);

  return (
    <ZoomLink
      href={`/item/${item.id}`}
      label={`${item.title}, AI estimate ${formatPeso(item.estimate)}${
        flip ? `, paid ${formatPeso(flip.paid)}, ${gainLabel(flip.gain)}` : ''
      }, ${status.label}, captured ${item.capturedOn}`}
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
        radius={tokens.radius.small}
        style={styles.thumb}
      />
      <View style={styles.text}>
        <SWText variant="headingSmall" numberOfLines={1}>
          {item.title}
        </SWText>
        <SWText variant="labelSmall" tone="textSecondary" numberOfLines={1}>
          {formatPeso(item.estimate)} est. · {item.capturedOn}
        </SWText>
        <View style={styles.tags}>
          <Tag label={status.label} tone={status.tone} icon={status.icon} />
          {flip ? (
            <Tag
              label={`Paid ${formatPeso(flip.paid)} · ${gainLabel(flip.gain)}`}
              tone={flip.gain >= 0 ? 'mint' : 'grave'}
            />
          ) : null}
        </View>
      </View>
      <ChevronRight size={18} strokeWidth={1.75} color={colors.textMuted} />
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
  split: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing[8],
  },
  aside: {
    width: asideWidth,
  },
  main: {
    flex: 1,
    minWidth: 0,
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
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[1],
  },
  flips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[2],
    paddingTop: tokens.spacing[3],
  },
  flipsText: {
    flexShrink: 1,
  },
  divider: {
    marginLeft: tokens.spacing[3] + 56 + tokens.spacing[3],
    marginRight: tokens.spacing[3],
  },
}));
