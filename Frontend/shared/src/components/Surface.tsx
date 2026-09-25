import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { themedStyles, tokens, useThemedStyles } from '../design';
import { GlassSurface } from './GlassSurface';

export type SurfaceTone = 'surface' | 'raised' | 'sunken' | 'accent';

export interface SurfaceProps {
  readonly children?: ReactNode;
  readonly tone?: SurfaceTone;
  readonly radius?: number;
  readonly padding?: number;
  readonly style?: StyleProp<ViewStyle>;
  /** Layout for the children, e.g. a `gap` between rows. */
  readonly contentStyle?: StyleProp<ViewStyle>;
}

/**
 * A grouped card. In light mode it lifts off the paper on a soft, wide shadow; in dark mode it
 * steps up in value with a hairline edge instead, since shadows vanish on a dark ground.
 */
export function Surface({
  children,
  tone = 'surface',
  radius = tokens.radius.large,
  padding,
  style,
  contentStyle,
}: SurfaceProps) {
  const styles = useThemedStyles(stylesFor);

  return (
    <View style={[styles.card, styles[tone], { borderRadius: radius }, style]}>
      <View
        style={[
          styles.clip,
          { borderRadius: radius },
          padding === undefined ? null : { padding },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** A floating glass bar over the bottom edge: composers and action bars. */
export function BottomBar({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={[styles.bottomWrap, style]}>
      <GlassSurface style={styles.bottomBar}>{children}</GlassSurface>
    </View>
  );
}

export function Divider({ style }: { readonly style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.divider, style]}
    />
  );
}

const stylesFor = themedStyles((colors, name) => ({
  card: {
    borderWidth: name === 'dark' ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.borderSubtle,
    shadowColor: tokens.shadow[name],
    shadowOpacity: name === 'dark' ? 0 : 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: name === 'dark' ? 0 : 2,
  },
  clip: {
    overflow: 'hidden',
  },
  surface: { backgroundColor: colors.surface },
  raised: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
  sunken: {
    backgroundColor: colors.sunken,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 0,
  },
  accent: {
    backgroundColor: colors.estimateSurface,
    borderColor: colors.estimateBorder,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0,
  },
  bottomWrap: {
    paddingHorizontal: tokens.spacing[3],
    paddingBottom: tokens.spacing[2],
  },
  bottomBar: {
    borderRadius: tokens.radius.xlarge,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
    opacity: 0.6,
  },
}));
