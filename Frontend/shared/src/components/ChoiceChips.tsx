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

import { haptic, themedStyles, tokens, useThemedStyles } from '../design';
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
}: ChoiceChipsProps<Key>) {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
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
        // Until the pill has measured its target, the chip paints its own fill.
        solid={option.key === value && !placed}
        onPress={() => {
          if (option.key !== value) haptic('select');
          onChange(option.key);
        }}
      />
    </Animated.View>
  ));

  const indicator = (
    <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
  );

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollRow}
        style={styles.bleed}
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
  solid,
  onPress,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly solid: boolean;
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
        active ? styles.activeChip : null,
        solid ? styles.solid : null,
        pressed && !active ? styles.pressed : null,
      ]}
    >
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
    </PressableScale>
  );
}

const stylesFor = themedStyles((colors) => ({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
  },
  bleed: {
    marginHorizontal: -tokens.layout.pageGutterCompact,
    flexGrow: 0,
  },
  scrollRow: {
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.layout.pageGutterCompact,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.inverse,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  activeChip: {
    borderColor: 'transparent',
  },
  solid: {
    backgroundColor: colors.inverse,
    borderColor: colors.inverse,
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
