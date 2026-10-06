import { Archive, Check, CircleX, Clock3, HandCoins, MapPin, Repeat2 } from 'lucide-react-native';
import { View } from 'react-native';

import { Button, SWText, Tag, type TagTone } from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  formatPeso,
  type PreviewMeetup,
  type PreviewOffer,
  type PreviewOfferStatus,
} from '../preview/sample-data';

const offerStatus: Record<
  PreviewOfferStatus,
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
  readonly offer: PreviewOffer;
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
  const gap = askingPrice - offer.amount;
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
      accessibilityLabel={`${mine ? 'Your offer' : 'Offer'} of ${formatPeso(offer.amount)}, ${versusAsking}. ${mine ? status.mine : status.theirs}.`}
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
        {formatPeso(offer.amount)}
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
  mine,
  locked = false,
  onConfirm,
  onSuggestAnother,
}: {
  readonly meetup: PreviewMeetup;
  readonly mine: boolean;
  readonly locked?: boolean;
  readonly onConfirm: () => void;
  readonly onSuggestAnother: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const confirmed = meetup.status === 'confirmed';

  return (
    <View style={styles.card}>
      <View style={styles.meetupRow}>
        <View style={[styles.pin, confirmed ? styles.pinConfirmed : null]}>
          <MapPin size={18} strokeWidth={2} color={confirmed ? colors.mintInk : colors.sandInk} />
        </View>
        <View style={styles.meetupText}>
          <SWText variant="overline" tone="textMuted">
            Pickup
          </SWText>
          <SWText variant="headingSmall">{meetup.place}</SWText>
          <SWText variant="bodySmall" tone="textSecondary">
            {meetup.when}
          </SWText>
        </View>
      </View>
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
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  card: {
    gap: tokens.spacing[1],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.large,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  settled: {
    opacity: 0.7,
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
