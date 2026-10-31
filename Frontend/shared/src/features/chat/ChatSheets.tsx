import { Ban, Eye, Flag, HandCoins, HeartHandshake, MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

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
import { findMeetupSpot, homeCity, meetupSpots } from '../../types/meetup-spots';
import { distanceMeters, project, unproject, type Camera } from './meetup-map-geo';
import { MeetupPicker, placingZoom } from './MeetupPicker';
import type { FoundPlace } from './place-search';
import { PlaceSearch } from './PlaceSearch';
import { FullMeetupMap } from './FullMeetupMap';
import { sukiDiscounts } from '../../ports/suki';
import { sukiPrice } from './suki';

/** The composer's plus: what a chat about an item needs beyond words. */
export function ChatActionsSheet({
  visible,
  askingPrice,
  onClose,
  onOffer,
  onMeetup,
  onViewing,
  suki,
}: {
  readonly visible: boolean;
  readonly askingPrice: number;
  readonly onClose: () => void;
  readonly onOffer: () => void;
  readonly onMeetup: () => void;
  /** Meet so the buyer can see the item in person before deciding. */
  readonly onViewing: () => void;
  /** For the seller: their suki discount for this buyer, and a way to change it. */
  readonly suki?: { readonly discountPct: number | null; readonly onOpen: () => void };
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
          detail="A spot on the map and a time"
          icon={MapPin}
          onPress={onMeetup}
        />
        <ListRow
          label="See it in person"
          detail="Meet in public to look it over first"
          icon={Eye}
          onPress={onViewing}
        />
        {suki ? (
          <ListRow
            label={suki.discountPct === null ? 'Make them your suki' : 'Suki discount'}
            detail={
              suki.discountPct === null
                ? 'A standing discount for a regular'
                : `${suki.discountPct}% off everything you sell them`
            }
            icon={HeartHandshake}
            onPress={suki.onOpen}
          />
        ) : null}
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
  sukiPct = null,
  onClose,
  onSend,
}: {
  readonly visible: boolean;
  readonly askingPrice: number;
  readonly initialAmount?: number;
  /** True when answering their offer with a different number. */
  readonly countering: boolean;
  /** The buyer's suki discount with this seller, when they're a suki. */
  readonly sukiPct?: number | null;
  readonly onClose: () => void;
  readonly onSend: (amount: number) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText(initialAmount ? String(initialAmount) : '');
  }, [initialAmount, visible]);

  const amount = Number(text.replace(/[,\s]/g, '')) || 0;
  const suki = sukiPct === null ? null : sukiPrice(askingPrice, sukiPct);
  // A suki's own price comes first; the rest are steps under the asking price.
  const suggestions = [
    ...new Set([
      ...(suki === null ? [] : [suki]),
      ...[0.9, 0.95, 1].map((factor) => Math.round((askingPrice * factor) / 50) * 50),
    ]),
  ];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={countering ? 'Counter offer' : 'Make an offer'}
    >
      <ChoiceChips
        kind="action"
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
          : suki !== null
            ? `Your suki price is ${formatPeso(suki)}, ${sukiPct}% off ${formatPeso(askingPrice)}.`
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

/**
 * The seller sets a standing discount for a regular buyer, their suki. Both of them see it in
 * the chat, and the buyer's offers start from the suki price.
 */
export function SukiSheet({
  visible,
  handle,
  discountPct,
  onClose,
  onSave,
}: {
  readonly visible: boolean;
  readonly handle: string;
  readonly discountPct: number | null;
  readonly onClose: () => void;
  /** The new discount, or `null` to end it. */
  readonly onSave: (discountPct: number | null) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [choice, setChoice] = useState<string>(String(discountPct ?? 10));

  useEffect(() => {
    if (visible) setChoice(String(discountPct ?? 10));
  }, [discountPct, visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title={`@${handle} as your suki`}>
      <SWText variant="bodySmall" tone="textSecondary">
        A suki is a regular. Give them a standing discount on everything you sell them; you’ll both
        see it here, and their offers start from it.
      </SWText>
      <ChoiceChips
        options={sukiDiscounts.map((pct) => ({ key: String(pct), label: `${pct}% off` }))}
        value={choice}
        onChange={setChoice}
      />
      <View style={styles.footer}>
        <Button
          label={discountPct === null ? 'Make them my suki' : 'Save'}
          haptic="pop"
          onPress={() => onSave(Number(choice))}
        />
        {discountPct === null ? null : (
          <Button label="End suki discount" variant="tertiary" onPress={() => onSave(null)} />
        )}
      </View>
    </Sheet>
  );
}

/** Where the map opens: Cebu City, with all its suggested places in view. */
const overview: Camera = { center: project(homeCity.lat, homeCity.lng), zoom: 12.6 };
/** How close a suggestion opens, so its streets are clear. */
const spotZoom = 16.5;
/** Dragged further than this from a suggested place, the pin is no longer that place. */
const leaveSpotMeters = 60;

/**
 * Where and when to meet: to hand the item over, or for the buyer to see it in person first.
 * The pin goes anywhere: drag the map under it and name the spot. Busy public places are
 * suggested as shortcuts, since they're the safest places to meet a stranger.
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
  const [camera, setCamera] = useState<Camera>(overview);
  const [spotKey, setSpotKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  // The map, full screen, for when the sheet's is too small to find the spot.
  const [fullMap, setFullMap] = useState(false);
  // A shorter map on a short phone, so the whole sheet still fits.
  const aspect = screenHeight < 760 ? 2.1 : 1.55;

  useEffect(() => {
    if (!visible) return;
    setPurpose(initialPurpose);
    setCamera(overview);
    setSpotKey(null);
    setName('');
    setDay(null);
    setTime(null);
    setFullMap(false);
  }, [initialPurpose, visible]);

  const moveTo = (next: Camera) => {
    setCamera(next);
    const spot = findMeetupSpot(spotKey ?? undefined);
    if (spot && distanceMeters(spot, unproject(next.center)) > leaveSpotMeters) {
      // The pin has left the suggested place, so it's the person's own spot now.
      setSpotKey(null);
      setName((current) => (current === spot.name ? '' : current));
    }
  };

  const suggest = (key: string) => {
    const spot = findMeetupSpot(key);
    if (!spot) return;
    setSpotKey(spot.key);
    setName(spot.name);
    setCamera({ center: project(spot.lat, spot.lng), zoom: spotZoom });
  };

  // A searched place: a suggested spot keeps its key, anywhere else is the person's own spot.
  const goTo = (place: FoundPlace) => {
    if (place.spotKey) {
      suggest(place.spotKey);
      return;
    }
    setSpotKey(null);
    setName(place.name);
    setCamera({ center: project(place.lat, place.lng), zoom: spotZoom });
  };

  const label = (options: typeof previewMeetupDays, key: string | null) =>
    options.find((option) => option.key === key)?.label ?? '';
  const placed = camera.zoom >= placingZoom;
  const ready = placed && name.trim().length > 0 && day !== null && time !== null;

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
        <PlaceSearch onPick={goTo} />
        <MeetupPicker
          camera={camera}
          onCameraChange={moveTo}
          label={name.trim() || undefined}
          aspect={aspect}
          accessibilityLabel="Map for choosing where to meet"
          onToggleSize={() => setFullMap(true)}
        />
        <FullMeetupMap
          visible={fullMap}
          camera={camera}
          name={name}
          onCameraChange={moveTo}
          onNameChange={setName}
          onPick={goTo}
          onClose={() => setFullMap(false)}
        />
        <ChoiceChips
          options={meetupSpots.map((spot) => ({ key: spot.key, label: spot.name }))}
          label="Suggested place"
          value={spotKey}
          scroll
          onChange={suggest}
        />
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="Name the spot, e.g. Jollibee by the main entrance"
          accessibilityLabel="Name the spot"
          maxLength={120}
          returnKeyType="done"
        />
      </View>
      <View style={styles.group}>
        <SWText variant="overline" tone="textMuted">
          When
        </SWText>
        <ChoiceChips label="Day" options={previewMeetupDays} value={day} scroll onChange={setDay} />
        <ChoiceChips
          label="Time"
          options={previewMeetupTimes}
          value={time}
          scroll
          onChange={setTime}
        />
      </View>
      <SWText variant="caption" tone="textMuted">
        {purpose === 'viewing'
          ? 'Pick somewhere busy and public, and take your time looking it over.'
          : 'Pick somewhere busy and public, and check the item before you pay.'}
      </SWText>
      <View style={styles.footer}>
        <Button
          label="Send proposal"
          disabled={!ready}
          haptic="pop"
          onPress={() => {
            const { lat, lng } = unproject(camera.center);
            onSend({
              purpose,
              spotKey: spotKey ?? undefined,
              location: { lat, lng },
              place: name.trim(),
              when: `${label(previewMeetupDays, day)}, ${label(previewMeetupTimes, time)}`,
            });
          }}
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
          <ChoiceChips
            label="Reason"
            options={previewReportReasons}
            value={reason}
            onChange={setReason}
          />
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
    gap: tokens.spacing[2],
    marginTop: tokens.spacing[2],
  },
  reported: {
    alignItems: 'flex-start',
    gap: tokens.spacing[2],
  },
}));
