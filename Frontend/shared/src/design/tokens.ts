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
  entrance: 720,
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

const mint = '#7CF5CB';
const ink = '#07090C';

export const tokens = deepFreeze({
  color: {
    dark: {
      canvas: ink,
      surface: '#12161A',
      sunken: '#040608',
      borderSubtle: '#1E2328',
      borderStrong: '#343B41',
      textPrimary: '#F2F4F3',
      textSecondary: '#B7BCC1',
      textMuted: '#8C9298',
      accent: mint,
      accentPressed: '#5FE6B6',
      onAccent: ink,
      estimateSurface: '#0E211C',
      estimateBorder: '#2F6B58',
      voteHigh: '#FF7A6E',
      voteLow: '#B7BCC1',
      voteRight: mint,
      danger: '#FF7A6E',
      warning: '#F5C26B',
      focusRing: mint,
      interactiveBoundary: '#F2F4F3',
    },
  },
  glass: {
    fill: 'rgba(255, 255, 255, 0.05)',
    fillRaised: 'rgba(255, 255, 255, 0.08)',
    fillPressed: 'rgba(255, 255, 255, 0.12)',
    fillChrome: 'rgba(16, 19, 22, 0.72)',
    border: 'rgba(255, 255, 255, 0.10)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    highlight: 'rgba(255, 255, 255, 0.07)',
    highlightClear: 'rgba(255, 255, 255, 0)',
    scrim: 'rgba(7, 9, 12, 0.72)',
    scrimClear: 'rgba(7, 9, 12, 0)',
    mintFill: 'rgba(124, 245, 203, 0.08)',
    mintFillStrong: 'rgba(124, 245, 203, 0.16)',
    mintBorder: 'rgba(124, 245, 203, 0.32)',
    dangerFill: 'rgba(255, 122, 110, 0.12)',
    blurIntensity: 28,
  },
  glow: {
    mintTop: '#A5FDDE',
    mintBottom: '#5CE8B8',
    button: '0px 6px 24px rgba(124, 245, 203, 0.38)',
    capture: '0px 0px 26px rgba(124, 245, 203, 0.55)',
    halo: '0px 0px 32px rgba(124, 245, 203, 0.28)',
  },
  ambient: {
    base: ink,
    mint: { color: mint, opacity: 0.3, cx: 0.9, cy: 0.0, radius: 0.72 },
    haze: { color: '#3C2FC4', opacity: 0.34, cx: 0.0, cy: 0.66, radius: 0.6 },
    deep: { color: '#1C4C7A', opacity: 0.2, cx: 1.0, cy: 1.0, radius: 0.5 },
  },
  typography: {
    family: {
      displayExtraBold: 'Outfit_800ExtraBold',
      displayBold: 'Outfit_700Bold',
      displaySemibold: 'Outfit_600SemiBold',
      bodyRegular: 'Inter_400Regular',
      bodyMedium: 'Inter_500Medium',
      bodySemibold: 'Inter_600SemiBold',
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extraBold: '800',
    },
    style: {
      displayHero: {
        family: 'Outfit_800ExtraBold',
        size: 48,
        lineHeight: 48,
        weight: '800',
        letterSpacing: -2,
      },
      displayTitle: {
        family: 'Outfit_800ExtraBold',
        size: 38,
        lineHeight: 42,
        weight: '800',
        letterSpacing: -1.5,
      },
      priceHero: {
        family: 'Outfit_800ExtraBold',
        size: 62,
        lineHeight: 66,
        weight: '800',
        letterSpacing: -2,
      },
      priceLarge: {
        family: 'Outfit_800ExtraBold',
        size: 48,
        lineHeight: 52,
        weight: '800',
        letterSpacing: -1.5,
      },
      priceMedium: {
        family: 'Outfit_800ExtraBold',
        size: 24,
        lineHeight: 28,
        weight: '800',
        letterSpacing: -0.6,
      },
      priceSmall: {
        family: 'Outfit_700Bold',
        size: 17,
        lineHeight: 22,
        weight: '700',
        letterSpacing: -0.2,
      },
      headingLarge: {
        family: 'Outfit_700Bold',
        size: 23,
        lineHeight: 28,
        weight: '700',
        letterSpacing: -0.4,
      },
      headingMedium: {
        family: 'Outfit_700Bold',
        size: 18,
        lineHeight: 24,
        weight: '700',
        letterSpacing: -0.2,
      },
      headingSmall: {
        family: 'Outfit_700Bold',
        size: 15,
        lineHeight: 20,
        weight: '700',
        letterSpacing: -0.1,
      },
      button: {
        family: 'Outfit_600SemiBold',
        size: 15,
        lineHeight: 20,
        weight: '600',
        letterSpacing: 0,
      },
      bodyLarge: { family: 'Inter_400Regular', size: 16, lineHeight: 24, weight: '400' },
      bodyMedium: { family: 'Inter_400Regular', size: 15, lineHeight: 21, weight: '400' },
      bodySmall: { family: 'Inter_400Regular', size: 14, lineHeight: 20, weight: '400' },
      bodyCompact: { family: 'Inter_400Regular', size: 13, lineHeight: 17, weight: '400' },
      label: { family: 'Inter_600SemiBold', size: 14, lineHeight: 20, weight: '600' },
      labelSmall: { family: 'Inter_600SemiBold', size: 13, lineHeight: 18, weight: '600' },
      labelMedium: { family: 'Inter_500Medium', size: 13, lineHeight: 18, weight: '500' },
      chip: { family: 'Inter_600SemiBold', size: 12, lineHeight: 16, weight: '600' },
      tag: { family: 'Inter_600SemiBold', size: 11, lineHeight: 14, weight: '600' },
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
        family: 'Inter_500Medium',
        size: 12,
        lineHeight: 16,
        weight: '500',
        letterSpacingEm: 0.38,
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
    large: 16,
    xlarge: 22,
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
    controlHeight: 50,
    inputHeight: 48,
    chipHeight: 30,
    pageGutterCompact: 20,
    pageGutterMedium: 24,
    pageGutterExpanded: 32,
    gridGap: 16,
    sectionGap: 40,
    tabBarHeight: 64,
    tabBarInset: 16,
    tabBarCapture: 58,
    headerHeight: 56,
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
      offsetY: 14,
      scaleFrom: 0.985,
    },
    press: {
      scale: 0.97,
    },
    limits: {
      maximumFocalMotions: 1,
      maximumLocalResponses: 2,
      maximumStaggerItems: 8,
      staggerInterval: 60,
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
