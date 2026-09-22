import { Search, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  GlassCard,
  IconButton,
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
import {
  formatPeso,
  previewHistory,
  type PreviewHistoryItem,
  type PreviewItemStatus,
} from '../preview/sample-data';

export interface HistoryViewProps {
  readonly onOpenItem?: (itemId: string) => void;
  readonly onDeleteItem?: (itemId: string) => void;
  readonly onSearch?: () => void;
}

// Mint marks the one state that is live for sale; every other state is a neutral label.
const statusTag: Record<PreviewItemStatus, { label: string; tone: TagTone }> = {
  listed: { label: 'Listed', tone: 'mint' },
  on_feed: { label: 'On Feed', tone: 'outline' },
  private: { label: 'Private', tone: 'neutral' },
  sold: { label: 'Sold', tone: 'neutral' },
};

export function HistoryView({ onOpenItem, onDeleteItem, onSearch }: HistoryViewProps) {
  return (
    <Screen clearTabBar>
      <LargeTitle
        title="History"
        trailing={
          <IconButton
            icon={Search}
            label="Search your history"
            appearance="glass"
            onPress={onSearch}
            size={20}
          />
        }
      />
      <View style={styles.list}>
        {previewHistory.map((item, index) => (
          <Reveal key={item.id} index={index + 1}>
            <HistoryRow
              item={item}
              onOpen={() => onOpenItem?.(item.id)}
              onDelete={() => onDeleteItem?.(item.id)}
            />
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

function HistoryRow({
  item,
  onOpen,
  onDelete,
}: {
  item: PreviewHistoryItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const status = statusTag[item.status];

  return (
    <GlassCard padding={tokens.spacing[3]}>
      <View style={styles.row}>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`${item.title}, estimated ${formatPeso(item.estimate)}, ${status.label}, captured ${item.capturedOn}`}
          onPress={onOpen}
          containerStyle={styles.open}
          style={styles.openInner}
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
            <View style={styles.priceRow}>
              <SWText variant="priceSmall" tone="accent">
                {formatPeso(item.estimate)}
              </SWText>
              <Tag label={status.label} tone={status.tone} />
            </View>
            <SWText variant="caption" tone="textMuted">
              Captured {item.capturedOn}
            </SWText>
          </View>
        </PressableScale>
        <View style={styles.delete}>
          <IconButton
            icon={Trash2}
            label={`Delete ${item.title} from history`}
            tone="danger"
            size={20}
            onPress={onDelete}
          />
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: tokens.spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  open: {
    flex: 1,
  },
  openInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  thumb: {
    width: 72,
    height: 72,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  // Keeps the full 44px touch target while giving the title the width the design gives it.
  delete: {
    marginLeft: -tokens.spacing[1],
    marginRight: -tokens.spacing[2],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
});
