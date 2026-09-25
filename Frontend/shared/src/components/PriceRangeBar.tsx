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
      accessibilityLabel={`Likely between ${format(low)} and ${format(high)}. ${confidenceCopy[confidence]}.`}
    >
      <View style={styles.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
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
      <View style={styles.legend}>
        <SWText variant="caption" tone="textMuted">
          {format(low)}
        </SWText>
        <SWText variant="labelSmall" tone={confidence === 'low' ? 'warning' : 'textSecondary'}>
          {confidenceCopy[confidence]}
        </SWText>
        <SWText variant="caption" tone="textMuted">
          {format(high)}
        </SWText>
      </View>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  root: {
    gap: tokens.spacing[3],
  },
  track: {
    height: 18,
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    height: 8,
    borderRadius: tokens.radius.full,
  },
  bandStrong: { backgroundColor: colors.accent },
  bandMedium: { backgroundColor: colors.accent, opacity: 0.7 },
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
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.accent,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}));
