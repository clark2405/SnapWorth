import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { held, themedStyles, tokens, useThemedStyles } from '../design';
import { SWText } from './SWText';

export type EstimateConfidence = 'high' | 'medium' | 'low';

export interface PriceRangeBarProps {
  readonly low: number;
  readonly high: number;
  readonly estimate: number;
  readonly confidence: EstimateConfidence;
  readonly format: (value: number) => string;
  /** Optional asking price to plot against the range, e.g. on a listing. */
  readonly asking?: number;
  /** Hide the confidence label when the screen already states it (e.g. as a chip). */
  readonly showConfidence?: boolean;
  /** Draw the band out and drop the marker in; off where the range is already known. */
  readonly animate?: boolean;
}

const confidenceCopy: Record<EstimateConfidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence — add another photo',
};

/**
 * Where the value probably sits, not just one number, drawn as a shop's price ruler: the fair
 * range is a marigold band along the rule, and the estimate a red pin that drops onto it on a
 * spring. Confidence is spelled out in words, and the band's weight follows it.
 */
export function PriceRangeBar({
  low,
  high,
  estimate,
  confidence,
  format,
  asking,
  showConfidence = true,
  animate = true,
}: PriceRangeBarProps) {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion() || !animate;
  const [width, setWidth] = useState(0);
  const band = useSharedValue(reduceMotion ? 1 : 0);
  const marker = useSharedValue(reduceMotion ? 1 : 0);
  // Once drawn, the band and pin render plainly: the finished state is committed through React,
  // so an animation that fails to reach the screen (on a sheet still sliding in, say) can't
  // leave them hidden.
  const [drawn, setDrawn] = useState(reduceMotion);

  // The track shows 15% either side of the range so the band never touches the ends.
  const span = high - low || 1;
  const min = low - span * 0.35;
  const max = high + span * 0.35;
  const at = (value: number) => ((value - min) / (max - min)) * width;

  useEffect(() => {
    if (reduceMotion || width === 0) return;
    band.value = withTiming(1, { duration: 560, easing: Easing.bezier(0.16, 1, 0.3, 1) });
    marker.value = withDelay(260, withSpring(1, tokens.motion.spring.playful));
    const done = setTimeout(() => setDrawn(true), drawMs);
    return () => clearTimeout(done);
  }, [band, marker, reduceMotion, width]);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: band.value }],
    opacity: 0.4 + band.value * 0.6,
  }));
  const markerStyle = useAnimatedStyle(() => ({
    opacity: marker.value,
    transform: [{ translateY: (1 - marker.value) * -10 }, { scale: 0.6 + marker.value * 0.4 }],
  }));

  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`Likely between ${format(low)} and ${format(high)}. ${confidenceCopy[confidence]}.${asking !== undefined ? ` Asking ${format(asking)}.` : ''}`}
    >
      <View style={styles.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={styles.rail}>
          {/* The rule's ticks, every 12 points along its foot. */}
          {width > 0
            ? Array.from({ length: Math.floor(width / tickGap) }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.tick,
                    index % 5 === 0 ? styles.tickMajor : null,
                    { left: (index + 1) * tickGap },
                  ]}
                />
              ))
            : null}
        </View>
        {width > 0 ? (
          <>
            <Animated.View
              style={[
                styles.band,
                confidence === 'high'
                  ? styles.bandStrong
                  : confidence === 'medium'
                    ? styles.bandMedium
                    : styles.bandWeak,
                { left: at(low), width: at(high) - at(low) },
                drawn ? null : bandStyle,
              ]}
            />
            {asking !== undefined ? (
              <View
                style={[styles.asking, { left: Math.min(width - 2, Math.max(0, at(asking))) }]}
              />
            ) : null}
            <Animated.View
              style={[
                styles.marker,
                { left: at(estimate) - pinWidth / 2 },
                drawn ? null : markerStyle,
              ]}
            />
          </>
        ) : null}
      </View>
      {/* The low and high figures sit centred under the band's ends, so each number labels the
          exact point it describes; they clamp inside the rail at narrow widths. */}
      <View style={styles.ends}>
        {width > 0
          ? [low, high].map((value) => (
              <SWText
                key={value}
                variant="caption"
                tone="textMuted"
                align="center"
                numberOfLines={1}
                style={[
                  styles.end,
                  { left: Math.min(width - endWidth, Math.max(0, at(value) - endWidth / 2)) },
                ]}
              >
                {format(value)}
              </SWText>
            ))
          : null}
      </View>
      {/* A key under the bar, aligned to its edges like the rest of the card: how sure the
          estimate is on the left, and what the asking tick means on the right. */}
      {showConfidence || asking !== undefined ? (
        <View style={styles.legend}>
          {showConfidence ? (
            <SWText
              variant="labelSmall"
              tone={confidence === 'low' ? 'warning' : 'textSecondary'}
              style={styles.legendConfidence}
            >
              {confidenceCopy[confidence]}
            </SWText>
          ) : (
            <View />
          )}
          {asking !== undefined ? (
            <View style={styles.askingKey}>
              <View style={styles.askingSwatch} />
              <SWText variant="labelSmall" tone="textSecondary">
                Asking {format(asking)}
              </SWText>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const endWidth = 76;
/** Comfortably past the band's draw and the pin's spring. */
const drawMs = 1400;
const tickGap = 12;
const pinWidth = 4;
const railHeight = 28;

const stylesFor = themedStyles((colors) => ({
  root: {
    gap: tokens.spacing[2],
  },
  track: {
    height: railHeight + 12,
    justifyContent: 'center',
  },
  rail: {
    height: railHeight,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'visible',
    ...held(colors),
  },
  tick: {
    position: 'absolute',
    bottom: 0,
    width: 1.5,
    height: 6,
    backgroundColor: colors.heldEdge,
  },
  tickMajor: {
    height: 10,
  },
  ends: {
    height: 16,
  },
  end: {
    position: 'absolute',
    top: 0,
    width: endWidth,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  legendConfidence: {
    flexShrink: 1,
  },
  askingKey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1] + 2,
  },
  askingSwatch: {
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: colors.textPrimary,
  },
  // The fair range, painted along the top of the rule.
  band: {
    position: 'absolute',
    top: 10,
    height: 11,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.heldEdge,
  },
  bandStrong: { backgroundColor: colors.marigold },
  bandMedium: { backgroundColor: colors.marigold, opacity: 0.75 },
  bandWeak: { backgroundColor: colors.kraft },
  asking: {
    position: 'absolute',
    width: 2,
    height: railHeight + 8,
    borderRadius: 1,
    backgroundColor: colors.heldEdge,
  },
  // The estimate: a red pin through the rule, standing proud of it top and bottom.
  marker: {
    position: 'absolute',
    width: pinWidth,
    height: railHeight + 12,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
}));
