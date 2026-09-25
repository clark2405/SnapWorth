import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { haptic, themedStyles, tokens, useThemedStyles } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

const inset = 3;

export interface SegmentedControlProps<Key extends string> {
  readonly options: readonly { readonly key: Key; readonly label: string }[];
  readonly value: Key;
  readonly onChange: (key: Key) => void;
}

/**
 * The active segment is one raised pill that glides to the chosen option on a spring, so the
 * change reads as a single object moving. Each change ticks with a selection haptic.
 */
export function SegmentedControl<Key extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<Key>) {
  const reduceMotion = useReducedMotion();
  const styles = useThemedStyles(stylesFor);
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useSharedValue(0);
  const placed = useSharedValue(false);

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  );
  const segmentWidth = trackWidth > 0 ? (trackWidth - inset * 2) / options.length : 0;

  useEffect(() => {
    if (segmentWidth === 0) return;
    const target = activeIndex * segmentWidth;
    if (!placed.value || reduceMotion) {
      placed.value = true;
      offset.value = target;
      return;
    }
    offset.value = withSpring(target, tokens.motion.spring.snappy);
  }, [activeIndex, offset, placed, reduceMotion, segmentWidth]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <View
      accessibilityRole="tablist"
      style={styles.track}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? (
        <Animated.View style={[styles.pill, { width: segmentWidth }, pillStyle]} />
      ) : null}
      {options.map((option) => {
        const active = option.key === value;
        return (
          <PressableScale
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            haptic="none"
            onPress={() => {
              if (!active) haptic('select');
              onChange(option.key);
            }}
            containerStyle={styles.slot}
            style={[styles.segment, active && segmentWidth === 0 ? styles.pillStatic : null]}
          >
            <SWText variant="labelSmall" tone={active ? 'textPrimary' : 'textMuted'}>
              {option.label}
            </SWText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const stylesFor = themedStyles((colors, name) => ({
  track: {
    flexDirection: 'row',
    padding: inset,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.sunken,
  },
  slot: {
    flex: 1,
  },
  pill: {
    position: 'absolute',
    top: inset,
    bottom: inset,
    left: inset,
    borderRadius: tokens.radius.full,
    backgroundColor: name === 'dark' ? colors.borderStrong : colors.surface,
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    pointerEvents: 'none',
  },
  pillStatic: {
    backgroundColor: name === 'dark' ? colors.borderStrong : colors.surface,
  },
  segment: {
    minHeight: 36,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
