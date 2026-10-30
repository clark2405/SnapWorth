import { forwardRef } from 'react';
import { View, type ImageSourcePropType } from 'react-native';

import { AiFoil, Photo, SWText, TagShape, Wordmark } from '../../components';
import { PrintedTheme, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { formatPeso } from '../preview/peso';
import { gainLabel, type FlipTotals } from './flips';
import { paintFor, shareCardSize } from './ShareTagCard';

export interface ShareCollectionCardProps {
  readonly name: string;
  /** Up to four of its photos make the mosaic. */
  readonly photos: readonly { readonly photo: ImageSourcePropType; readonly label: string }[];
  readonly count: number;
  readonly worth: number;
  /** Shown only when the owner chooses to share what they paid. */
  readonly flip?: FlipTotals | null;
}

/**
 * A collection as a picture to post: up to four of its photos on held paper, its name, and what
 * it's all worth on the manila tag. Printed in the light palette, like a single item's tag.
 */
export const ShareCollectionCard = forwardRef<View, ShareCollectionCardProps>(
  function ShareCollectionCard(props, ref) {
    return (
      <PrintedTheme>
        <CardFace ref={ref} {...props} />
      </PrintedTheme>
    );
  },
);

const CardFace = forwardRef<View, ShareCollectionCardProps>(function CardFace(
  { name, photos, count, worth, flip },
  ref,
) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const paint = paintFor(colors);
  const shown = photos.slice(0, 4);

  return (
    // Not collapsed away on Android, so it can be photographed as one view.
    <View ref={ref} collapsable={false} style={[styles.card, paint.card]}>
      <Wordmark height={22} ink={colors.onPlaceHistory} />
      <SWText variant="displayMedium" color={colors.onPlaceHistory} numberOfLines={2}>
        {name}
      </SWText>
      <View style={styles.stage}>
        <View style={[styles.print, paint.print]}>
          <View style={styles.mosaic}>
            {shown.map((entry, index) => (
              <View
                key={index}
                style={
                  shown.length === 1
                    ? styles.whole
                    : shown.length === 2
                      ? styles.half
                      : styles.quarter
                }
              >
                <Photo
                  source={entry.photo}
                  label={entry.label}
                  aspectRatio={shown.length === 2 ? 0.5 : 1}
                  radius={tokens.radius.small}
                />
              </View>
            ))}
          </View>
        </View>
        <TagShape hanging tilt={tokens.tilt.start} style={styles.tag}>
          <View style={styles.tagTop}>
            <SWText variant="stamp" color={colors.kraftInk}>
              {count === 1 ? '1 item' : `${count} items`}
            </SWText>
            <AiFoil size="small" />
          </View>
          <SWText variant="priceLarge" color={colors.kraftInk}>
            {formatPeso(worth)}
          </SWText>
        </TagShape>
      </View>
      <View style={styles.footer}>
        {flip ? (
          <View style={[styles.flip, flip.gain >= 0 ? paint.gain : paint.loss]}>
            <SWText variant="labelSmall" color={flip.gain >= 0 ? colors.mintInk : colors.graveInk}>
              {`Paid ${formatPeso(flip.paid)} · ${gainLabel(flip.gain)}`}
            </SWText>
          </View>
        ) : null}
        <SWText variant="caption" color={colors.onPlaceHistory}>
          Snap it. Know what it&apos;s worth.
        </SWText>
      </View>
    </View>
  );
});

const mosaicGap = tokens.spacing[1];
const printWidth = 200;
const inner = printWidth - tokens.spacing[2] * 2;

const stylesFor = themedStyles(() => ({
  card: {
    width: shareCardSize.width,
    height: shareCardSize.height,
    padding: tokens.spacing[5],
    gap: tokens.spacing[3],
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  print: {
    width: printWidth,
    padding: tokens.spacing[2],
    borderRadius: tokens.radius.medium,
  },
  mosaic: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: mosaicGap,
  },
  whole: {
    width: inner,
  },
  half: {
    width: (inner - mosaicGap) / 2,
  },
  quarter: {
    width: (inner - mosaicGap) / 2,
  },
  tag: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingVertical: tokens.spacing[2],
    // The price's last figure runs a little past its box; keep it on the tag.
    paddingRight: tokens.spacing[6],
  },
  tagTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  footer: {
    gap: tokens.spacing[2],
    alignItems: 'flex-start',
  },
  flip: {
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: 3,
    borderRadius: tokens.radius.full,
  },
}));
