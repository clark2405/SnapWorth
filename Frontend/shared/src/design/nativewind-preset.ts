import type { Config } from 'tailwindcss';

import { nativeWindColorReferences } from './theme';
import { tokens } from './tokens';

const px = (value: number): string => `${value}px`;
const milliseconds = (value: number): string => `${value}ms`;

const colorTheme = {
  canvas: nativeWindColorReferences.canvas,
  surface: nativeWindColorReferences.surface,
  sunken: nativeWindColorReferences.sunken,
  border: {
    subtle: nativeWindColorReferences.borderSubtle,
    strong: nativeWindColorReferences.borderStrong,
    interactive: nativeWindColorReferences.interactiveBoundary,
  },
  text: {
    primary: nativeWindColorReferences.textPrimary,
    secondary: nativeWindColorReferences.textSecondary,
    muted: nativeWindColorReferences.textMuted,
  },
  accent: {
    DEFAULT: nativeWindColorReferences.accent,
    pressed: nativeWindColorReferences.accentPressed,
    on: nativeWindColorReferences.onAccent,
  },
  estimate: {
    surface: nativeWindColorReferences.estimateSurface,
    border: nativeWindColorReferences.estimateBorder,
  },
  vote: {
    high: nativeWindColorReferences.voteHigh,
    low: nativeWindColorReferences.voteLow,
    right: nativeWindColorReferences.voteRight,
  },
  danger: nativeWindColorReferences.danger,
  warning: nativeWindColorReferences.warning,
  focus: nativeWindColorReferences.focusRing,
};

const typography = tokens.typography.style;

export const snapWorthNativeWindPreset = {
  theme: {
    extend: {
      colors: colorTheme,
      fontFamily: {
        display: [tokens.typography.family.displayMedium],
        'display-bold': [tokens.typography.family.displayBold],
        body: [tokens.typography.family.bodyRegular],
        'body-medium': [tokens.typography.family.bodyMedium],
        'body-semibold': [tokens.typography.family.bodySemibold],
      },
      fontSize: {
        'price-hero': [px(typography.priceHero.size), { lineHeight: px(typography.priceHero.lineHeight) }],
        'price-lg': [px(typography.priceLarge.size), { lineHeight: px(typography.priceLarge.lineHeight) }],
        'price-md': [px(typography.priceMedium.size), { lineHeight: px(typography.priceMedium.lineHeight) }],
        'heading-lg': [px(typography.headingLarge.size), { lineHeight: px(typography.headingLarge.lineHeight) }],
        'heading-md': [px(typography.headingMedium.size), { lineHeight: px(typography.headingMedium.lineHeight) }],
        'body-lg': [px(typography.bodyLarge.size), { lineHeight: px(typography.bodyLarge.lineHeight) }],
        'body-md': [px(typography.bodyMedium.size), { lineHeight: px(typography.bodyMedium.lineHeight) }],
        'label-md': [px(typography.labelMedium.size), { lineHeight: px(typography.labelMedium.lineHeight) }],
        caption: [px(typography.caption.size), { lineHeight: px(typography.caption.lineHeight) }],
        overline: [px(typography.overline.size), { lineHeight: px(typography.overline.lineHeight) }],
      },
      letterSpacing: {
        overline: `${typography.overline.letterSpacingEm}em`,
      },
      spacing: Object.fromEntries(
        Object.entries(tokens.spacing).map(([name, value]) => [name, px(value)]),
      ),
      borderRadius: {
        none: px(tokens.radius.none),
        sm: px(tokens.radius.small),
        md: px(tokens.radius.medium),
        lg: px(tokens.radius.large),
        full: px(tokens.radius.full),
      },
      borderWidth: {
        DEFAULT: px(tokens.border.hairline),
        focus: px(tokens.border.focus),
      },
      minWidth: {
        touch: px(tokens.layout.controlMinimum),
        card: px(tokens.layout.cardMinimum),
      },
      minHeight: {
        touch: px(tokens.layout.controlMinimum),
      },
      maxWidth: {
        compact: px(tokens.layout.contentCompact),
        medium: px(tokens.layout.contentMedium),
        wide: px(tokens.layout.contentWide),
      },
      screens: {
        compact: px(tokens.breakpoint.compactMin),
        medium: px(tokens.breakpoint.medium),
        expanded: px(tokens.breakpoint.expanded),
      },
      aspectRatio: {
        'photo-card': tokens.artDirection.crop.card,
        'photo-lead': tokens.artDirection.crop.lead,
        'photo-detail': tokens.artDirection.crop.detail,
        'photo-conversation': tokens.artDirection.crop.conversationListing,
      },
      zIndex: Object.fromEntries(
        Object.entries(tokens.artDirection.planes).map(([name, value]) => [name, String(value)]),
      ),
      transitionDuration: {
        fast: milliseconds(tokens.motion.duration.fast),
        base: milliseconds(tokens.motion.duration.base),
        exit: milliseconds(tokens.motion.duration.exit),
        shared: milliseconds(tokens.motion.duration.sharedElement),
        data: milliseconds(tokens.motion.duration.dataShift),
        accent: milliseconds(tokens.motion.duration.artisticAccent),
        reveal: milliseconds(tokens.motion.duration.reveal),
        reduced: milliseconds(tokens.motion.duration.reducedCrossFade),
      },
      transitionTimingFunction: {
        direct: tokens.motion.easing.direct,
        enter: tokens.motion.easing.enter,
        exit: tokens.motion.easing.exit,
      },
      boxShadow: {
        sheet: `${px(tokens.elevation.sheet.x)} ${px(tokens.elevation.sheet.y)} ${px(
          tokens.elevation.sheet.blur,
        )} ${px(tokens.elevation.sheet.spread)} rgb(0 0 0 / ${tokens.elevation.sheet.opacity})`,
      },
    },
  },
} satisfies Partial<Config>;

export default snapWorthNativeWindPreset;
