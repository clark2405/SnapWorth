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

import { themedStyles, tokens, useThemedStyles } from '../design';
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
}

const confidenceCopy: Record<EstimateConfidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence — add another photo',
};

/**
 * Where the value probably sits, not just one number. The band draws out from its centre, then
 * the estimate marker drops onto it on a spring. Confidence is spelled out in words, and the
 * band's weight follows it: a tight, solid band for high confidence, a lighter one for low.
 */
export function PriceRangeBar({
  low,
  high,
  estimate,
  confidence,
  format,
  asking,
  showConfidence = true,
}: PriceRangeBarProps) {
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const band = useSharedValue(reduceMotion ? 1 : 0);
  const marker = useSharedValue(reduceMotion ? 1 : 0);

  // The track shows 15% either side of the range so the band never touches the ends.
  const span = high - low || 1;
  const min = low - span * 0.35;
  const max = high + span * 0.35;
  const at = (value: number) => ((value - min) / (max - min)) * width;

  useEffect(() => {
    if (reduceMotion || width === 0) return;
    band.value = withTiming(1, { duration: 560, easing: Easing.bezier(0.16, 1, 0.3, 1) });
    marker.value = withDelay(260, withSpring(1, tokens.motion.spring.playful));
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
        <View style={styles.rail} />
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
                bandStyle,
              ]}
            />
            {asking !== undefined ? (
              <View
                style={[styles.asking, { left: Math.min(width - 2, Math.max(0, at(asking))) }]}
              />
            ) : null}
            <Animated.View style={[styles.marker, { left: at(estimate) - 9 }, markerStyle]} />
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

const stylesFor = themedStyles((colors) => ({
  root: {
    gap: tokens.spacing[2],
  },
  track: {
    height: 18,
    justifyContent: 'center',
  },
  rail: {
    height: 4,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.sunken,
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
  band: {
    position: 'absolute',
    height: 4,
    borderRadius: tokens.radius.full,
  },
  bandStrong: { backgroundColor: colors.textPrimary },
  bandMedium: { backgroundColor: colors.textPrimary, opacity: 0.6 },
  bandWeak: { backgroundColor: colors.estimateBorder },
  asking: {
    position: 'absolute',
    width: 2,
    height: 18,
    borderRadius: 1,
    backgroundColor: colors.textPrimary,
  },
  marker: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.textPrimary,
    borderWidth: 5,
    borderColor: colors.surface,
  },
}));
