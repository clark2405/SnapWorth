import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from '../design';

export type SurfaceTone = 'surface' | 'raised' | 'sunken';

export interface SurfaceProps {
  readonly children?: ReactNode;
  readonly tone?: SurfaceTone;
  readonly radius?: number;
  readonly padding?: number;
  readonly style?: StyleProp<ViewStyle>;
  /** Layout for the children, e.g. a `gap` between rows. */
  readonly contentStyle?: StyleProp<ViewStyle>;
}

const toneStyles = {
  surface: {
    backgroundColor: tokens.color.dark.surface,
    borderColor: tokens.color.dark.borderSubtle,
  },
  raised: {
    backgroundColor: tokens.color.dark.surfaceRaised,
    borderColor: tokens.color.dark.borderStrong,
  },
  sunken: {
    backgroundColor: tokens.color.dark.sunken,
    borderColor: tokens.color.dark.borderSubtle,
  },
} as const;

/**
 * A grouped well. Depth comes from the surface step and a hairline border, never a shadow or a
 * blur, so the item photo stays the brightest thing on screen.
 */
export function Surface({
  children,
  tone = 'surface',
  radius = tokens.radius.large,
  padding,
  style,
  contentStyle,
}: SurfaceProps) {
  return (
    <View style={[styles.card, toneStyles[tone], { borderRadius: radius }, style]}>
      <View style={[padding === undefined ? null : { padding }, contentStyle]}>{children}</View>
    </View>
  );
}

/** A full-width bar pinned to the bottom edge: composers and action sheets. */
export function BottomBar({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.bottomBar, style]}>{children}</View>;
}

export function Divider({ style }: { readonly style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.divider, style]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: tokens.border.hairline,
  },
  bottomBar: {
    backgroundColor: tokens.color.dark.canvas,
    borderTopWidth: tokens.border.hairline,
    borderTopColor: tokens.color.dark.borderSubtle,
  },
  divider: {
    height: tokens.border.hairline,
    backgroundColor: tokens.color.dark.borderSubtle,
  },
});
