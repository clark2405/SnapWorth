import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from '../design';

export type GlassTone = 'neutral' | 'raised' | 'mint' | 'chrome';

export interface GlassCardProps {
  readonly children?: ReactNode;
  readonly tone?: GlassTone;
  /**
   * Blur what sits behind the card. Reserve this for floating chrome (tab bar, sticky bars):
   * backdrop blur is expensive, and cards over the flat ambient background read the same
   * without it.
   */
  readonly blur?: boolean;
  readonly radius?: number;
  readonly padding?: number;
  readonly style?: StyleProp<ViewStyle>;
  /** Layout for the children, e.g. a `gap` between rows. */
  readonly contentStyle?: StyleProp<ViewStyle>;
}

const toneStyles = {
  neutral: { backgroundColor: tokens.glass.fill, borderColor: tokens.glass.border },
  raised: { backgroundColor: tokens.glass.fillRaised, borderColor: tokens.glass.borderStrong },
  mint: { backgroundColor: tokens.glass.mintFill, borderColor: tokens.glass.mintBorder },
  chrome: { backgroundColor: tokens.glass.fillChrome, borderColor: tokens.glass.border },
} as const;

export function GlassCard({
  children,
  tone = 'neutral',
  blur = false,
  radius = tokens.radius.large,
  padding,
  style,
  contentStyle,
}: GlassCardProps) {
  return (
    <View style={[styles.card, toneStyles[tone], { borderRadius: radius }, style]}>
      {blur ? (
        <BlurView
          intensity={tokens.glass.blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={[tokens.glass.highlight, tokens.glass.highlightClear]}
        style={styles.sheen}
      />
      <View style={[padding === undefined ? null : { padding }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: tokens.border.hairline,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '55%',
  },
});
