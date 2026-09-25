import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens, useTheme } from '../design';

const liquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

export interface GlassSurfaceProps {
  readonly children?: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  /** `clear` is for chrome floating over photos; `regular` everywhere else. */
  readonly variant?: 'regular' | 'clear';
  /** Liquid Glass reacts to touch (it bends and brightens) when the surface is a control. */
  readonly interactive?: boolean;
  /** A faint tint, e.g. the accent for the companion's panel. */
  readonly tint?: string;
}

/**
 * The one material for floating chrome: headers, bottom bars, the companion, sheets. On iOS 26
 * it is the system's Liquid Glass; elsewhere it falls back to a blur material with a hairline
 * edge and a top highlight, so the layer still reads as glass rather than a flat panel.
 */
export function GlassSurface({
  children,
  style,
  variant = 'regular',
  interactive = false,
  tint,
}: GlassSurfaceProps) {
  const { name, isDark } = useTheme();

  if (liquidGlass) {
    return (
      <GlassView
        glassEffectStyle={variant}
        isInteractive={interactive}
        tintColor={tint}
        colorScheme={name}
        style={style}
      >
        {children}
      </GlassView>
    );
  }

  const glass = tokens.glass[name];
  return (
    <View style={[styles.frame, { borderColor: glass.border }, style]}>
      <BlurView
        intensity={variant === 'clear' ? 30 : 60}
        tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        blurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint ?? glass.fill }]} />
      <View style={[styles.highlight, { backgroundColor: glass.highlight }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    pointerEvents: 'none',
  },
});
