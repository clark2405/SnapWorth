import { Search, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  EstimateBadge,
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
import { ProfileButton } from '../profile/ProfileButton';

export interface HistoryViewProps {
  readonly onOpenItem?: (itemId: string) => void;
  readonly onDeleteItem?: (itemId: string) => void;
  readonly onSearch?: () => void;
  readonly onOpenProfile?: () => void;
}

// The accent marks the one state that is live for sale; every other state is a quiet label.
const statusTag: Record<PreviewItemStatus, { label: string; tone: TagTone }> = {
  listed: { label: 'Listed', tone: 'accent' },
  on_feed: { label: 'On feed', tone: 'outline' },
  private: { label: 'Private', tone: 'neutral' },
  sold: { label: 'Sold', tone: 'neutral' },
};

export function HistoryView({
  onOpenItem,
  onDeleteItem,
  onSearch,
  onOpenProfile,
}: HistoryViewProps) {
  return (
    <Screen clearTabBar>
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
      <View style={styles.grid}>
        {previewHistory.map((item, index) => (
          <Reveal key={item.id} index={index} style={styles.cell}>
            <HistoryCell
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

function HistoryCell({
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
    <View style={styles.item}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${item.title}, AI estimate ${formatPeso(item.estimate)}, ${status.label}, captured ${item.capturedOn}`}
        onPress={onOpen}
        style={styles.open}
      >
        <Photo
          source={item.photo}
          label={item.photoLabel}
          aspectRatio={1}
          radius={tokens.radius.large}
        />
        <SWText variant="headingSmall" numberOfLines={2}>
          {item.title}
        </SWText>
        <EstimateBadge value={formatPeso(item.estimate)} />
      </PressableScale>
      <View style={styles.meta}>
        <View style={styles.metaText}>
          <Tag label={status.label} tone={status.tone} />
          <SWText variant="caption" tone="textMuted">
            {item.capturedOn}
          </SWText>
        </View>
        <IconButton
          icon={Trash2}
          label={`Delete ${item.title} from history`}
          tone="textMuted"
          size={18}
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spacing[4],
    rowGap: tokens.spacing[8],
  },
  cell: {
    // Two columns: each cell takes just under half so the column gap fits beside it.
    flexBasis: '46%',
    flexGrow: 1,
  },
  item: {
    gap: tokens.spacing[2],
  },
  open: {
    gap: tokens.spacing[3],
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: -tokens.spacing[3],
  },
  metaText: {
    flex: 1,
    gap: tokens.spacing[1],
  },
});
