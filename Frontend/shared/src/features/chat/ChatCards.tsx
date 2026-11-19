import {
  Archive,
  Check,
  CircleX,
  Clock3,
  Eye,
  HandCoins,
  LocateFixed,
  LocateOff,
  MapPin,
  Navigation,
  Repeat2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Button, SWText, Tag, type TagTone } from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import type { ChatMeetup, ChatOffer, OfferStatus } from '../../types/entities';
import type { MessageId } from '../../types/ids';
import { findMeetupSpot } from '../../types/meetup-spots';
import { formatPeso } from '../preview/sample-data';
import { distanceMeters, directionsUrl } from './meetup-map-geo';
import { formatDistance, formatUpdated, useMeetupLocation } from './meetup-location-state';
import { formatClock } from './meetup-time';
import { MeetupMap, type MapPerson } from './MeetupMap';

const offerStatus: Record<
  OfferStatus,
  {
    readonly mine: string;
    readonly theirs: string;
    readonly tone: TagTone;
    readonly icon: typeof Check;
  }
> = {
  pending: { mine: 'Waiting for a reply', theirs: 'Waiting on you', tone: 'sand', icon: Clock3 },
  accepted: { mine: 'Accepted', theirs: 'You accepted', tone: 'mint', icon: Check },
  declined: { mine: 'Declined', theirs: 'You declined', tone: 'grave', icon: CircleX },
  countered: { mine: 'Countered', theirs: 'You countered', tone: 'grave', icon: Repeat2 },
};

/**
 * A price offer, set apart from ordinary messages so the number never gets lost in a thread.
 * An offer waiting on the viewer carries its three answers right on the card.
 */
export function OfferCard({
  offer,
  note,
  mine,
  askingPrice,
  locked = false,
  onAccept,
  onCounter,
  onDecline,
}: {
  readonly offer: ChatOffer;
  readonly note?: string;
  readonly mine: boolean;
  readonly askingPrice: number;
  /** A closed or blocked conversation: an open offer can no longer be answered. */
  readonly locked?: boolean;
  readonly onAccept: () => void;
  readonly onCounter: () => void;
  readonly onDecline: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const expired = locked && offer.status === 'pending';
  const status = expired
    ? { mine: 'No longer open', theirs: 'No longer open', tone: 'grave' as const, icon: Archive }
    : offerStatus[offer.status];
  const gap = askingPrice - offer.amountPhp;
  const versusAsking =
    gap === 0
      ? 'Full asking price'
      : gap > 0
        ? `${formatPeso(gap)} under asking`
        : `${formatPeso(-gap)} over asking`;
  const settled = offer.status === 'countered' || offer.status === 'declined';

  return (
    <View
      style={[styles.card, settled ? styles.settled : null]}
      accessible={mine || offer.status !== 'pending'}
      accessibilityLabel={`${mine ? 'Your offer' : 'Offer'} of ${formatPeso(offer.amountPhp)}, ${versusAsking}. ${mine ? status.mine : status.theirs}.`}
    >
      <View style={styles.cardHead}>
        <HandCoins size={16} strokeWidth={2} color={colors.textMuted} />
        <SWText variant="overline" tone="textMuted">
          {mine ? 'Your offer' : 'Offer'}
        </SWText>
      </View>
      <SWText
        variant="priceMedium"
        style={offer.status === 'countered' ? styles.struck : undefined}
      >
        {formatPeso(offer.amountPhp)}
      </SWText>
      <SWText variant="caption" tone="textSecondary">
        {versusAsking}
      </SWText>
      {note ? (
        <SWText variant="bodySmall" tone="textSecondary">
          {note}
        </SWText>
      ) : null}
      {!mine && offer.status === 'pending' && !locked ? (
        <View style={styles.answers}>
          <Button label="Decline" variant="tertiary" size="small" onPress={onDecline} />
          <Button label="Counter" variant="secondary" size="small" onPress={onCounter} />
          <Button
            label="Accept"
            size="small"
            icon={Check}
            haptic="pop"
            onPress={onAccept}
            containerStyle={styles.accept}
          />
        </View>
      ) : (
        <View style={styles.statusRow}>
          <Tag label={mine ? status.mine : status.theirs} tone={status.tone} icon={status.icon} />
        </View>
      )}
    </View>
  );
}

/** A proposed handoff: a public place and a time, confirmed by the other side. */
export function MeetupCard({
  meetup,
  meetupId,
  otherHandle,
  mine,
  locked = false,
  onConfirm,
  onSuggestAnother,
}: {
  readonly meetup: ChatMeetup;
  /** The meetup's message, for sharing live location once it's agreed. */
  readonly meetupId?: MessageId;
  /** The other person's handle, to say who's sharing. */
  readonly otherHandle?: string;
  readonly mine: boolean;
  readonly locked?: boolean;
  readonly onConfirm: () => void;
  readonly onSuggestAnother: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const confirmed = meetup.status === 'confirmed';
  const location = meetup.location;
  const known = findMeetupSpot(meetup.spotKey);
  const viewing = meetup.purpose === 'viewing';
  // Where they're meeting, for how far each person is from it.
  const spot = location ?? (known ? { lat: known.lat, lng: known.lng } : null);
  // Live location: only for an agreed meetup in a conversation that's still open.
  const canShare = Boolean(meetupId) && confirmed && !locked && spot !== null;
  const live = useMeetupLocation(meetupId ?? ('' as MessageId), canShare);
  const them = otherHandle ? `@${otherHandle}` : 'The other person';
  const people: MapPerson[] = live.positions.map((position) => ({
    key: position.userId,
    lat: position.lat,
    lng: position.lng,
    label: position.mine ? 'You' : them,
    mine: position.mine,
  }));

  return (
    <View style={styles.card}>
      {location ? (
        <MeetupMap
          lat={location.lat}
          lng={location.lng}
          agreed={confirmed}
          people={people}
          accessibilityLabel={`Map showing ${meetup.place}${confirmed ? ', agreed' : ''}${
            live.theirs ? `, and where ${them} is` : ''
          }`}
        />
      ) : null}
      <View style={styles.meetupRow}>
        <View style={[styles.pin, confirmed ? styles.pinConfirmed : null]}>
          {viewing ? (
            <Eye size={18} strokeWidth={2} color={confirmed ? colors.mintInk : colors.sandInk} />
          ) : (
            <MapPin size={18} strokeWidth={2} color={confirmed ? colors.mintInk : colors.sandInk} />
          )}
        </View>
        <View style={styles.meetupText}>
          <SWText variant="overline" tone="textMuted">
            {viewing ? 'See it in person' : 'Pickup'}
          </SWText>
          <SWText variant="headingSmall">{meetup.place}</SWText>
          <SWText variant="bodySmall" tone="textSecondary">
            {known ? `${known.city} · ${meetup.when}` : meetup.when}
          </SWText>
        </View>
      </View>
      {location ? (
        <Button
          label="Directions"
          variant="tertiary"
          size="small"
          icon={Navigation}
          accessibilityHint="Opens the place in your maps app"
          onPress={() =>
            void Linking.openURL(
              directionsUrl(
                { name: meetup.place, lat: location.lat, lng: location.lng },
                Platform.OS === 'ios' ? 'ios' : 'other',
              ),
            )
          }
          containerStyle={styles.directions}
        />
      ) : null}
      {!mine && !confirmed && !locked ? (
        <View style={styles.answers}>
          <Button
            label="Suggest another"
            variant="tertiary"
            size="small"
            onPress={onSuggestAnother}
          />
          <Button
            label="Confirm"
            size="small"
            icon={Check}
            haptic="pop"
            onPress={onConfirm}
            containerStyle={styles.accept}
          />
        </View>
      ) : (
        <View style={styles.statusRow}>
          <Tag
            label={confirmed ? 'Confirmed' : 'Waiting for a reply'}
            tone={confirmed ? 'mint' : 'sand'}
            icon={confirmed ? Check : Clock3}
          />
        </View>
      )}
      {canShare && live.available && spot ? (
        <LiveLocation live={live} spot={spot} them={them} />
      ) : null}
    </View>
  );
}

/**
 * Finding each other at an agreed meetup: who's sharing where, how far from the spot, and the
 * viewer's own sharing, started and stopped here.
 */
function LiveLocation({
  live,
  spot,
  them,
}: {
  readonly live: ReturnType<typeof useMeetupLocation>;
  readonly spot: { readonly lat: number; readonly lng: number };
  readonly them: string;
}) {
  const styles = useThemedStyles(stylesFor);
  const [turnedOff, setTurnedOff] = useState<'denied' | 'unavailable' | null>(null);
  const { theirs, sharing } = live;
  const until = sharing ? new Date(sharing.until) : null;

  return (
    <View style={styles.live}>
      {theirs ? (
        <SWText variant="bodySmall" accessibilityLiveRegion="polite">
          {`${them} is sharing their location · ${formatDistance(
            distanceMeters(theirs, spot),
          )} from the spot · ${formatUpdated(theirs.updatedAt, live.now)}`}
        </SWText>
      ) : (
        <SWText variant="caption" tone="textMuted">
          On your way? Share where you are so you can find each other at the spot.
        </SWText>
      )}
      {until ? (
        <SWText variant="caption" tone="textSecondary">
          {`Sharing your location with ${them} until ${formatClock(until.getHours(), until.getMinutes())}.`}
        </SWText>
      ) : null}
      {turnedOff ? (
        <SWText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {turnedOff === 'denied'
            ? 'Location is off for SnapWorth. Turn it on in Settings to share where you are.'
            : 'Couldn’t find where you are. Check that Location Services are on.'}
        </SWText>
      ) : null}
      {live.problem ? (
        <SWText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {live.problem}
        </SWText>
      ) : null}
      <View style={styles.liveButtons}>
        <Button
          label={sharing ? 'Stop sharing' : 'Share my location'}
          variant={sharing ? 'secondary' : 'primary'}
          size="small"
          icon={sharing ? LocateOff : LocateFixed}
          haptic="select"
          accessibilityHint={
            sharing
              ? `Stops showing ${them} where you are`
              : `Shows ${them} where you are for the next hour, while SnapWorth is open`
          }
          onPress={() => {
            if (sharing) {
              void live.stop();
              return;
            }
            setTurnedOff(null);
            void live.start().then((outcome) => {
              if (outcome !== 'sharing') setTurnedOff(outcome);
            });
          }}
        />
        {theirs ? (
          <Button
            label={`Go to ${them}`}
            variant="tertiary"
            size="small"
            icon={Navigation}
            accessibilityHint={`Opens where ${them} is in your maps app`}
            onPress={() =>
              void Linking.openURL(
                directionsUrl(
                  { name: them, lat: theirs.lat, lng: theirs.lng },
                  Platform.OS === 'ios' ? 'ios' : 'other',
                ),
              )
            }
          />
        ) : null}
      </View>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  live: {
    gap: tokens.spacing[2],
    marginTop: tokens.spacing[3],
    paddingTop: tokens.spacing[3],
    borderTopWidth: tokens.border.hairline,
    borderTopColor: colors.borderSubtle,
  },
  liveButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  // Offer and pickup cards fill their column, so their answer buttons always have room (shrunk to
  // its words, an offer's card squeezed Accept down to its tick).
  card: {
    alignSelf: 'stretch',
    gap: tokens.spacing[1],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.large,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  // A settled offer steps back into the page instead of fading, so it stays readable.
  settled: {
    backgroundColor: colors.sunken,
    borderColor: colors.sunken,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[1],
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  answers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    marginTop: tokens.spacing[3],
  },
  accept: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: tokens.spacing[2],
  },
  meetupRow: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    marginTop: tokens.spacing[2],
  },
  directions: {
    alignSelf: 'flex-start',
    marginTop: tokens.spacing[1],
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sand,
  },
  pinConfirmed: {
    backgroundColor: colors.mint,
  },
  meetupText: {
    flex: 1,
    gap: tokens.spacing['0.5'],
  },
}));
