import { Ban, Eye, Flag, HandCoins, MapPin } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  Button,
  ChoiceChips,
  ListRow,
  SegmentedControl,
  Sheet,
  Surface,
  SWText,
  Tag,
  TextField,
} from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import {
  formatPeso,
  previewMeetupDays,
  previewMeetupTimes,
  previewReportReasons,
} from '../preview/sample-data';
import type { MeetupProposal } from '../../ports/services';
import type { MeetupPurpose } from '../../types/entities';
import { findMeetupSpot, meetupAreas, type MeetupArea } from '../../types/meetup-spots';
import { frameForArea, spotsIn } from './meetup-map-geo';
import { MeetupMap } from './MeetupMap';

/** The composer's plus: what a chat about an item needs beyond words. */
export function ChatActionsSheet({
  visible,
  askingPrice,
  onClose,
  onOffer,
  onMeetup,
  onViewing,
}: {
  readonly visible: boolean;
  readonly askingPrice: number;
  readonly onClose: () => void;
  readonly onOffer: () => void;
  readonly onMeetup: () => void;
  /** Meet so the buyer can see the item in person before deciding. */
  readonly onViewing: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Surface>
        <ListRow
          label="Make an offer"
          detail={`Asking ${formatPeso(askingPrice)}`}
          icon={HandCoins}
          onPress={onOffer}
        />
        <ListRow
          label="Arrange pickup"
          detail="A public place on the map and a time"
          icon={MapPin}
          onPress={onMeetup}
        />
        <ListRow
          label="See it in person"
          detail="Meet in public to look it over first"
          icon={Eye}
          onPress={onViewing}
        />
      </Surface>
    </Sheet>
  );
}

/** A structured offer, with quick amounts below the asking price. */
export function OfferSheet({
  visible,
  askingPrice,
  initialAmount,
  countering,
  onClose,
  onSend,
}: {
  readonly visible: boolean;
  readonly askingPrice: number;
  readonly initialAmount?: number;
  /** True when answering their offer with a different number. */
  readonly countering: boolean;
  readonly onClose: () => void;
  readonly onSend: (amount: number) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText(initialAmount ? String(initialAmount) : '');
  }, [initialAmount, visible]);

  const amount = Number(text.replace(/[,\s]/g, '')) || 0;
  const suggestions = [0.9, 0.95, 1].map((factor) => Math.round((askingPrice * factor) / 50) * 50);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={countering ? 'Counter offer' : 'Make an offer'}
    >
      <ChoiceChips
        options={suggestions.map((value) => ({ key: String(value), label: formatPeso(value) }))}
        value={amount > 0 ? String(amount) : null}
        onChange={setText}
      />
      <TextField
        size="large"
        prefix="₱"
        value={text}
        onChangeText={setText}
        placeholder="Your offer"
        keyboardType="number-pad"
        inputMode="numeric"
        accessibilityLabel="Your offer in pesos"
      />
      <SWText variant="caption" tone="textMuted">
        {amount > 0
          ? amount < askingPrice
            ? `${formatPeso(askingPrice - amount)} under the asking price of ${formatPeso(askingPrice)}.`
            : `At or above the asking price of ${formatPeso(askingPrice)}.`
          : `They're asking ${formatPeso(askingPrice)}.`}
      </SWText>
      <View style={styles.footer}>
        <Button
          label={countering ? 'Send counter' : 'Send offer'}
          disabled={amount <= 0}
          haptic="pop"
          onPress={() => onSend(amount)}
        />
      </View>
    </Sheet>
  );
}

/** Which side of its spots each area's chip sits on the wide map, so no two overlap. */
const clusterSide: Record<MeetupArea, 'start' | 'end' | 'center'> = {
  makati: 'start',
  manila: 'center',
  bgc: 'end',
  ortigas: 'end',
  'quezon-city': 'center',
};

/**
 * Where and when to meet: to hand the item over, or for the buyer to see it in person first.
 * Places are picked on the map from busy public spots only; the chips below it list the same
 * spots, for anyone who'd rather not aim at a pin.
 */
export function MeetupSheet({
  visible,
  purpose: initialPurpose,
  onClose,
  onSend,
}: {
  readonly visible: boolean;
  readonly purpose: MeetupPurpose;
  readonly onClose: () => void;
  readonly onSend: (proposal: MeetupProposal) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { height: screenHeight } = useWindowDimensions();
  const [purpose, setPurpose] = useState<MeetupPurpose>(initialPurpose);
  const [area, setArea] = useState<MeetupArea | 'all'>('all');
  const [spot, setSpot] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  // A shorter map on a short phone, so the whole sheet still fits.
  const aspect = screenHeight < 760 ? 1.9 : 1.45;
  const frame = useMemo(() => frameForArea(area, aspect), [area, aspect]);
  const spots = spotsIn(area);
  // Zoomed out, the spots are too close to tell apart, so each area is one chip to zoom into.
  const clusters = useMemo(
    () =>
      area === 'all'
        ? meetupAreas.map((entry) => {
            const inArea = spotsIn(entry.key);
            return {
              key: entry.key,
              label: entry.label,
              count: inArea.length,
              lat: inArea.reduce((sum, each) => sum + each.lat, 0) / inArea.length,
              lng: inArea.reduce((sum, each) => sum + each.lng, 0) / inArea.length,
              side: clusterSide[entry.key],
            };
          })
        : [],
    [area],
  );
  const pick = (key: string) => {
    setSpot(key);
    const picked = findMeetupSpot(key);
    if (picked && area === 'all') setArea(picked.area);
  };

  useEffect(() => {
    if (!visible) return;
    setPurpose(initialPurpose);
    setArea('all');
    setSpot(null);
    setDay(null);
    setTime(null);
  }, [initialPurpose, visible]);

  const label = (options: typeof previewMeetupDays, key: string | null) =>
    options.find((option) => option.key === key)?.label ?? '';
  const ready = spot !== null && day !== null && time !== null;
  const areaName = meetupAreas.find((entry) => entry.key === area)?.label ?? 'Metro Manila';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={purpose === 'viewing' ? 'See it in person' : 'Arrange pickup'}
    >
      <SegmentedControl
        options={[
          { key: 'pickup', label: 'Pick up' },
          { key: 'viewing', label: 'See it first' },
        ]}
        value={purpose}
        onChange={setPurpose}
      />
      <View style={styles.group}>
        <SWText variant="overline" tone="textMuted">
          Where
        </SWText>
        <ChoiceChips
          options={[{ key: 'all', label: 'All' }, ...meetupAreas]}
          value={area}
          scroll
          onChange={(next) => setArea(next as MeetupArea | 'all')}
        />
        <Animated.View key={area} entering={FadeIn.duration(tokens.motion.duration.base)}>
          <MeetupMap
            frame={frame}
            pins={area === 'all' ? [] : spots}
            clusters={clusters}
            onSelectCluster={(key) => setArea(key as MeetupArea)}
            selectedKey={spot ?? undefined}
            onSelect={pick}
            accessibilityLabel={`Map of ${areaName} with ${spots.length} public meetup spots`}
          />
        </Animated.View>
        <ChoiceChips
          options={spots.map((entry) => ({ key: entry.key, label: entry.name }))}
          value={spot}
          scroll
          onChange={pick}
        />
      </View>
      <View style={styles.group}>
        <SWText variant="overline" tone="textMuted">
          When
        </SWText>
        <ChoiceChips options={previewMeetupDays} value={day} scroll onChange={setDay} />
        <ChoiceChips options={previewMeetupTimes} value={time} scroll onChange={setTime} />
      </View>
      <SWText variant="caption" tone="textMuted">
        {purpose === 'viewing'
          ? 'Only busy public places are on the map. Take your time looking it over.'
          : 'Only busy public places are on the map. Check the item before you pay.'}
      </SWText>
      <View style={styles.footer}>
        <Button
          label="Send proposal"
          disabled={!ready}
          haptic="pop"
          onPress={() =>
            spot &&
            onSend({
              purpose,
              spotKey: spot,
              when: `${label(previewMeetupDays, day)}, ${label(previewMeetupTimes, time)}`,
            })
          }
        />
      </View>
    </Sheet>
  );
}

/** Report the other person, or block them so they can no longer message you. */
export function SafetySheet({
  visible,
  handle,
  reported,
  blocked,
  onClose,
  onReport,
  onBlock,
}: {
  readonly visible: boolean;
  readonly handle: string;
  readonly reported: boolean;
  readonly blocked: boolean;
  readonly onClose: () => void;
  readonly onReport: (reason: string) => void;
  readonly onBlock: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setReason(null);
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title={`@${handle}`}>
      {reported ? (
        <View style={styles.reported}>
          <Tag label="Reported" tone="sand" icon={Flag} />
          <SWText variant="bodySmall" tone="textSecondary">
            Our moderators will review this conversation.
          </SWText>
        </View>
      ) : (
        <View style={styles.group}>
          <SWText variant="overline" tone="textMuted">
            Report
          </SWText>
          <ChoiceChips options={previewReportReasons} value={reason} onChange={setReason} />
          <Button
            label="Send report"
            variant="secondary"
            icon={Flag}
            disabled={reason === null}
            onPress={() => reason && onReport(reason)}
          />
        </View>
      )}
      <Surface>
        <ListRow
          label={blocked ? `Unblock @${handle}` : `Block @${handle}`}
          detail={blocked ? undefined : "They won't be able to message you"}
          icon={Ban}
          destructive={!blocked}
          onPress={onBlock}
        />
      </Surface>
    </Sheet>
  );
}

const stylesFor = themedStyles(() => ({
  group: {
    gap: tokens.spacing[2],
  },
  footer: {
    marginTop: tokens.spacing[2],
  },
  reported: {
    alignItems: 'flex-start',
    gap: tokens.spacing[2],
  },
}));
