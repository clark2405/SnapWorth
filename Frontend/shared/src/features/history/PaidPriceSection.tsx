import { TrendingUp } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Sheet, SWText, Tag, TextField } from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import { formatPeso } from '../preview/peso';
import { flipOf, gainLabel, multipleLabel, parsePaid } from './flips';
import { usePaidPrices } from './paid-prices';

/**
 * "What you paid" on an item: the owner notes what it cost them, and the item shows how the flip
 * went against what it's worth now. Only the owner sees it.
 */
export function PaidPriceSection({
  itemId,
  worth,
}: {
  readonly itemId: string;
  /** What it's worth now: the estimate on screen. */
  readonly worth: number;
}) {
  const styles = useThemedStyles(stylesFor);
  const { paid, setPaid } = usePaidPrices();
  const [editing, setEditing] = useState(false);
  const price = paid[itemId];
  const flip = price === undefined ? null : flipOf(price, worth);
  const multiple = flip ? multipleLabel(flip) : null;

  return (
    <View style={styles.section}>
      <SWText variant="headingMedium" accessibilityRole="header">
        What you paid
      </SWText>
      {flip ? (
        <View style={styles.row}>
          <View style={styles.text}>
            <SWText variant="priceSmall">{formatPeso(flip.paid)}</SWText>
            <View style={styles.tags}>
              <Tag
                label={flip.gain === 0 ? 'Even' : `${gainLabel(flip.gain)} flip`}
                tone={flip.gain >= 0 ? 'mint' : 'grave'}
                icon={TrendingUp}
              />
              {multiple ? <Tag label={`${multiple} what you paid`} tone="sand" /> : null}
            </View>
          </View>
          <Button label="Change" variant="tertiary" size="small" onPress={() => setEditing(true)} />
        </View>
      ) : (
        <View style={styles.empty}>
          <SWText variant="bodySmall" tone="textMuted">
            Note what it cost you, from the ukay, a surplus shop or a friend, and see how your flip
            is doing. Only you see this.
          </SWText>
          <Button
            label="Add what you paid"
            variant="secondary"
            size="small"
            onPress={() => setEditing(true)}
          />
        </View>
      )}
      <PaidPriceSheet
        visible={editing}
        current={price}
        worth={worth}
        onClose={() => setEditing(false)}
        onSave={(amount) => {
          setPaid(itemId, amount);
          setEditing(false);
        }}
      />
    </View>
  );
}

function PaidPriceSheet({
  visible,
  current,
  worth,
  onClose,
  onSave,
}: {
  readonly visible: boolean;
  readonly current: number | undefined;
  readonly worth: number;
  readonly onClose: () => void;
  /** The price paid, or `null` to forget it. */
  readonly onSave: (amount: number | null) => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText(current === undefined ? '' : String(current));
  }, [current, visible]);

  const amount = parsePaid(text);
  const flip = amount === null ? null : flipOf(amount, worth);

  return (
    <Sheet visible={visible} onClose={onClose} title="What you paid">
      <TextField
        size="large"
        prefix="₱"
        value={text}
        onChangeText={setText}
        placeholder="0"
        keyboardType="decimal-pad"
        inputMode="decimal"
        accessibilityLabel="What you paid, in pesos"
        autoFocus
      />
      <SWText variant="caption" tone="textMuted">
        {flip
          ? flip.gain === 0
            ? `Worth exactly what you paid: ${formatPeso(worth)}.`
            : flip.gain > 0
              ? `Worth ${formatPeso(flip.gain)} more than you paid, at ${formatPeso(worth)}.`
              : `Worth ${formatPeso(-flip.gain)} less than you paid, at ${formatPeso(worth)}.`
          : text.trim()
            ? 'Type the price in pesos, like 150.'
            : `It's worth about ${formatPeso(worth)} now. Got it free? Put 0.`}
      </SWText>
      <View style={styles.footer}>
        <Button
          label="Save"
          disabled={amount === null}
          haptic="pop"
          onPress={() => onSave(amount)}
        />
        {current === undefined ? null : (
          <Button label="Remove what you paid" variant="tertiary" onPress={() => onSave(null)} />
        )}
      </View>
    </Sheet>
  );
}

const stylesFor = themedStyles(() => ({
  section: {
    gap: tokens.spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  text: {
    flex: 1,
    gap: tokens.spacing[2],
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[1],
  },
  empty: {
    gap: tokens.spacing[3],
    alignItems: 'flex-start',
  },
  footer: {
    gap: tokens.spacing[2],
    marginTop: tokens.spacing[2],
  },
}));
