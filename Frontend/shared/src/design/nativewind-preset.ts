import type { Config } from 'tailwindcss';

import { nativeWindColorReferences } from './theme';
import { tokens } from './tokens';

const px = (value: number): string => `${value}px`;
const milliseconds = (value: number): string => `${value}ms`;

const colorTheme = {
  canvas: nativeWindColorReferences.canvas,
  surface: {
    DEFAULT: nativeWindColorReferences.surface,
    raised: nativeWindColorReferences.surfaceRaised,
  },
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
        display: [tokens.typography.family.displayBold],
        'display-medium': [tokens.typography.family.displayMedium],
        body: [tokens.typography.family.bodyRegular],
        'body-medium': [tokens.typography.family.bodyMedium],
        'body-semibold': [tokens.typography.family.bodySemibold],
      },
      fontSize: Object.fromEntries(
        Object.entries(typography).map(([name, style]) => [
          name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          [px(style.size), { lineHeight: px(style.lineHeight) }],
        ]),
      ),
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
        entrance: milliseconds(tokens.motion.duration.entrance),
        reduced: milliseconds(tokens.motion.duration.reducedCrossFade),
      },
      transitionTimingFunction: {
        direct: tokens.motion.easing.direct,
        enter: tokens.motion.easing.enter,
        exit: tokens.motion.easing.exit,
        expressive: tokens.motion.easing.expressive,
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
