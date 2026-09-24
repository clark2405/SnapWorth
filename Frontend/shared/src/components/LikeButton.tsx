import { Heart } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { tokens, useMotionPreference } from '../design';
import { PressableScale } from './PressableScale';
import { usePop } from './usePop';

const useNativeDriver = Platform.OS !== 'web';

export interface LikeButtonProps {
  readonly liked: boolean;
  readonly onToggle: () => void;
  readonly likeLabel?: string;
  readonly unlikeLabel?: string;
  /** `bare` matches `IconButton`; `outline` is a control-height square for a bottom bar. */
  readonly appearance?: 'bare' | 'outline';
  readonly size?: number;
}

/**
 * A heart toggle. Liking swells the heart, fills it, and throws a ring and a few sparks outward
 * in one beat; withdrawing the like only dips it, so undoing never feels like a celebration.
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
  const { reduceMotion } = useMotionPreference();
  const { like } = tokens.motion;
  const scale = usePop(liked, { peak: liked ? like.scale : like.unlikeScale });
  const burst = useRef(new Animated.Value(1)).current;
  const wasLiked = useRef(liked);

  useEffect(() => {
    const becameLiked = liked && !wasLiked.current;
    wasLiked.current = liked;
    if (!becameLiked || reduceMotion) return;

    burst.setValue(0);
    Animated.timing(burst, {
      toValue: 1,
      duration: tokens.motion.recipe.artisticAccent.durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [burst, liked, reduceMotion]);

  const color = tokens.color.dark[liked ? 'voteHigh' : 'textPrimary'];
  const fade = burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] });
  const travel = size * like.sparkTravel;

  return (
    <PressableScale
      accessibilityLabel={liked ? unlikeLabel : likeLabel}
      accessibilityState={{ selected: liked }}
      onPress={onToggle}
      hitSlop={appearance === 'bare' ? 4 : undefined}
      style={({ pressed }) => [styles.base, styles[appearance], pressed ? styles.pressed : null]}
    >
      <View style={styles.layer}>
        <View style={styles.center}>
          <Animated.View
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                opacity: fade,
                transform: [
                  {
                    scale: burst.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, like.burstScale],
                    }),
                  },
                ],
              },
            ]}
          />
          {Array.from({ length: like.sparkCount }, (_, index) => {
            const angle = (index / like.sparkCount) * Math.PI * 2 - Math.PI / 2;
            return (
              <Animated.View
                key={index}
                style={[
                  styles.spark,
                  index % 2 === 0 ? styles.sparkWarm : styles.sparkAccent,
                  {
                    opacity: fade,
                    transform: [
                      {
                        translateX: burst.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, Math.cos(angle) * travel],
                        }),
                      },
                      {
                        translateY: burst.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, Math.sin(angle) * travel],
                        }),
                      },
                      { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>
      </View>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Heart size={size} strokeWidth={2} color={color} fill={liked ? color : 'none'} />
      </Animated.View>
    </PressableScale>
  );
}

const sparkSize = tokens.spacing[1];

const styles = StyleSheet.create({
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
    borderRadius: tokens.radius.medium,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.color.dark.borderStrong,
  },
  pressed: {
    backgroundColor: tokens.color.dark.surfaceRaised,
  },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: tokens.border.focus,
    borderColor: tokens.color.dark.voteHigh,
  },
  spark: {
    position: 'absolute',
    width: sparkSize,
    height: sparkSize,
    borderRadius: sparkSize / 2,
  },
  sparkWarm: {
    backgroundColor: tokens.color.dark.voteHigh,
  },
  sparkAccent: {
    backgroundColor: tokens.color.dark.accent,
  },
});
