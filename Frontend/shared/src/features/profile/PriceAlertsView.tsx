import { BellRing, ChevronRight, Heart, Pencil, TrendingDown } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  ChoiceChips,
  EmptyState,
  ListGroup,
  NavHeader,
  Photo,
  PressableScale,
  Reveal,
  Screen,
  Sheet,
  SWText,
  useToast,
  Toggle,
} from '../../components';
import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewListings,
  previewPriceAlerts,
  type PreviewListing,
  type PreviewPriceAlert,
} from '../preview/sample-data';

export interface PriceAlertsViewProps {
  readonly onBack?: () => void;
  readonly onOpenListing?: (listingId: string) => void;
  readonly onBrowseMarket?: () => void;
}

type Cut = '5' | '10' | '15' | '20';

const cuts: readonly { key: Cut; label: string }[] = [
  { key: '5', label: '5% off' },
  { key: '10', label: '10% off' },
  { key: '15', label: '15% off' },
  { key: '20', label: '20% off' },
];

const roundTo50 = (value: number) => Math.round(value / 50) * 50;

/**
 * The listings you are watching and the price that would make you move. Each alert can be
 * paused, given a new price, or dropped. Saving a listing (the heart) is what adds one.
 */
export function PriceAlertsView({ onBack, onOpenListing, onBrowseMarket }: PriceAlertsViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [alerts, setAlerts] = useState<readonly PreviewPriceAlert[]>(previewPriceAlerts);
  const [editing, setEditing] = useState<string | null>(null);
  const [cut, setCut] = useState<Cut>('10');

  const rows = alerts.flatMap((alert) => {
    const listing = previewListings.find((entry) => entry.id === alert.listingId);
    return listing ? [{ alert, listing }] : [];
  });
  const editingRow = rows.find((row) => row.alert.listingId === editing);

  const update = (listingId: string, change: Partial<PreviewPriceAlert>) =>
    setAlerts((current) =>
      current.map((alert) => (alert.listingId === listingId ? { ...alert, ...change } : alert)),
    );

  const openEditor = (row: { alert: PreviewPriceAlert; listing: PreviewListing }) => {
    const off = 1 - row.alert.alertBelow / row.listing.askingPrice;
    const nearest = cuts.reduce((best, entry) =>
      Math.abs(Number(entry.key) / 100 - off) < Math.abs(Number(best.key) / 100 - off)
        ? entry
        : best,
    );
    setCut(nearest.key);
    setEditing(row.alert.listingId);
  };

  return (
    <Screen
      header={<NavHeader title="Price alerts" onBack={onBack} banded />}
      contentStyle={styles.content}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No price alerts"
          body="Tap the heart on a listing and we'll tell you when its price drops."
          actionLabel="Browse the market"
          onAction={onBrowseMarket}
        />
      ) : (
        <>
          <Reveal index={0}>
            <ListGroup title="Watching" icon={BellRing}>
              {rows.map(({ alert, listing }) => (
                <AlertRow
                  key={alert.listingId}
                  alert={alert}
                  listing={listing}
                  onOpen={() => onOpenListing?.(listing.id)}
                  onEdit={() => openEditor({ alert, listing })}
                  onToggle={(on) => {
                    haptic('select');
                    update(alert.listingId, { on });
                  }}
                />
              ))}
            </ListGroup>
          </Reveal>
          <Reveal index={1}>
            <SWText variant="caption" tone="textMuted" style={styles.footnote}>
              Saving a listing with the heart adds an alert 10% under its asking price. Alerts
              arrive as notifications when Price drops is on.
            </SWText>
          </Reveal>
        </>
      )}

      <Sheet
        visible={editingRow !== undefined}
        onClose={() => setEditing(null)}
        title="Alert me when it drops"
      >
        {editingRow ? (
          <View style={styles.sheet}>
            <SWText variant="bodyMedium" tone="textSecondary">
              {editingRow.listing.title} is asking {formatPeso(editingRow.listing.askingPrice)}.
            </SWText>
            <ChoiceChips options={cuts} value={cut} onChange={setCut} />
            <View style={styles.preview}>
              <TrendingDown size={18} strokeWidth={2} color={colors.success} />
              <SWText variant="priceMedium">
                Under{' '}
                {formatPeso(roundTo50(editingRow.listing.askingPrice * (1 - Number(cut) / 100)))}
              </SWText>
            </View>
            <Button
              label="Save alert"
              onPress={() => {
                update(editingRow.alert.listingId, {
                  alertBelow: roundTo50(editingRow.listing.askingPrice * (1 - Number(cut) / 100)),
                  on: true,
                });
                haptic('success');
                setEditing(null);
              }}
            />
            <Button
              label="Stop watching"
              variant="tertiary"
              onPress={() => {
                setAlerts((current) =>
                  current.filter((alert) => alert.listingId !== editingRow.alert.listingId),
                );
                setEditing(null);
                toast.show({ title: 'Alert removed' });
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function AlertRow({
  alert,
  listing,
  onOpen,
  onEdit,
  onToggle,
}: {
  readonly alert: PreviewPriceAlert;
  readonly listing: PreviewListing;
  readonly onOpen: () => void;
  readonly onEdit: () => void;
  readonly onToggle: (on: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.row}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${listing.title}, asking ${formatPeso(listing.askingPrice)}`}
        haptic="select"
        onPress={onOpen}
        style={styles.rowMain}
      >
        <Photo
          source={listing.photo}
          label={listing.photoLabel}
          radius={tokens.radius.medium}
          style={styles.thumb}
        />
        <View style={styles.rowText}>
          <SWText variant="label" numberOfLines={1}>
            {listing.title}
          </SWText>
          <SWText variant="caption" tone="textMuted">
            Asking {formatPeso(listing.askingPrice)}
          </SWText>
        </View>
        <ChevronRight size={16} strokeWidth={2} color={colors.textMuted} />
      </PressableScale>
      <View style={styles.rowFoot}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Alert under ${formatPeso(alert.alertBelow)}. Change the price`}
          haptic="select"
          onPress={onEdit}
          style={styles.target}
        >
          <SWText variant="labelSmall" tone={alert.on ? 'textPrimary' : 'textMuted'}>
            Under {formatPeso(alert.alertBelow)}
          </SWText>
          <Pencil size={13} strokeWidth={2.2} color={colors.textMuted} />
        </PressableScale>
        <Toggle
          value={alert.on}
          onValueChange={onToggle}
          accessibilityLabel={`Alert for ${listing.title}`}
        />
      </View>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[4],
  },
  footnote: {
    paddingHorizontal: tokens.spacing[1],
  },
  row: {
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    gap: tokens.spacing[2],
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  thumb: {
    width: 52,
    height: 52,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 52 + tokens.spacing[3],
  },
  target: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1],
    borderRadius: tokens.radius.full,
    backgroundColor: colors.sunken,
  },
  sheet: {
    gap: tokens.spacing[4],
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
}));
