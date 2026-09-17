export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }

  return value as DeepReadonly<T>;
}

const duration = {
  immediate: 0,
  fast: 140,
  reducedCrossFade: 140,
  exit: 160,
  base: 200,
  sharedElement: 240,
  dataShift: 200,
  artisticAccent: 260,
  reveal: 420,
  estimateWaitCycle: 1600,
  estimateWaitRest: 400,
  estimateProgressDelay: 2000,
  estimateOutcomeDeadline: 10000,
} as const;

const easing = {
  direct: 'cubic-bezier(0.2, 0, 0.2, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  linear: 'linear',
} as const;

export const tokens = deepFreeze({
  color: {
    light: {
      canvas: '#FAFAF7',
      surface: '#FFFFFF',
      sunken: '#F1F1EC',
      borderSubtle: '#E4E4DC',
      borderStrong: '#C9C9BF',
      textPrimary: '#0B0B0F',
      textSecondary: '#4A4A57',
      textMuted: '#6E6E7C',
      accent: '#D7FF3E',
      accentPressed: '#B4E01F',
      onAccent: '#0B0B0F',
      estimateSurface: '#F3F8DE',
      estimateBorder: '#BFD97F',
      voteHigh: '#D6452B',
      voteLow: '#2F6FE0',
      voteRight: '#1E8E56',
      danger: '#C4292E',
      warning: '#9A6400',
      focusRing: '#0B0B0F',
      interactiveBoundary: '#0B0B0F',
    },
    dark: {
      canvas: '#0B0B0F',
      surface: '#15151C',
      sunken: '#0B0B0F',
      borderSubtle: '#24242C',
      borderStrong: '#3A3A46',
      textPrimary: '#F5F5F0',
      textSecondary: '#A8A8B5',
      textMuted: '#8A8A99',
      accent: '#D7FF3E',
      accentPressed: '#B4E01F',
      onAccent: '#0B0B0F',
      estimateSurface: '#1B2110',
      estimateBorder: '#43521C',
      voteHigh: '#FF7A5A',
      voteLow: '#6FA3FF',
      voteRight: '#48C98A',
      danger: '#FF6B6F',
      warning: '#FFC155',
      focusRing: '#D7FF3E',
      interactiveBoundary: '#F5F5F0',
    },
  },
  typography: {
    family: {
      displayMedium: 'SpaceGrotesk_500Medium',
      displayBold: 'SpaceGrotesk_700Bold',
      bodyRegular: 'Inter_400Regular',
      bodyMedium: 'Inter_500Medium',
      bodySemibold: 'Inter_600SemiBold',
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    style: {
      priceHero: { family: 'SpaceGrotesk_700Bold', size: 48, lineHeight: 52, weight: '700' },
      priceLarge: { family: 'SpaceGrotesk_700Bold', size: 32, lineHeight: 36, weight: '700' },
      priceMedium: { family: 'SpaceGrotesk_500Medium', size: 22, lineHeight: 26, weight: '500' },
      headingLarge: { family: 'SpaceGrotesk_500Medium', size: 22, lineHeight: 28, weight: '500' },
      headingMedium: { family: 'SpaceGrotesk_500Medium', size: 17, lineHeight: 24, weight: '500' },
      bodyLarge: { family: 'Inter_400Regular', size: 16, lineHeight: 24, weight: '400' },
      bodyMedium: { family: 'Inter_400Regular', size: 15, lineHeight: 22, weight: '400' },
      labelMedium: { family: 'Inter_500Medium', size: 13, lineHeight: 18, weight: '500' },
      caption: { family: 'Inter_400Regular', size: 12, lineHeight: 16, weight: '400' },
      overline: {
        family: 'Inter_600SemiBold',
        size: 11,
        lineHeight: 14,
        weight: '600',
        letterSpacingEm: 0.08,
        textTransform: 'uppercase',
      },
    },
    maxFontSizeMultiplier: {
      priceHero: 1.6,
      default: 2,
    },
    numericFeature: 'tabular-nums',
  },
  spacing: {
    0: 0,
    px: 1,
    '0.5': 2,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },
  radius: {
    none: 0,
    small: 6,
    medium: 12,
    large: 20,
    full: 999,
  },
  border: {
    hairline: 1,
    focus: 2,
    provisionalStyle: 'dashed',
    settledStyle: 'solid',
  },
  elevation: {
    sheet: {
      x: 0,
      y: 8,
      blur: 32,
      spread: 0,
      opacity: 0.16,
    },
  },
  breakpoint: {
    compactMin: 320,
    medium: 768,
    expanded: 1200,
    supportedMax: 1920,
  },
  layout: {
    contentCompact: 720,
    contentMedium: 960,
    contentWide: 1440,
    navigationRailCompact: 72,
    navigationRailExpanded: 240,
    cardMinimum: 280,
    controlMinimum: 44,
    pageGutterCompact: 16,
    pageGutterMedium: 24,
    pageGutterExpanded: 32,
    gridGap: 16,
    sectionGap: 40,
  },
  focus: {
    ringWidth: 2,
    ringOffset: 2,
    minimumTarget: 44,
  },
  artDirection: {
    hierarchy: {
      dominantWeightRatio: 1.6,
      maximumTypeSizesPerCard: 3,
      maximumWeightsPerCard: 2,
    },
    planes: {
      maximum: 3,
      canvas: 0,
      content: 10,
      context: 20,
      sheet: 30,
    },
    crop: {
      card: '4 / 3',
      lead: '5 / 4',
      detail: '1 / 1',
      conversationListing: '16 / 9',
    },
    grid: {
      compactColumns: 1,
      mediumColumns: 2,
      expandedColumns: 3,
      expressiveSpan: 2,
    },
    density: {
      cardPadding: 16,
      cardGroupGap: 12,
      metadataGap: 8,
      valueUnitGap: 4,
    },
  },
  motion: {
    duration,
    easing,
    limits: {
      maximumFocalMotions: 1,
      maximumLocalResponses: 2,
      maximumStaggerItems: 4,
      staggerInterval: 40,
      maximumArtisticDuration: 300,
    },
    recipe: {
      directResponse: {
        durationMs: duration.fast,
        easing: easing.direct,
        properties: ['opacity', 'transform'],
        repeats: false,
      },
      functionalTransition: {
        durationMs: duration.base,
        easing: easing.direct,
        properties: ['opacity', 'transform'],
        repeats: false,
      },
      dismiss: {
        durationMs: duration.exit,
        easing: easing.exit,
        properties: ['opacity', 'transform'],
        repeats: false,
      },
      sharedElement: {
        durationMs: duration.sharedElement,
        easing: easing.enter,
        properties: ['opacity', 'transform'],
        repeats: false,
      },
      dataShift: {
        durationMs: duration.dataShift,
        easing: easing.direct,
        properties: ['opacity', 'layout'],
        repeats: false,
      },
      artisticAccent: {
        durationMs: duration.artisticAccent,
        easing: easing.enter,
        properties: ['opacity', 'transform'],
        repeats: false,
      },
      estimateReveal: {
        durationMs: duration.reveal,
        easing: easing.enter,
        properties: ['opacity', 'transform', 'count-up'],
        repeats: false,
      },
      estimateWait: {
        durationMs: duration.estimateWaitCycle,
        restMs: duration.estimateWaitRest,
        delayMs: duration.estimateProgressDelay,
        easing: easing.linear,
        properties: ['opacity', 'transform'],
        repeats: true,
      },
      reducedCrossFade: {
        durationMs: duration.reducedCrossFade,
        easing: easing.enter,
        properties: ['opacity'],
        repeats: false,
      },
      immediate: {
        durationMs: duration.immediate,
        easing: easing.direct,
        properties: [],
        repeats: false,
      },
    },
  },
} as const);

export type SnapWorthTokens = typeof tokens;
export type ThemeName = keyof SnapWorthTokens['color'];
export type SemanticColorName = keyof SnapWorthTokens['color']['light'];
export type TypographyStyleName = keyof SnapWorthTokens['typography']['style'];
export type MotionRecipeName = keyof SnapWorthTokens['motion']['recipe'];
