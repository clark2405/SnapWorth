import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { tokens, type SemanticColorName, type TypographyStyleName } from '../design';

type TypeStyle = (typeof tokens.typography.style)[TypographyStyleName];

function toTextStyle(style: TypeStyle): TextStyle {
  const letterSpacing =
    'letterSpacingEm' in style
      ? style.letterSpacingEm * style.size
      : 'letterSpacing' in style
        ? style.letterSpacing
        : undefined;

  return {
    fontFamily: style.family,
    fontSize: style.size,
    lineHeight: style.lineHeight,
    letterSpacing,
    textTransform: 'textTransform' in style ? style.textTransform : undefined,
  };
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
  readonly tone?: SemanticColorName;
  readonly align?: TextStyle['textAlign'];
}

export function SWText({
  variant = 'bodyMedium',
  tone = 'textPrimary',
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: SWTextProps) {
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
        { color: tokens.color.dark[tone] },
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
