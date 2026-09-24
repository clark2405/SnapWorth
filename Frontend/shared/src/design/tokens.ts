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
  entrance: 300,
  stepTransition: 260,
  popRise: 100,
  popSettle: 180,
  launchMinimumHold: 1100,
  launchEntrance: 520,
  estimateWaitCycle: 1600,
  estimateWaitRest: 400,
  estimateProgressDelay: 2000,
  estimateOutcomeDeadline: 10000,
} as const;

const easing = {
  direct: 'cubic-bezier(0.2, 0, 0.2, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  expressive: 'cubic-bezier(0.16, 1, 0.3, 1)',
  linear: 'linear',
} as const;

const ink = '#0B0B0F';
const lime = '#D7FF3E';

export const tokens = deepFreeze({
  color: {
    dark: {
      canvas: ink,
      surface: '#15151C',
      surfaceRaised: '#1E1E27',
      sunken: ink,
      borderSubtle: '#24242C',
      borderStrong: '#3A3A46',
      textPrimary: '#F5F5F0',
      textSecondary: '#A8A8B5',
      textMuted: '#8A8A99',
      accent: lime,
      accentPressed: '#B4E01F',
      onAccent: ink,
      estimateSurface: '#1B2110',
      estimateBorder: '#6F8A2A',
      voteHigh: '#FF7A5A',
      voteLow: '#6FA3FF',
      voteRight: '#48C98A',
      danger: '#FF6B6F',
      warning: '#FFC155',
      focusRing: lime,
      interactiveBoundary: '#8A8A99',
    },
  },
  /**
   * Translucent layers for controls that sit over live media (the camera viewfinder), where a
   * solid surface would hide what the user is aiming at. Nowhere else.
   */
  overlay: {
    chrome: 'rgba(11, 11, 15, 0.64)',
    border: 'rgba(245, 245, 240, 0.16)',
  },
  typography: {
    family: {
      displayBold: 'SpaceGrotesk_700Bold',
      displayMedium: 'SpaceGrotesk_500Medium',
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
      displayHero: {
        family: 'SpaceGrotesk_700Bold',
        size: 44,
        lineHeight: 46,
        weight: '700',
        letterSpacing: -1.6,
      },
      displayTitle: {
        family: 'SpaceGrotesk_700Bold',
        size: 30,
        lineHeight: 34,
        weight: '700',
        letterSpacing: -0.9,
      },
      priceHero: {
        family: 'SpaceGrotesk_700Bold',
        size: 48,
        lineHeight: 52,
        weight: '700',
        letterSpacing: -1.2,
      },
      priceLarge: {
        family: 'SpaceGrotesk_700Bold',
        size: 32,
        lineHeight: 36,
        weight: '700',
        letterSpacing: -0.6,
      },
      priceMedium: {
        family: 'SpaceGrotesk_500Medium',
        size: 22,
        lineHeight: 26,
        weight: '500',
        letterSpacing: -0.3,
      },
      priceSmall: {
        family: 'SpaceGrotesk_500Medium',
        size: 17,
        lineHeight: 22,
        weight: '500',
        letterSpacing: -0.1,
      },
      headingLarge: {
        family: 'SpaceGrotesk_500Medium',
        size: 22,
        lineHeight: 28,
        weight: '500',
        letterSpacing: -0.3,
      },
      headingMedium: {
        family: 'SpaceGrotesk_500Medium',
        size: 17,
        lineHeight: 24,
        weight: '500',
        letterSpacing: -0.1,
      },
      headingSmall: {
        family: 'SpaceGrotesk_500Medium',
        size: 15,
        lineHeight: 20,
        weight: '500',
        letterSpacing: 0,
      },
      button: { family: 'Inter_600SemiBold', size: 15, lineHeight: 20, weight: '600' },
      bodyLarge: { family: 'Inter_400Regular', size: 16, lineHeight: 24, weight: '400' },
      bodyMedium: { family: 'Inter_400Regular', size: 15, lineHeight: 22, weight: '400' },
      bodySmall: { family: 'Inter_400Regular', size: 14, lineHeight: 20, weight: '400' },
      bodyCompact: { family: 'Inter_400Regular', size: 13, lineHeight: 18, weight: '400' },
      label: { family: 'Inter_500Medium', size: 14, lineHeight: 20, weight: '500' },
      labelSmall: { family: 'Inter_600SemiBold', size: 13, lineHeight: 18, weight: '600' },
      labelMedium: { family: 'Inter_500Medium', size: 13, lineHeight: 18, weight: '500' },
      chip: { family: 'Inter_500Medium', size: 12, lineHeight: 16, weight: '500' },
      tag: {
        family: 'Inter_600SemiBold',
        size: 10,
        lineHeight: 14,
        weight: '600',
        letterSpacingEm: 0.08,
        textTransform: 'uppercase',
      },
      caption: { family: 'Inter_400Regular', size: 12, lineHeight: 16, weight: '400' },
      tabLabel: { family: 'Inter_500Medium', size: 11, lineHeight: 14, weight: '500' },
      overline: {
        family: 'Inter_600SemiBold',
        size: 11,
        lineHeight: 14,
        weight: '600',
        letterSpacingEm: 0.08,
        textTransform: 'uppercase',
      },
      wordmark: {
        family: 'SpaceGrotesk_700Bold',
        size: 17,
        lineHeight: 22,
        weight: '700',
        letterSpacing: -0.4,
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
      opacity: 0.32,
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
    phoneColumn: 480,
    navigationRailCompact: 72,
    navigationRailExpanded: 240,
    cardMinimum: 280,
    controlMinimum: 44,
    controlHeight: 52,
    inputHeight: 48,
    chipHeight: 30,
    pageGutterCompact: 20,
    pageGutterMedium: 24,
    pageGutterExpanded: 32,
    gridGap: 16,
    sectionGap: 40,
    tabBarHeight: 60,
    tabBarCapture: 48,
    headerHeight: 56,
    thumbnail: 72,
    launchMark: 72,
    viewfinderBracket: 20,
    shutter: 76,
    progressSegment: 3,
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
    bezier: {
      expressive: [0.16, 1, 0.3, 1],
      exit: [0.4, 0, 1, 1],
    },
    entrance: {
      offsetY: 8,
    },
    step: {
      offsetX: 24,
    },
    press: {
      scale: 0.96,
      /** Back-easing tension on release, so a control springs past rest before settling. */
      releaseOvershoot: 1.6,
    },
    pop: {
      /** Selection pop: a quick swell, then a short squash-settle back to rest. */
      scale: 1.18,
      overshoot: 2.2,
    },
    like: {
      scale: 1.32,
      unlikeScale: 0.84,
      /** How far the ring around a liked heart expands, as a multiple of the heart. */
      burstScale: 2,
      /** How far the sparks travel from the heart's centre, as a multiple of the heart. */
      sparkTravel: 1.05,
      sparkCount: 6,
    },
    countShift: {
      offsetY: 6,
    },
    limits: {
      maximumFocalMotions: 1,
      maximumLocalResponses: 2,
      maximumStaggerItems: 5,
      staggerInterval: 50,
      minimumStaggerInterval: 40,
      maximumStaggerInterval: 80,
      maximumArtisticDuration: 300,
      maximumEntranceDuration: 900,
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
      stepTransition: {
        durationMs: duration.stepTransition,
        easing: easing.expressive,
        properties: ['opacity', 'transform'],
        repeats: false,
      },
      entrance: {
        durationMs: duration.entrance,
        easing: easing.expressive,
        properties: ['opacity', 'transform'],
        repeats: false,
      },
      estimateReveal: {
        durationMs: duration.reveal,
        easing: easing.expressive,
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
export type SemanticColorName = keyof SnapWorthTokens['color']['dark'];
export type TypographyStyleName = keyof SnapWorthTokens['typography']['style'];
export type MotionRecipeName = keyof SnapWorthTokens['motion']['recipe'];
