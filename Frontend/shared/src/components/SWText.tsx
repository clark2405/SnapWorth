import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import {
  resolveFontFamily,
  tokens,
  useTheme,
  type SemanticColorName,
  type TypographyStyleName,
} from '../design';

type TypeStyle = (typeof tokens.typography.style)[TypographyStyleName];

function toTextStyle(style: TypeStyle): TextStyle {
  const letterSpacing =
    'letterSpacingEm' in style
      ? style.letterSpacingEm * style.size
      : 'letterSpacing' in style
        ? style.letterSpacing
        : undefined;

  return {
    fontFamily: resolveFontFamily(style.family, Platform.OS),
    fontWeight: style.weight as TextStyle['fontWeight'],
    fontSize: style.size,
    lineHeight: style.lineHeight,
    letterSpacing,
    textTransform: 'textTransform' in style ? style.textTransform : undefined,
  };
}

/** Resolved text style for a typography token, for inputs and animated text. */
export function typeStyle(variant: TypographyStyleName): TextStyle {
  return variantStyles[variant];
}

const variantStyles = StyleSheet.create(
  Object.fromEntries(
    Object.entries(tokens.typography.style).map(([name, style]) => [name, toTextStyle(style)]),
  ) as Record<TypographyStyleName, TextStyle>,
);

const monetaryVariants = new Set<TypographyStyleName>([
  'priceHero',
  'priceLarge',
  'priceMedium',
  'priceSmall',
]);

export interface SWTextProps extends TextProps {
  readonly variant?: TypographyStyleName;
  /** A semantic colour from the active theme. */
  readonly tone?: SemanticColorName;
  /** A literal colour for text over photos or the camera, where the theme does not apply. */
  readonly color?: string;
  readonly align?: TextStyle['textAlign'];
}

export function SWText({
  variant = 'bodyMedium',
  tone = 'textPrimary',
  color,
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: SWTextProps) {
  const { colors } = useTheme();

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={
        maxFontSizeMultiplier ??
        (variant === 'priceHero'
          ? tokens.typography.maxFontSizeMultiplier.priceHero
          : tokens.typography.maxFontSizeMultiplier.default)
      }
      style={[
        variantStyles[variant],
        { color: color ?? colors[tone] },
        monetaryVariants.has(variant) ? styles.tabular : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
});
