import { Expand } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';

import { haptic, themedStyles, tokens, useThemedStyles } from '../design';
import { ZoomTarget } from './NavLink';
import { Photo } from './Photo';
import { PhotoViewer, type ItemPhoto } from './PhotoViewer';
import { RevealStill } from './Reveal';

export interface DetailHeroProps {
  /** The item's photos, cover first (up to four). Or pass a single `source` and `label`. */
  readonly photos?: readonly ItemPhoto[];
  readonly source?: ImageSourcePropType;
  readonly label?: string;
  /** Share of the screen height the photo takes. */
  readonly heightRatio?: number;
  /** Laid over the photo, e.g. a scanning line while an estimate is worked out. */
  readonly children?: ReactNode;
}

/**
 * The top of every item page (a History item, a feed post, a listing): the photos full bleed
 * across the top half, where the zoom from the tapped card lands. With more than one, they
 * swipe sideways; tapping one opens it full screen to inspect. A `DetailSheet` rises over the
 * lower edge, so all three open the same way.
 */
export function DetailHero({
  photos,
  source,
  label = '',
  heightRatio = 0.5,
  children,
}: DetailHeroProps) {
  const styles = useThemedStyles(stylesFor);
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const all: readonly ItemPhoto[] = photos?.length ? photos : source ? [{ source, label }] : [];
  const heroHeight = Math.round(height * heightRatio);

  const onPage = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) {
      setPage(next);
      haptic('select');
    }
  };

  const open = (index: number) => {
    haptic('select');
    setViewing(index);
  };

  return (
    <View style={[styles.hero, { height: heroHeight }]}>
      <ZoomTarget>
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={all.length > 1}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPage}
          style={StyleSheet.absoluteFill}
        >
          {all.map((photo, index) => (
            <Pressable
              key={index}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${photo.label}. Opens the photo full screen`}
              accessibilityHint={all.length > 1 ? `Photo ${index + 1} of ${all.length}` : undefined}
              onPress={() => open(index)}
              style={{ width, height: heroHeight }}
            >
              <Photo source={photo.source} label={photo.label} radius={0} style={styles.fill} />
            </Pressable>
          ))}
        </ScrollView>
      </ZoomTarget>
      {children}

      {/* Sits clear of the sheet's rounded edge, which overlaps the bottom of the photo. */}
      <View style={styles.footer} pointerEvents="box-none">
        {all.length > 1 ? (
          <View style={styles.dots} pointerEvents="none">
            {all.map((_, index) => (
              <View key={index} style={[styles.dot, index === page ? styles.dotOn : null]} />
            ))}
          </View>
        ) : (
          <View />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View photo full screen"
          hitSlop={tokens.spacing[2]}
          onPress={() => open(page)}
          style={styles.expand}
        >
          <Expand size={16} strokeWidth={2.2} color={tokens.overlay.text} />
        </Pressable>
      </View>

      <PhotoViewer
        photos={all}
        index={viewing ?? 0}
        visible={viewing !== null}
        onClose={() => setViewing(null)}
      />
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

const dotSize = 6;

/** Taller than any screen, so the sheet's colour always reaches past the bottom edge. */
const sheetRunout = 1200;

const stylesFor = themedStyles((colors) => ({
  hero: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.sunken,
  },
  fill: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    left: tokens.layout.pageGutterCompact,
    right: tokens.layout.pageGutterCompact,
    bottom: tokens.radius.xlarge + tokens.spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: dotSize,
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: dotSize,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.overlay.chrome,
  },
  dot: {
    width: dotSize,
    height: dotSize,
    borderRadius: dotSize / 2,
    backgroundColor: tokens.overlay.border,
  },
  dotOn: {
    backgroundColor: tokens.overlay.text,
  },
  expand: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.overlay.chrome,
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
