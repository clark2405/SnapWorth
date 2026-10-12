import { Ban, Flag, HandCoins, MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  ChoiceChips,
  ListRow,
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
  previewMeetupSpots,
  previewMeetupTimes,
  previewReportReasons,
} from '../preview/sample-data';

/** The composer's plus: the two things a chat about an item needs beyond words. */
export function ChatActionsSheet({
  visible,
  askingPrice,
  onClose,
  onOffer,
  onMeetup,
}: {
  readonly visible: boolean;
  readonly askingPrice: number;
  readonly onClose: () => void;
  readonly onOffer: () => void;
  readonly onMeetup: () => void;
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
          detail="A public place and a time"
          icon={MapPin}
          onPress={onMeetup}
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

/** Where and when to hand the item over. Suggestions are public places only. */
export function MeetupSheet({
  visible,
  onClose,
  onSend,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSend: (meetup: { readonly place: string; readonly when: string }) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [spot, setSpot] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSpot(null);
    setDay(null);
    setTime(null);
  }, [visible]);

  const label = (options: typeof previewMeetupSpots, key: string | null) =>
    options.find((option) => option.key === key)?.label ?? '';
  const ready = spot !== null && day !== null && time !== null;

  return (
    <Sheet visible={visible} onClose={onClose} title="Arrange pickup">
      <View style={styles.group}>
        <SWText variant="overline" tone="textMuted">
          Where
        </SWText>
        <ChoiceChips options={previewMeetupSpots} value={spot} onChange={setSpot} />
      </View>
      <View style={styles.group}>
        <SWText variant="overline" tone="textMuted">
          When
        </SWText>
        <ChoiceChips options={previewMeetupDays} value={day} onChange={setDay} />
        <ChoiceChips options={previewMeetupTimes} value={time} onChange={setTime} />
      </View>
      <SWText variant="caption" tone="textMuted">
        Meet somewhere public, and check the item before you pay.
      </SWText>
      <View style={styles.footer}>
        <Button
          label="Send proposal"
          disabled={!ready}
          haptic="pop"
          onPress={() =>
            onSend({
              place: label(previewMeetupSpots, spot),
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
