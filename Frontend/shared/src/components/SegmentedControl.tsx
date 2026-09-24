import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { tokens, useMotionPreference } from '../design';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

const curve = tokens.motion.bezier.expressive;
const expressive = Easing.bezier(curve[0] ?? 0, curve[1] ?? 0, curve[2] ?? 1, curve[3] ?? 1);
const useNativeDriver = Platform.OS !== 'web';
const inset = tokens.spacing[1] + tokens.border.hairline;

export interface SegmentedControlProps<Key extends string> {
  readonly options: readonly { readonly key: Key; readonly label: string }[];
  readonly value: Key;
  readonly onChange: (key: Key) => void;
}

/**
 * The active segment is a single raised pill that slides to the chosen option, so the change
 * reads as one object moving rather than two segments swapping state. Until the track has been
 * measured the active segment draws its own pill, and reduced motion moves it without travel.
 */
export function SegmentedControl<Key extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<Key>) {
  const { reduceMotion } = useMotionPreference();
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  );
  const segmentWidth = trackWidth > 0 ? (trackWidth - inset * 2) / options.length : 0;
  const measured = segmentWidth > 0;

  useEffect(() => {
    if (!measured) return;
    const toValue = activeIndex * segmentWidth;
    if (!placed.current || reduceMotion) {
      placed.current = true;
      offset.setValue(toValue);
      return;
    }
    const animation = Animated.timing(offset, {
      toValue,
      duration: tokens.motion.recipe.functionalTransition.durationMs,
      easing: expressive,
      useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [activeIndex, measured, offset, reduceMotion, segmentWidth]);

  return (
    <View
      accessibilityRole="tablist"
      style={styles.track}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {measured ? (
        <Animated.View
          style={[
            styles.pill,
            styles.active,
            { width: segmentWidth, transform: [{ translateX: offset }] },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.key === value;
        return (
          <PressableScale
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.key)}
            containerStyle={styles.slot}
            style={[styles.segment, active && !measured ? styles.active : null]}
          >
            <SWText
              variant={active ? 'labelSmall' : 'labelMedium'}
              tone={active ? 'textPrimary' : 'textMuted'}
            >
              {option.label}
            </SWText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const segmentRadius = tokens.radius.medium - tokens.spacing[1];

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: tokens.spacing[1],
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderSubtle,
    backgroundColor: tokens.color.dark.sunken,
  },
  slot: {
    flex: 1,
  },
  pill: {
    position: 'absolute',
    pointerEvents: 'none',
    top: tokens.spacing[1],
    bottom: tokens.spacing[1],
    left: tokens.spacing[1],
    borderRadius: segmentRadius,
    borderWidth: tokens.border.hairline,
  },
  segment: {
    minHeight: tokens.layout.inputHeight - tokens.spacing[3],
    borderRadius: segmentRadius,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: tokens.border.hairline,
    borderColor: 'transparent',
  },
  active: {
    backgroundColor: tokens.color.dark.surfaceRaised,
    borderColor: tokens.color.dark.borderStrong,
  },
});
