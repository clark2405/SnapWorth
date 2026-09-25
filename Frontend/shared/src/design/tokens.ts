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

const ink = '#0B0B0D';
const paper = '#F5F4F0';

/**
 * Two palettes with identical semantic names, so every surface can be themed by swapping the
 * map. The ground is near-neutral in both; iris is the one saturated accent, and the vote hues
 * appear only on votes. Primary actions are monochrome (`inverse`), which keeps the accent for
 * value: estimates, the capture control, and the companion.
 */
export const colorLight = {
  canvas: paper,
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  sunken: '#EBEAE5',
  borderSubtle: '#E3E1DB',
  borderStrong: '#CBC8C0',
  textPrimary: '#111114',
  textSecondary: '#46464D',
  textMuted: '#6C6C72',
  accent: '#5B4BFF',
  accentPressed: '#4A3AEE',
  accentSoft: '#ECEAFF',
  onAccent: '#FFFFFF',
  inverse: '#111114',
  inversePressed: '#2A2A30',
  onInverse: '#FFFFFF',
  estimateSurface: '#EFECFF',
  estimateBorder: '#6F62FF',
  voteHigh: '#D93A31',
  voteLow: '#0071B8',
  voteRight: '#1E8C4E',
  success: '#1E8C4E',
  danger: '#D1242F',
  warning: '#A64B00',
  focusRing: '#5B4BFF',
  interactiveBoundary: '#86868B',
} as const;

export const colorDark = {
  canvas: ink,
  surface: '#161618',
  surfaceRaised: '#1E1E21',
  sunken: '#050506',
  borderSubtle: '#242427',
  borderStrong: '#3A3A3F',
  textPrimary: '#F5F5F7',
  textSecondary: '#AEAEB4',
  textMuted: '#8E8E94',
  accent: '#8F84FF',
  accentPressed: '#7A6EF7',
  accentSoft: '#1C1A33',
  onAccent: ink,
  inverse: '#F5F5F7',
  inversePressed: '#D9D9DE',
  onInverse: ink,
  estimateSurface: '#17152B',
  estimateBorder: '#6A5FE6',
  voteHigh: '#FF6961',
  voteLow: '#64D2FF',
  voteRight: '#30D158',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FFB340',
  focusRing: '#8F84FF',
  interactiveBoundary: '#8E8E94',
} as const satisfies Record<keyof typeof colorLight, string>;

export const tokens = deepFreeze({
  color: {
    light: colorLight,
    dark: colorDark,
  },
  /**
   * The companion and brand mark share one iridescent sweep. It is decoration for the AI's
   * presence only; no text or control state is ever carried by it.
   */
  aurora: ['#7B5CFF', '#3DB8FF', '#46E0B5', '#FFC23D', '#FF6A3D', '#FF3D8B'],
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
    light: 'rgba(17, 17, 20, 0.10)',
    dark: 'rgba(0, 0, 0, 0.55)',
  },
  /** Fallback material where Liquid Glass is unavailable: a blur plus these washes. */
  glass: {
    light: {
      fill: 'rgba(255, 255, 255, 0.62)',
      border: 'rgba(17, 17, 20, 0.08)',
      highlight: 'rgba(255, 255, 255, 0.9)',
    },
    dark: {
      fill: 'rgba(38, 38, 42, 0.52)',
      border: 'rgba(255, 255, 255, 0.10)',
      highlight: 'rgba(255, 255, 255, 0.14)',
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
        weight: '600',
        letterSpacing: -0.8,
      },
      displayTitle: {
        family: 'serif',
        size: 34,
        lineHeight: 40,
        weight: '600',
        letterSpacing: -0.6,
      },
      priceHero: { family: 'sans', size: 56, lineHeight: 60, weight: '700', letterSpacing: -2 },
      priceLarge: { family: 'sans', size: 34, lineHeight: 40, weight: '700', letterSpacing: -1 },
      priceMedium: { family: 'sans', size: 22, lineHeight: 28, weight: '700', letterSpacing: -0.5 },
      priceSmall: { family: 'sans', size: 17, lineHeight: 22, weight: '600', letterSpacing: -0.2 },
      headingLarge: {
        family: 'sans',
        size: 22,
        lineHeight: 28,
        weight: '700',
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
      chip: { family: 'sans', size: 13, lineHeight: 16, weight: '600', letterSpacing: -0.1 },
      tag: {
        family: 'sans',
        size: 11,
        lineHeight: 14,
        weight: '600',
        letterSpacingEm: 0.06,
        textTransform: 'uppercase',
      },
      caption: { family: 'sans', size: 12, lineHeight: 16, weight: '400', letterSpacing: 0 },
      tabLabel: { family: 'sans', size: 10, lineHeight: 12, weight: '500', letterSpacing: 0.1 },
      overline: {
        family: 'sans',
        size: 12,
        lineHeight: 16,
        weight: '600',
        letterSpacingEm: 0.06,
        textTransform: 'uppercase',
      },
      wordmark: { family: 'serif', size: 22, lineHeight: 26, weight: '600', letterSpacing: -0.4 },
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
