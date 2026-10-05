import {
  Archive,
  ChevronRight,
  Handshake,
  Lock,
  PackageSearch,
  Tag as TagIcon,
  Vote,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  ChoiceChips,
  CountUp,
  Divider,
  EmptyState,
  LargeTitle,
  Overline,
  Photo,
  Reveal,
  Screen,
  SearchButton,
  Sparkline,
  Surface,
  SWText,
  Tag,
  useToast,
  ZoomLink,
  type SearchOrigin,
  type TagTone,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
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
  readonly onSearch?: (origin?: SearchOrigin) => void;
  readonly onOpenProfile?: () => void;
}

type FilterKey = 'all' | PreviewItemStatus;

// Statuses are soft tonal chips with a line icon: live states lean positive, private is
// neutral, and sold is archived.
const statusTag: Record<PreviewItemStatus, { label: string; tone: TagTone; icon: LucideIcon }> = {
  listed: { label: 'Listed', tone: 'mint', icon: TagIcon },
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
  onDeleteItem,
  onListItem,
  onSearch,
  onOpenProfile,
}: HistoryViewProps) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
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
      ambient="history"
      onRefresh={() => new Promise((resolve) => setTimeout(resolve, 900))}
    >
      <LargeTitle
        title="Your stash"
        overlineIcon={Archive}
        overline={`${previewHistory.length} items`}
        trailing={
          <View style={styles.actions}>
            <SearchButton label="Search your history" onOpen={onSearch} />
            <ProfileButton onPress={onOpenProfile} />
          </View>
        }
      />

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
        <Surface padding={tokens.spacing[2]}>
          {visible.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInDown.springify().damping(18)}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition.springify().damping(20)}
            >
              <Reveal index={index + 2}>
                {index > 0 ? <Divider style={styles.divider} /> : null}
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
        </Surface>
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
  const { colors } = useTheme();
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
        <Tag label={status.label} tone={status.tone} icon={status.icon} />
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
  divider: {
    marginLeft: tokens.spacing[3] + 56 + tokens.spacing[3],
    marginRight: tokens.spacing[3],
  },
}));
