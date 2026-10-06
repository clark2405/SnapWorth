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
  /** Press feedback. */
  fast: 120,
  reducedCrossFade: 120,
  exit: 160,
  /** Functional transitions: selections, toggles, small state changes. */
  base: 240,
  sharedElement: 240,
  dataShift: 240,
  artisticAccent: 280,
  /** The signature settle: a fast start and a long, smooth landing. */
  reveal: 420,
  entrance: 600,
  /** Slow, deliberate moves such as a sheet or a hero settling. */
  slow: 680,
  /** One breath of the ambient layer behind every screen. */
  ambientLoop: 7000,
  stepTransition: 280,
  popRise: 100,
  popSettle: 180,
  launchMinimumHold: 1100,
  launchEntrance: 520,
  estimateWaitCycle: 1600,
  estimateWaitRest: 400,
  estimateProgressDelay: 2000,
  estimateOutcomeDeadline: 10000,
} as const;

// Expo-out everywhere: never linear, never the default ease-in-out. `direct` is the snappier
// variant used for presses and small state changes.
const easing = {
  direct: 'cubic-bezier(0.25, 1, 0.5, 1)',
  enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  expressive: 'cubic-bezier(0.16, 1, 0.3, 1)',
  linear: 'linear',
} as const;

const ink = '#1A1714';
const paper = '#FFFBF5';
const charcoal = '#17120D';
const cream = '#F5EEE3';

/**
 * Two palettes with identical semantic names. Everything is warm: an off-white page and warm
 * near-black ink by day, warm charcoal (never blue-grey) by night. Vermilion is the ONE accent
 * and is reserved for the single primary action on a screen; categories and statuses use the
 * soft tonal pairs (sand, mint, grave, and the warn tint), never extra bright colours. The
 * feature slab is the one inverted card a screen may carry for its hero number.
 */
export const colorLight = {
  canvas: paper,
  surface: '#FFFFFF',
  surfaceRaised: '#FFF7EC',
  sunken: '#F6EFE4',
  borderSubtle: '#ECE3D6',
  borderStrong: '#DDD1C0',
  textPrimary: ink,
  textSecondary: '#6B6157',
  textMuted: '#7A6F63',
  accent: '#D63A14',
  accentPressed: '#B8371A',
  accentSoft: '#FFE7E0',
  onAccent: '#FFFFFF',
  inverse: ink,
  inversePressed: '#2E2924',
  onInverse: '#FFFFFF',
  estimateSurface: '#F0E6D6',
  estimateBorder: '#8A7A60',
  voteHigh: '#B8371A',
  voteLow: '#6F5F45',
  voteRight: '#2F6B43',
  success: '#2F6B43',
  danger: '#B3261E',
  dangerSoft: '#FBE7E3',
  warning: '#B8371A',
  focusRing: '#D63A14',
  interactiveBoundary: '#8F8477',
  sand: '#F0E6D6',
  sandInk: '#6F5F45',
  mint: '#E4F1E6',
  mintInk: '#2F6B43',
  grave: '#ECE7E2',
  graveInk: '#6E655C',
  feature: ink,
  onFeature: '#FFFFFF',
  onFeatureDim: '#A89E92',
} as const;

export const colorDark = {
  canvas: charcoal,
  surface: '#211A12',
  surfaceRaised: '#2A2117',
  sunken: '#0F0B07',
  borderSubtle: '#352C22',
  borderStrong: '#4A3F33',
  textPrimary: cream,
  textSecondary: '#B4A99A',
  textMuted: '#968B7C',
  accent: '#FF6B4F',
  accentPressed: '#FF5235',
  accentSoft: '#3D2017',
  onAccent: charcoal,
  inverse: cream,
  inversePressed: '#DDD4C6',
  onInverse: charcoal,
  estimateSurface: '#2E2519',
  estimateBorder: '#C6AE86',
  voteHigh: '#FF8F78',
  voteLow: '#C6AE86',
  voteRight: '#8FD4A3',
  success: '#8FD4A3',
  danger: '#F26D78',
  dangerSoft: '#3A1D1C',
  warning: '#FF8F78',
  focusRing: '#FF6B4F',
  interactiveBoundary: '#8F8477',
  sand: '#2E2519',
  sandInk: '#C6AE86',
  mint: '#1C2A20',
  mintInk: '#8FD4A3',
  grave: '#262019',
  graveInk: '#B0A595',
  feature: '#2C2218',
  onFeature: cream,
  onFeatureDim: '#B4A99A',
} as const satisfies Record<keyof typeof colorLight, string>;

/**
 * The "night room": one dramatic, playful palette for Worthy's chat, plum-dark rather than
 * charcoal. Vermilion is still the only accent inside it.
 */
export const colorNight = {
  canvas: '#15101B',
  surface: '#241833',
  surfaceRaised: '#2C2040',
  sunken: '#0E0A13',
  borderSubtle: '#2B2236',
  borderStrong: '#3D3150',
  textPrimary: '#F3ECDD',
  textSecondary: '#B9AFC2',
  textMuted: '#978DA1',
  accent: '#FF6B4F',
  accentPressed: '#FF5235',
  accentSoft: '#3A1F27',
  onAccent: '#15101B',
  inverse: '#F3ECDD',
  inversePressed: '#DCD3C4',
  onInverse: '#15101B',
  estimateSurface: '#221A2E',
  estimateBorder: '#9A8FB0',
  voteHigh: '#FF8F78',
  voteLow: '#C9B8E0',
  voteRight: '#8FD4A3',
  success: '#8FD4A3',
  danger: '#F26D78',
  dangerSoft: '#3A1D26',
  warning: '#FF8F78',
  focusRing: '#FF6B4F',
  interactiveBoundary: '#8F849C',
  sand: '#2E2538',
  sandInk: '#CDBFA6',
  mint: '#1C2A26',
  mintInk: '#8FD4A3',
  grave: '#262030',
  graveInk: '#B9AFC2',
  feature: '#2C2040',
  onFeature: '#F3ECDD',
  onFeatureDim: '#B9AFC2',
} as const satisfies Record<keyof typeof colorLight, string>;

export const tokens = deepFreeze({
  color: {
    light: colorLight,
    dark: colorDark,
    night: colorNight,
  },
  /**
   * The companion and brand mark share one metallic sweep, champagne through pearl to bronze.
   * It is decoration for the AI's presence only; no text or control state is ever carried by it.
   */
  aurora: ['#E8D3A6', '#F7F0E2', '#BFA06A', '#D8BA82', '#8A6B3C', '#3B3226'],
  /**
   * The ambient layer: huge, low-opacity warm blobs drifting behind every screen. Each area
   * re-tints them so it feels a little different while the base and accent stay constant.
   */
  ambient: {
    light: {
      feed: ['#FFE7E0', '#F0E6D6', '#FFF1DC'],
      market: ['#F0E6D6', '#FFF1DC', '#FFE7E0'],
      history: ['#E4F1E6', '#F0E6D6', '#FFF1DC'],
      chat: ['#ECE7E2', '#FFE7E0', '#F0E6D6'],
      calm: ['#F0E6D6', '#FFF1DC', '#ECE7E2'],
    },
    dark: {
      feed: ['#3D2017', '#2E2519', '#2A2117'],
      market: ['#2E2519', '#2A2117', '#3D2017'],
      history: ['#1C2A20', '#2E2519', '#2A2117'],
      chat: ['#262019', '#3D2017', '#2E2519'],
      calm: ['#2E2519', '#2A2117', '#262019'],
    },
    night: {
      feed: ['#3A1F27', '#2C2040', '#241833'],
      market: ['#2C2040', '#241833', '#3A1F27'],
      history: ['#1C2A26', '#2C2040', '#241833'],
      chat: ['#2C2040', '#3A1F27', '#241833'],
      calm: ['#2C2040', '#241833', '#3A1F27'],
    },
  },
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
  /** Warm-tinted, light from the top. `shadow` is the resting card; `lifted` floats. */
  shadow: {
    light: 'rgba(58, 42, 24, 0.08)',
    dark: 'rgba(0, 0, 0, 0.45)',
    night: 'rgba(0, 0, 0, 0.5)',
  },
  lifted: {
    light: 'rgba(58, 42, 24, 0.16)',
    dark: 'rgba(0, 0, 0, 0.6)',
    night: 'rgba(0, 0, 0, 0.6)',
  },
  /** Fallback material where Liquid Glass is unavailable: a blur plus these washes. */
  glass: {
    light: {
      fill: 'rgba(255, 251, 245, 0.78)',
      border: 'rgba(58, 42, 24, 0.08)',
      highlight: 'rgba(255, 255, 255, 0.9)',
    },
    dark: {
      fill: 'rgba(33, 26, 18, 0.72)',
      border: 'rgba(255, 255, 255, 0.09)',
      highlight: 'rgba(255, 255, 255, 0.10)',
    },
    night: {
      fill: 'rgba(36, 24, 51, 0.72)',
      border: 'rgba(255, 255, 255, 0.08)',
      highlight: 'rgba(255, 255, 255, 0.10)',
    },
  },
  typography: {
    /**
     * Semantic families, all resolved to the one bundled typeface in `fonts.ts`: `display` for
     * titles, `sans` for everything else, and `rounded` for the companion's voice.
     */
    family: {
      sans: 'sans',
      display: 'display',
      rounded: 'rounded',
    },
    webFamily: {
      sans: 'PlusJakartaSans_400Regular, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif',
      display:
        'PlusJakartaSans_600SemiBold, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif',
      rounded:
        'PlusJakartaSans_500Medium, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif',
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      heavy: '800',
    },
    style: {
      // Headlines are layout elements: oversized, heavy, tightly tracked.
      displayHero: {
        family: 'display',
        size: 44,
        lineHeight: 46,
        weight: '800',
        letterSpacing: -1.2,
      },
      displayTitle: {
        family: 'display',
        size: 32,
        lineHeight: 36,
        weight: '800',
        letterSpacing: -1.2,
      },
      priceHero: { family: 'sans', size: 48, lineHeight: 50, weight: '800', letterSpacing: -1.8 },
      priceLarge: { family: 'sans', size: 40, lineHeight: 42, weight: '800', letterSpacing: -1.5 },
      priceMedium: { family: 'sans', size: 22, lineHeight: 26, weight: '800', letterSpacing: -0.6 },
      priceSmall: { family: 'sans', size: 16, lineHeight: 20, weight: '700', letterSpacing: -0.2 },
      headingLarge: {
        family: 'sans',
        size: 24,
        lineHeight: 28,
        weight: '800',
        letterSpacing: -0.6,
      },
      headingMedium: {
        family: 'sans',
        size: 18,
        lineHeight: 22,
        weight: '700',
        letterSpacing: -0.3,
      },
      headingSmall: {
        family: 'sans',
        size: 15,
        lineHeight: 20,
        weight: '700',
        letterSpacing: -0.2,
      },
      button: { family: 'sans', size: 17, lineHeight: 22, weight: '700', letterSpacing: -0.2 },
      bodyLarge: { family: 'sans', size: 16, lineHeight: 23, weight: '500', letterSpacing: 0 },
      bodyMedium: { family: 'sans', size: 15, lineHeight: 22, weight: '500', letterSpacing: 0 },
      bodySmall: { family: 'sans', size: 14, lineHeight: 20, weight: '500', letterSpacing: 0 },
      bodyCompact: {
        family: 'sans',
        size: 13,
        lineHeight: 18,
        weight: '500',
        letterSpacing: 0,
      },
      label: { family: 'sans', size: 15, lineHeight: 20, weight: '600', letterSpacing: 0 },
      labelSmall: { family: 'sans', size: 13, lineHeight: 18, weight: '600', letterSpacing: 0 },
      labelMedium: { family: 'sans', size: 13, lineHeight: 18, weight: '600', letterSpacing: 0 },
      chip: { family: 'sans', size: 13, lineHeight: 16, weight: '700', letterSpacing: 0 },
      tag: { family: 'sans', size: 12, lineHeight: 16, weight: '700', letterSpacing: 0 },
      caption: { family: 'sans', size: 12, lineHeight: 16, weight: '500', letterSpacing: 0.1 },
      tabLabel: { family: 'sans', size: 11, lineHeight: 13, weight: '600', letterSpacing: 0.1 },
      tabLabelActive: {
        family: 'sans',
        size: 11,
        lineHeight: 13,
        weight: '800',
        letterSpacing: 0.1,
      },
      overline: {
        family: 'sans',
        size: 12,
        lineHeight: 14,
        weight: '700',
        letterSpacing: 1.6,
        textTransform: 'uppercase',
      },
      wordmark: { family: 'display', size: 22, lineHeight: 26, weight: '800', letterSpacing: -0.6 },
      companion: {
        family: 'rounded',
        size: 17,
        lineHeight: 22,
        weight: '700',
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
    small: 12,
    medium: 18,
    large: 24,
    xlarge: 32,
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
    pageGutterCompact: 24,
    pageGutterMedium: 24,
    pageGutterExpanded: 32,
    gridGap: 16,
    sectionGap: 40,
    tabBarHeight: 60,
    /**
     * iOS: room from the screen's bottom edge to the top of the floating tab bar and the Snap
     * accessory riding on it, so the last item scrolls clear of both and no further.
     */
    nativeTabBarClearance: 140,
    /** Android: Material's navigation bar plus the Snap bar floating above it, over the inset. */
    androidTabBarClearance: 152,
    /** Room above the web's floating tab bar, so content and the companion clear it. */
    floatingTabBarClearance: 112,
    floatingTabBar: 74,
    /** The tall primary pill: the one accent action on a screen. */
    primaryButton: 56,
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
      offsetY: 12,
    },
    ambient: {
      /** Opacity of the warm blobs at the peak of their breath. */
      peakOpacity: { light: 0.9, dark: 0.75, night: 0.8 },
    },
    /**
     * Springs for anything the finger drives or that should feel physical. Durations are
     * emergent; each preset is tuned to settle inside ~450ms without a visible wobble, except
     * `playful`, which is reserved for the companion and like bursts.
     */
    spring: {
      /** Press: a weighted settle back to rest. */
      snappy: { damping: 18, stiffness: 320, mass: 0.7 },
      smooth: { damping: 26, stiffness: 220, mass: 1 },
      gentle: { damping: 28, stiffness: 150, mass: 1 },
      /** Pop: selection, the active tab icon, likes and the companion. */
      playful: { damping: 12, stiffness: 220, mass: 0.9 },
    },
    step: {
      offsetX: 24,
    },
    press: {
      scale: 0.96,
      /** The slight downward nudge that makes a press feel weighted. */
      nudgeY: 1.5,
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
      staggerInterval: 70,
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
