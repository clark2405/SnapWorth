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
  entrance: 520,
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

const ink = '#0A0A0A';
const paper = '#F6F4EF';

/**
 * Two palettes with identical semantic names, so every surface can be themed by swapping the
 * map. The ground is a warm neutral in both; champagne is the one accent, kept for value
 * (estimates, the companion) and used sparingly, and the vote hues are muted so a verdict reads
 * without shouting. Primary actions are monochrome (`inverse`).
 */
export const colorLight = {
  canvas: paper,
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  sunken: '#EDEAE3',
  borderSubtle: '#E6E2D9',
  borderStrong: '#D2CDC2',
  textPrimary: '#141413',
  textSecondary: '#4A4844',
  textMuted: '#6E6B65',
  accent: '#84642F',
  accentPressed: '#6F5326',
  accentSoft: '#F2ECE0',
  onAccent: '#FFFFFF',
  inverse: '#141413',
  inversePressed: '#2B2A28',
  onInverse: '#FFFFFF',
  estimateSurface: '#F5F0E6',
  estimateBorder: '#9C7A42',
  voteHigh: '#B4473B',
  voteLow: '#3D6B96',
  voteRight: '#3B7A55',
  success: '#3B7A55',
  danger: '#B3302A',
  warning: '#8C5A14',
  focusRing: '#84642F',
  interactiveBoundary: '#8A867E',
} as const;

export const colorDark = {
  canvas: ink,
  surface: '#141414',
  surfaceRaised: '#1B1B1B',
  sunken: '#1A1A1A',
  borderSubtle: '#222222',
  borderStrong: '#363636',
  textPrimary: '#F4F2EE',
  textSecondary: '#ADAAA4',
  textMuted: '#8D8A84',
  accent: '#D8BA82',
  accentPressed: '#C6A66D',
  accentSoft: '#1F1B13',
  onAccent: ink,
  inverse: '#F4F2EE',
  inversePressed: '#D9D6D0',
  onInverse: ink,
  estimateSurface: '#17150F',
  estimateBorder: '#8E7546',
  voteHigh: '#E48C80',
  voteLow: '#8FB3D6',
  voteRight: '#8EC6A1',
  success: '#8EC6A1',
  danger: '#EF7B70',
  warning: '#E2B666',
  focusRing: '#D8BA82',
  interactiveBoundary: '#8D8A84',
} as const satisfies Record<keyof typeof colorLight, string>;

export const tokens = deepFreeze({
  color: {
    light: colorLight,
    dark: colorDark,
  },
  /**
   * The companion and brand mark share one metallic sweep, champagne through pearl to bronze.
   * It is decoration for the AI's presence only; no text or control state is ever carried by it.
   */
  aurora: ['#E8D3A6', '#F7F0E2', '#BFA06A', '#D8BA82', '#8A6B3C', '#3B3226'],
  /**
   * Translucent layers for controls that sit over live media (the camera viewfinder), where a
   * solid surface would hide what the user is aiming at. Nowhere else.
   */
  overlay: {
    chrome: 'rgba(11, 11, 13, 0.46)',
    border: 'rgba(255, 255, 255, 0.22)',
    scrim: 'rgba(0, 0, 0, 0.42)',
    text: '#FFFFFF',
  },
  shadow: {
    light: 'rgba(20, 20, 19, 0.07)',
    dark: 'rgba(0, 0, 0, 0.6)',
  },
  /** Fallback material where Liquid Glass is unavailable: a blur plus these washes. */
  glass: {
    light: {
      fill: 'rgba(250, 249, 246, 0.72)',
      border: 'rgba(20, 20, 19, 0.07)',
      highlight: 'rgba(255, 255, 255, 0.9)',
    },
    dark: {
      fill: 'rgba(28, 28, 28, 0.62)',
      border: 'rgba(255, 255, 255, 0.08)',
      highlight: 'rgba(255, 255, 255, 0.10)',
    },
  },
  typography: {
    /**
     * Semantic families resolved per platform in `fonts.ts`: `sans` is the system face (SF Pro
     * on Apple platforms), `serif` is the editorial counterweight (New York), and `rounded` is
     * reserved for the companion's voice.
     */
    family: {
      sans: 'sans',
      serif: 'serif',
      rounded: 'rounded',
    },
    webFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif',
      serif: 'ui-serif, "New York", "Iowan Old Style", Charter, Georgia, serif',
      rounded: 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif',
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      heavy: '800',
    },
    style: {
      displayHero: {
        family: 'serif',
        size: 40,
        lineHeight: 44,
        weight: '500',
        letterSpacing: -0.9,
      },
      displayTitle: {
        family: 'serif',
        size: 34,
        lineHeight: 40,
        weight: '500',
        letterSpacing: -0.7,
      },
      priceHero: { family: 'sans', size: 52, lineHeight: 58, weight: '600', letterSpacing: -1.8 },
      priceLarge: { family: 'sans', size: 32, lineHeight: 38, weight: '600', letterSpacing: -1 },
      priceMedium: { family: 'sans', size: 21, lineHeight: 26, weight: '600', letterSpacing: -0.5 },
      priceSmall: { family: 'sans', size: 17, lineHeight: 22, weight: '600', letterSpacing: -0.2 },
      headingLarge: {
        family: 'sans',
        size: 22,
        lineHeight: 28,
        weight: '600',
        letterSpacing: -0.4,
      },
      headingMedium: {
        family: 'sans',
        size: 17,
        lineHeight: 22,
        weight: '600',
        letterSpacing: -0.3,
      },
      headingSmall: {
        family: 'sans',
        size: 15,
        lineHeight: 20,
        weight: '600',
        letterSpacing: -0.2,
      },
      button: { family: 'sans', size: 17, lineHeight: 22, weight: '600', letterSpacing: -0.3 },
      bodyLarge: { family: 'sans', size: 17, lineHeight: 24, weight: '400', letterSpacing: -0.3 },
      bodyMedium: { family: 'sans', size: 15, lineHeight: 21, weight: '400', letterSpacing: -0.2 },
      bodySmall: { family: 'sans', size: 14, lineHeight: 19, weight: '400', letterSpacing: -0.1 },
      bodyCompact: {
        family: 'sans',
        size: 13,
        lineHeight: 18,
        weight: '400',
        letterSpacing: -0.05,
      },
      label: { family: 'sans', size: 15, lineHeight: 20, weight: '500', letterSpacing: -0.2 },
      labelSmall: { family: 'sans', size: 13, lineHeight: 18, weight: '600', letterSpacing: -0.1 },
      labelMedium: { family: 'sans', size: 13, lineHeight: 18, weight: '500', letterSpacing: -0.1 },
      chip: { family: 'sans', size: 13, lineHeight: 16, weight: '500', letterSpacing: -0.1 },
      tag: {
        family: 'sans',
        size: 10,
        lineHeight: 14,
        weight: '500',
        letterSpacingEm: 0.1,
        textTransform: 'uppercase',
      },
      caption: { family: 'sans', size: 12, lineHeight: 16, weight: '400', letterSpacing: 0 },
      tabLabel: { family: 'sans', size: 10, lineHeight: 12, weight: '500', letterSpacing: 0.1 },
      overline: {
        family: 'sans',
        size: 11,
        lineHeight: 16,
        weight: '500',
        letterSpacingEm: 0.12,
        textTransform: 'uppercase',
      },
      wordmark: { family: 'serif', size: 22, lineHeight: 26, weight: '500', letterSpacing: -0.3 },
      companion: {
        family: 'rounded',
        size: 17,
        lineHeight: 22,
        weight: '600',
        letterSpacing: -0.2,
      },
    },
    maxFontSizeMultiplier: {
      priceHero: 1.4,
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
    small: 8,
    medium: 14,
    large: 22,
    xlarge: 30,
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
    /** Room above the native floating tab bar, so content and the companion clear it. */
    nativeTabBarClearance: 96,
    headerCompact: 52,
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
      offsetY: 18,
    },
    /**
     * Springs for anything the finger drives or that should feel physical. Durations are
     * emergent; each preset is tuned to settle inside ~450ms without a visible wobble, except
     * `playful`, which is reserved for the companion and like bursts.
     */
    spring: {
      snappy: { damping: 20, stiffness: 320, mass: 0.8 },
      smooth: { damping: 26, stiffness: 220, mass: 1 },
      gentle: { damping: 28, stiffness: 150, mass: 1 },
      playful: { damping: 12, stiffness: 240, mass: 0.9 },
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
