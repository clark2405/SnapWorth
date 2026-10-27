import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutRectangle } from 'react-native';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic, held, themedStyles, tokens, useThemedStyles } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export interface ChoiceChipsProps<Key extends string> {
  readonly options: readonly {
    readonly key: Key;
    readonly label: string;
    readonly hint?: string;
  }[];
  readonly value: Key | null;
  readonly onChange: (key: Key) => void;
  /** Scroll sideways instead of wrapping, for long category lists. */
  readonly scroll?: boolean;
  /**
   * How far a scrolling row reaches past its container on each side, so chips can slide out of
   * view at the edge. Defaults to the page gutter, for a row on the page; a row inside a box
   * passes the box's own padding, so it stops at the box's edge.
   */
  readonly bleed?: number;
}

/**
 * A row of pill choices. The selection is one filled pill that glides to the chosen option on a
 * spring and stretches to its width, while the labels cross-fade between ink and paper, so a
 * change reads as a single object moving rather than two styles swapping.
 */
export function ChoiceChips<Key extends string>({
  options,
  value,
  onChange,
  scroll = false,
  bleed = tokens.layout.pageGutterCompact,
}: ChoiceChipsProps<Key>) {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  // The choice at rest. Once a change has finished gliding, the chosen chip paints itself solid
  // ink with plain labels, committed through React: a glide that fails to reach the screen (on
  // a sheet still sliding in, say) can never leave the selection blank.
  const [settledKey, setSettledKey] = useState<Key | null>(value);
  useEffect(() => {
    if (value === settledKey) return;
    setSettledKey(null);
    const done = setTimeout(() => setSettledKey(value), glideMs);
    return () => clearTimeout(done);
  }, [settledKey, value]);
  const [layouts, setLayouts] = useState<Partial<Record<Key, LayoutRectangle>>>({});
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const shown = useSharedValue(0);
  const [placed, setPlaced] = useState(false);

  const target = value === null ? undefined : layouts[value];

  useEffect(() => {
    if (!target) {
      shown.value = withTiming(0, { duration: tokens.motion.duration.fast });
      return;
    }
    if (!placed || reduceMotion) {
      x.value = target.x;
      y.value = target.y;
      width.value = target.width;
      height.value = target.height;
      shown.value = 1;
      setPlaced(true);
      return;
    }
    const spring = tokens.motion.spring.snappy;
    x.value = withSpring(target.x, spring);
    y.value = withSpring(target.y, spring);
    width.value = withSpring(target.width, spring);
    height.value = withSpring(target.height, spring);
    shown.value = withTiming(1, { duration: tokens.motion.duration.fast });
  }, [height, placed, reduceMotion, shown, target, width, x, y]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    width: width.value,
    height: height.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  const chips = options.map((option) => (
    <Animated.View
      key={option.key}
      layout={LinearTransition.springify().damping(20)}
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        setLayouts((current) => {
          const previous = current[option.key];
          if (
            previous &&
            previous.x === next.x &&
            previous.y === next.y &&
            previous.width === next.width
          ) {
            return current;
          }
          return { ...current, [option.key]: next };
        });
      }}
    >
      <Chip
        label={option.label}
        active={option.key === value}
        // Until the layers have measured, the chip paints its own background and fill.
        painted={!placed}
        solid={option.key === settledKey}
        still={settledKey !== null}
        onPress={() => {
          if (option.key !== value) haptic('select');
          onChange(option.key);
        }}
      />
    </Animated.View>
  ));

  // Layers, back to front: each chip's resting pill, the gliding ink pill, then the labels. The
  // resting pills sit beneath the glide so it is visible the whole way across.
  const indicator = (
    <>
      {placed
        ? options.map((option) => {
            const layout = layouts[option.key];
            return layout ? (
              <View
                key={option.key}
                pointerEvents="none"
                style={[
                  styles.base,
                  {
                    width: layout.width,
                    height: layout.height,
                    transform: [{ translateX: layout.x }, { translateY: layout.y }],
                  },
                ]}
              />
            ) : null;
          })
        : null}
      <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
    </>
  );

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollRow, { paddingHorizontal: bleed }]}
        style={[styles.bleed, { marginHorizontal: -bleed }]}
        accessibilityRole="radiogroup"
      >
        {indicator}
        {chips}
      </ScrollView>
    );
  }
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {indicator}
      {chips}
    </View>
  );
}

function Chip({
  label,
  active,
  painted,
  solid,
  still,
  onPress,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly painted: boolean;
  readonly solid: boolean;
  /** No change is gliding, so the labels render plainly. */
  readonly still: boolean;
  readonly onPress: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: tokens.motion.duration.base });
  }, [active, progress]);

  const restLabel = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const activeLabel = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      haptic="none"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        painted ? styles.painted : null,
        solid ? styles.solid : null,
        pressed && !active ? styles.pressed : null,
      ]}
    >
      {still ? (
        <SWText variant="chip" tone={solid ? 'onInverse' : 'textSecondary'}>
          {label}
        </SWText>
      ) : (
        <>
          <Animated.View style={restLabel}>
            <SWText variant="chip" tone="textSecondary">
              {label}
            </SWText>
          </Animated.View>
          <Animated.View style={[styles.activeLabel, activeLabel]}>
            <SWText variant="chip" tone="onInverse">
              {label}
            </SWText>
          </Animated.View>
        </>
      )}
    </PressableScale>
  );
}

const chipShadow = 2;
/** Long enough for the pill's spring to land on the new chip. */
const glideMs = 500;

const stylesFor = themedStyles((colors) => ({
  // Chips sit a full step apart, so each one's hard shadow clears its neighbour.
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[3],
  },
  bleed: {
    flexGrow: 0,
  },
  scrollRow: {
    gap: tokens.spacing[3],
    // Room for the shadows beneath the row, which a scroll view would otherwise clip.
    paddingBottom: chipShadow,
  },
  // The chosen chip is cut the same as the rest, only inked in. Its shadow is the resting chip's
  // beneath it, so the gliding layer carries the outline alone.
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.inverse,
    borderWidth: 2,
    borderColor: colors.heldEdge,
  },
  base: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: tokens.radius.full,
    ...held(colors, chipShadow),
    backgroundColor: colors.surface,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  painted: {
    ...held(colors, chipShadow),
    backgroundColor: colors.surface,
  },
  solid: {
    backgroundColor: colors.inverse,
    borderWidth: 2,
    borderColor: colors.heldEdge,
  },
  pressed: {
    backgroundColor: colors.sunken,
  },
  activeLabel: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
