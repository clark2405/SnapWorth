import { Heart } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { GlassSurface } from './GlassSurface';
import { PressableScale } from './PressableScale';
import { usePop } from './usePop';

export interface LikeButtonProps {
  readonly liked: boolean;
  readonly onToggle: () => void;
  readonly likeLabel?: string;
  readonly unlikeLabel?: string;
  /** `bare` matches `IconButton`; `outline` is a control-height pill; `glass` floats on photos. */
  readonly appearance?: 'bare' | 'outline' | 'glass';
  readonly size?: number;
}

/**
 * A heart toggle. Liking swells the heart, fills it, and throws a ring and sparks outward in one
 * beat with a firm haptic; withdrawing only dips it, so undoing never feels like a celebration.
 * Reduced motion keeps the fill change and drops the movement.
 */
export function LikeButton({
  liked,
  onToggle,
  likeLabel = 'Save',
  unlikeLabel = 'Remove from saved',
  appearance = 'bare',
  size = 22,
}: LikeButtonProps) {
  const { colors, name } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const reduceMotion = useReducedMotion();
  const { like } = tokens.motion;
  const heartPop = usePop(liked, { peak: liked ? like.scale : like.unlikeScale });
  const burst = useSharedValue(1);
  const wasLiked = useRef(liked);

  useEffect(() => {
    const becameLiked = liked && !wasLiked.current;
    wasLiked.current = liked;
    if (!becameLiked || reduceMotion) return;
    burst.value = 0;
    burst.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [burst, liked, reduceMotion]);

  const color = liked ? colors.voteHigh : colors.textPrimary;

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(burst.value, [0, 0.15, 1], [0, 0.9, 0]),
    transform: [{ scale: interpolate(burst.value, [0, 1], [0.4, like.burstScale]) }],
  }));

  const heart = (
    <View style={styles.center}>
      <View style={[StyleSheet.absoluteFill, styles.center, styles.layer]}>
        <Animated.View
          style={[
            styles.ring,
            { width: size, height: size, borderRadius: size / 2, borderColor: colors.voteHigh },
            ringStyle,
          ]}
        />
        {Array.from({ length: like.sparkCount + 2 }, (_, index) => (
          <Spark
            key={index}
            index={index}
            count={like.sparkCount + 2}
            burst={burst}
            travel={size * like.sparkTravel}
            color={index % 2 === 0 ? colors.voteHigh : colors.accent}
          />
        ))}
      </View>
      <Animated.View style={heartPop}>
        <Heart size={size} strokeWidth={2} color={color} fill={liked ? color : 'transparent'} />
      </Animated.View>
    </View>
  );

  return (
    <PressableScale
      accessibilityLabel={liked ? unlikeLabel : likeLabel}
      accessibilityState={{ selected: liked }}
      haptic="none"
      onPress={() => {
        haptic(liked ? 'select' : 'pop');
        onToggle();
      }}
      hitSlop={appearance === 'bare' ? 4 : undefined}
      style={({ pressed }) => [
        styles.base,
        styles[appearance],
        pressed && appearance !== 'glass' ? styles.pressed : null,
      ]}
    >
      {appearance === 'glass' ? (
        <GlassSurface interactive tint={tokens.glass[name].fill} style={styles.glassFill}>
          {heart}
        </GlassSurface>
      ) : (
        heart
      )}
    </PressableScale>
  );
}

function Spark({
  index,
  count,
  burst,
  travel,
  color,
}: {
  readonly index: number;
  readonly count: number;
  readonly burst: SharedValue<number>;
  readonly travel: number;
  readonly color: string;
}) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  const reach = index % 2 === 0 ? travel : travel * 0.72;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(burst.value, [0, 0.1, 0.7, 1], [0, 1, 0.6, 0]),
    transform: [
      { translateX: Math.cos(angle) * reach * burst.value },
      { translateY: Math.sin(angle) * reach * burst.value },
      { scale: interpolate(burst.value, [0, 1], [1.2, 0.2]) },
    ],
  }));
  return <Animated.View style={[sparkStyles.spark, { backgroundColor: color }, style]} />;
}

const sparkSize = 5;
const sparkStyles = StyleSheet.create({
  spark: {
    position: 'absolute',
    width: sparkSize,
    height: sparkSize,
    borderRadius: sparkSize / 2,
  },
});

const stylesFor = themedStyles((colors) => ({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bare: {
    width: tokens.focus.minimumTarget,
    height: tokens.focus.minimumTarget,
    borderRadius: tokens.radius.full,
  },
  outline: {
    width: tokens.layout.controlHeight,
    height: tokens.layout.controlHeight,
    borderRadius: tokens.radius.full,
    backgroundColor: colors.sunken,
  },
  glass: {
    width: tokens.focus.minimumTarget,
    height: tokens.focus.minimumTarget,
  },
  glassFill: {
    width: tokens.focus.minimumTarget,
    height: tokens.focus.minimumTarget,
    borderRadius: tokens.radius.full,
  },
  pressed: {
    backgroundColor: colors.borderSubtle,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    pointerEvents: 'none',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
}));
