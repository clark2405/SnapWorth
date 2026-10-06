import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themedStyles, tokens, useThemedStyles } from '../design';
import { GlassSurface } from './GlassSurface';

export type SurfaceTone = 'surface' | 'raised' | 'sunken' | 'accent' | 'feature';

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
 * A soft, rounded card. In light mode it lifts off the cream page on a warm shadow with no
 * border; in dark mode it steps up in value with a hairline edge, since shadows vanish there.
 * `feature` is the inverted slab a screen may use once, for its hero number.
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

/**
 * A floating glass bar over the bottom edge: composers and action bars. It owns the inner
 * padding, so every bar in the app sits its contents the same distance from the glass edge.
 */
export function BottomBar({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(stylesFor);
  const insets = useSafeAreaInsets();
  // On a phone with rounded screen corners the bar floats as far from the bottom as from the
  // sides, and its corners follow the screen's: concentric, like iOS 26's own floating bars.
  const rounded = insets.bottom > 0;
  return (
    <View style={[styles.bottomWrap, rounded ? styles.bottomWrapRounded : null]}>
      <GlassSurface style={[styles.bottomBar, rounded ? styles.bottomBarRounded : null]}>
        <View style={[styles.bottomContent, style]}>{children}</View>
      </GlassSurface>
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

/** Roughly the display corner radius of Face ID iPhones, which the bottom bar nests inside. */
const screenCornerRadius = 55;
const bottomBarMargin = tokens.spacing[4];

const stylesFor = themedStyles((colors, name) => ({
  card: {
    borderWidth: name === 'dark' ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.borderSubtle,
    shadowColor: tokens.shadow[name],
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: name === 'dark' ? 0 : 2,
  },
  clip: {
    overflow: 'hidden',
  },
  surface: { backgroundColor: colors.surface },
  raised: { backgroundColor: colors.surfaceRaised },
  feature: { backgroundColor: colors.feature, borderWidth: 0 },
  sunken: {
    backgroundColor: colors.sunken,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 0,
  },
  accent: {
    backgroundColor: colors.estimateSurface,
    borderWidth: 0,
    shadowOpacity: 0,
  },
  bottomWrap: {
    paddingHorizontal: tokens.spacing[3],
    paddingBottom: tokens.spacing[3],
  },
  bottomWrapRounded: {
    paddingHorizontal: bottomBarMargin,
    paddingBottom: bottomBarMargin,
  },
  bottomBar: {
    borderRadius: tokens.radius.xlarge,
  },
  bottomBarRounded: {
    borderRadius: screenCornerRadius - bottomBarMargin,
  },
  bottomContent: {
    padding: tokens.spacing[3],
    gap: tokens.spacing[2],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
}));
