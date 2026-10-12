import { Platform, type ViewStyle } from 'react-native';

import type { ThemeColors } from './theme';

/** The four places a tab opens on. Each has its own colour (see `placeFeed` and the rest). */
export type Place = 'feed' | 'market' | 'history' | 'chat';

export interface PlaceColors {
  /** The block the place opens on. */
  readonly fill: string;
  /** Type and marks set on the block. */
  readonly ink: string;
  /** The wordmark's lens on the block: the one colour that pops against it. */
  readonly lens: string;
  /** Whether the block is dark enough to want light status-bar text over it. */
  readonly dark: boolean;
}

export function placeColors(colors: ThemeColors, place: Place): PlaceColors {
  switch (place) {
    case 'feed':
      return { fill: colors.placeFeed, ink: colors.onPlaceFeed, lens: colors.marigold, dark: true };
    case 'market':
      return {
        fill: colors.placeMarket,
        ink: colors.onPlaceMarket,
        lens: colors.accent,
        dark: false,
      };
    case 'history':
      return {
        fill: colors.placeHistory,
        ink: colors.onPlaceHistory,
        lens: colors.marigold,
        dark: true,
      };
    case 'chat':
      return { fill: colors.placeChat, ink: colors.onPlaceChat, lens: colors.marigold, dark: true };
  }
}

/**
 * The look of anything you can hold: cards, photos, chips and tags get an ink outline and a hard
 * shadow offset down and to the right, as if cut from card and laid on the page. `depth` is how
 * far the shadow sits out; 0 leaves just the outline.
 */
export function held(colors: ThemeColors, depth = 3): ViewStyle {
  const edge = { borderWidth: 2, borderColor: colors.heldEdge };
  if (depth <= 0) return edge;
  // iOS and the web (which maps these to box-shadow) draw the hard shadow from the classic
  // shadow props; Android's elevation can't draw a hard offset shadow, so it takes `boxShadow`.
  return Platform.OS === 'android'
    ? { ...edge, boxShadow: `${depth}px ${depth}px 0px ${colors.heldShadow}` }
    : {
        ...edge,
        shadowColor: colors.heldShadow,
        shadowOffset: { width: depth, height: depth },
        shadowOpacity: 1,
        shadowRadius: 0,
      };
}
