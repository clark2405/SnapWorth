import { useEffect, useState } from 'react';
import { View, type ImageSourcePropType } from 'react-native';

import { SWText, Toggle } from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import { formatPeso } from '../preview/peso';
import { flipOf } from './flips';
import { usePaidPrices } from './paid-prices';
import { SharePictureSheet } from './SharePictureSheet';
import { ShareTagCard } from './ShareTagCard';

export interface ShareableItem {
  readonly id: string;
  readonly title: string;
  readonly photo: ImageSourcePropType;
  readonly photoLabel: string;
  readonly worth: number;
  readonly verdict?: string;
}

/**
 * Shows the item's tag as the picture that will be shared, then shares it. What the owner paid
 * stays off the picture unless they switch it on.
 */
export function ShareTagSheet({
  item,
  onClose,
}: {
  /** The item to share; the sheet shows while there is one. */
  readonly item: ShareableItem | null;
  readonly onClose: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { paid } = usePaidPrices();
  const [showPaid, setShowPaid] = useState(false);
  // The sheet keeps the last item while it slides away.
  const [shown, setShown] = useState<ShareableItem | null>(item);

  useEffect(() => {
    if (!item) return;
    setShown(item);
    setShowPaid(false);
  }, [item]);

  const price = shown ? paid[shown.id] : undefined;
  const flip = shown && price !== undefined ? flipOf(price, shown.worth) : null;

  return (
    <SharePictureSheet
      visible={item !== null}
      onClose={onClose}
      title="Share your tag"
      fallbackText={
        shown ? `${shown.title}: worth about ${formatPeso(shown.worth)} on SnapWorth.` : ''
      }
      renderCard={(ref) =>
        shown ? (
          <ShareTagCard
            ref={ref}
            title={shown.title}
            photo={shown.photo}
            photoLabel={shown.photoLabel}
            worth={shown.worth}
            verdict={shown.verdict}
            flip={showPaid ? flip : null}
          />
        ) : null
      }
    >
      {flip ? (
        <View style={styles.option}>
          <View style={styles.optionText}>
            <SWText variant="label">Show what I paid</SWText>
            <SWText variant="caption" tone="textMuted">
              {`Adds “Paid ${formatPeso(flip.paid)}” to the picture.`}
            </SWText>
          </View>
          <Toggle
            value={showPaid}
            onValueChange={setShowPaid}
            accessibilityLabel="Show what I paid on the picture"
          />
        </View>
      ) : null}
    </SharePictureSheet>
  );
}

const stylesFor = themedStyles(() => ({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
}));
