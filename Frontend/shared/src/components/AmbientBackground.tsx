import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { tokens } from '../design';

const glows = [
  { id: 'ambient-mint', ...tokens.ambient.mint },
  { id: 'ambient-haze', ...tokens.ambient.haze },
  { id: 'ambient-deep', ...tokens.ambient.deep },
] as const;

/**
 * The deep ink canvas with its light sources: a mint glow top-right, a faint indigo haze on
 * the left, and a cool fade bottom-right. Drawn once as static radial gradients, so it costs
 * nothing per frame and never animates.
 */
export const AmbientBackground = memo(function AmbientBackground() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.base]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          {glows.map((glow) => (
            <RadialGradient
              key={glow.id}
              id={glow.id}
              cx={glow.cx * 100}
              cy={glow.cy * 100}
              r={glow.radius * 100}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={glow.color} stopOpacity={glow.opacity} />
              <Stop offset="0.55" stopColor={glow.color} stopOpacity={glow.opacity * 0.35} />
              <Stop offset="1" stopColor={glow.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {glows.map((glow) => (
          <Rect key={glow.id} x="0" y="0" width="100" height="100" fill={`url(#${glow.id})`} />
        ))}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  base: { backgroundColor: tokens.ambient.base },
});
