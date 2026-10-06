import type { ReactNode } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type ViewProps,
} from 'react-native';

import { themedStyles, tokens, useThemedStyles } from '../design';
import { ZoomTarget } from './NavLink';
import { RevealStill } from './Reveal';
import { Photo } from './Photo';

export interface DetailHeroProps {
  readonly source: ImageSourcePropType;
  readonly label: string;
  /** Share of the screen height the photo takes. */
  readonly heightRatio?: number;
  /** Laid over the photo, e.g. a scanning line while an estimate is worked out. */
  readonly children?: ReactNode;
}

/**
 * The top of every item page (a History item, a feed post, a listing): the photo full bleed
 * across the top half, where the zoom from the tapped card lands. A `DetailSheet` rises over
 * its lower edge, so all three open the same way.
 */
export function DetailHero({ source, label, heightRatio = 0.5, children }: DetailHeroProps) {
  const styles = useThemedStyles(stylesFor);
  const { height } = useWindowDimensions();
  return (
    <View style={[styles.hero, { height: Math.round(height * heightRatio) }]}>
      <ZoomTarget>
        <Photo source={source} label={label} radius={0} style={StyleSheet.absoluteFill} />
      </ZoomTarget>
      {children}
    </View>
  );
}

/**
 * The page's body, a rounded sheet that overlaps the bottom of the `DetailHero` photo. The zoom
 * from the tapped card is the page's entrance, so the content arrives in place rather than
 * cascading in on top of it; `reveal` brings the cascade back for a moment that earns it, like a
 * fresh estimate landing.
 */
export function DetailSheet({
  style,
  reveal = false,
  children,
  ...props
}: ViewProps & { readonly reveal?: boolean }) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View {...props} style={[styles.sheet, style]}>
      <RevealStill still={!reveal}>{children}</RevealStill>
    </View>
  );
}

/** Taller than any screen, so the sheet's colour always reaches past the bottom edge. */
const sheetRunout = 1200;

const stylesFor = themedStyles((colors) => ({
  hero: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.sunken,
  },
  // The sheet's colour runs on well past its content (and past any bounce), so it never stops
  // short of the screen's bottom edge and leaves a seam against the backdrop behind the page.
  // Equal padding and negative margin keep the scrollable height unchanged.
  sheet: {
    paddingBottom: sheetRunout,
    marginBottom: -sheetRunout,
    marginTop: -tokens.radius.xlarge,
    borderTopLeftRadius: tokens.radius.xlarge,
    borderTopRightRadius: tokens.radius.xlarge,
    backgroundColor: colors.canvas,
    paddingHorizontal: tokens.layout.pageGutterCompact,
    paddingTop: tokens.spacing[6],
  },
}));
