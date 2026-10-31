import { forwardRef } from 'react';
import { View, type ImageSourcePropType, type ViewStyle } from 'react-native';

import { AiFoil, Photo, SWText, TagShape, Wordmark } from '../../components';
import {
  held,
  PrintedTheme,
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type ThemeColors,
} from '../../design';
import { formatPeso } from '../preview/peso';
import { gainLabel, type Flip } from './flips';

export interface ShareTagCardProps {
  readonly title: string;
  readonly photo: ImageSourcePropType;
  readonly photoLabel: string;
  /** The AI's estimate. */
  readonly worth: number;
  /** The community's verdict, when the item was put to the feed, e.g. "Priced right". */
  readonly verdict?: string;
  /** Shown only when the owner chooses to share what they paid. */
  readonly flip?: Flip | null;
}

/** The card's size on screen; it's saved at three times this, 1080 by 1350, Instagram's 4:5. */
export const shareCardSize = { width: 360, height: 450 } as const;

/**
 * An item's price tag as a picture to post: the photo on held paper, the AI's estimate hanging
 * from it on the manila tag with its foil, and the app's name, so every share says where it came
 * from. Always printed in the light palette, so it looks the same from anyone's phone.
 */
export const ShareTagCard = forwardRef<View, ShareTagCardProps>(function ShareTagCard(props, ref) {
  return (
    <PrintedTheme>
      <CardFace ref={ref} {...props} />
    </PrintedTheme>
  );
});

const CardFace = forwardRef<View, ShareTagCardProps>(function CardFace(
  { title, photo, photoLabel, worth, verdict, flip },
  ref,
) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const paint = paintFor(colors);
  return (
    // Not collapsed away on Android, so it can be photographed as one view.
    <View ref={ref} collapsable={false} style={[styles.card, paint.card]}>
      <Wordmark height={22} ink={colors.onPlaceHistory} />
      <View style={styles.stage}>
        <View style={[styles.print, paint.print]}>
          <Photo source={photo} label={photoLabel} aspectRatio={1} radius={tokens.radius.small} />
          {verdict ? (
            <View style={[styles.verdict, paint.verdict]}>
              <SWText variant="label" color={colors.onMarigold}>
                {verdict}
              </SWText>
            </View>
          ) : null}
        </View>
        <TagShape hanging tilt={tokens.tilt.start} style={styles.tag}>
          <View style={styles.tagTop}>
            <SWText variant="stamp" color={colors.kraftInk}>
              AI Estimate
            </SWText>
            <AiFoil size="small" />
          </View>
          <SWText variant="priceLarge" color={colors.kraftInk}>
            {formatPeso(worth)}
          </SWText>
        </TagShape>
      </View>
      <View style={styles.footer}>
        <SWText variant="headingSmall" color={colors.onPlaceHistory} numberOfLines={2}>
          {title}
        </SWText>
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

/**
 * The card's colours, edges and tilts, as plain styles rather than a style sheet. On the web a
 * style sheet becomes page CSS, which the picture-maker loses when it copies the card; plain
 * styles go on the element itself and come through. Layout stays in the style sheet below.
 */
export function paintFor(colors: ThemeColors) {
  return {
    card: { backgroundColor: colors.placeHistory },
    print: {
      backgroundColor: colors.surface,
      transform: [{ rotate: '-3deg' }],
      ...held(colors, 4),
    },
    verdict: {
      backgroundColor: colors.marigold,
      transform: [{ rotate: '6deg' }],
      ...held(colors, 2),
    },
    gain: { backgroundColor: colors.mint },
    loss: { backgroundColor: colors.grave },
  } satisfies Record<string, ViewStyle>;
}

const stylesFor = themedStyles(() => ({
  card: {
    width: shareCardSize.width,
    height: shareCardSize.height,
    padding: tokens.spacing[5],
    gap: tokens.spacing[4],
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  print: {
    width: 220,
    padding: tokens.spacing[2],
    borderRadius: tokens.radius.medium,
  },
  verdict: {
    position: 'absolute',
    top: -tokens.spacing[3],
    right: -tokens.spacing[4],
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1],
    borderRadius: tokens.radius.small,
  },
  tag: {
    position: 'absolute',
    right: 0,
    bottom: tokens.spacing[2],
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
