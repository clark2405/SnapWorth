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
  /** The backdrop changing from one screen's look into the next: slow enough to read as one move. */
  backdropMorph: 820,
  /**
   * How long a screen must stay in view before the backdrop changes for it. A screen passed
   * through on the way somewhere else (a quick run of tab switches) never changes it at all.
   */
  backdropSettle: 240,
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
  textSecondary: '#5F564C',
  textMuted: '#6A6055',
  // A shade deeper than the feed's block red, so red type and the red button read clearly on
  // the counter-coloured page.
  accent: '#C4300F',
  accentPressed: '#A82B0D',
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
  focusRing: '#C4300F',
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
  // The price tag: manila card stock, the ink printed on it, its reinforced eyelet and string.
  kraft: '#E2C595',
  kraftInk: '#4E3A1C',
  kraftEdge: '#B8935C',
  // Stickers, slapped on photos for the community's verdict: market-sign yellow and cobalt.
  marigold: '#FFC21A',
  onMarigold: ink,
  cobalt: '#2343C4',
  onCobalt: '#FFFFFF',
  stickerOutline: ink,
  // Each place in the app has its own colour: the block its tab opens on, and the type set on
  // it. Feed is the price-gun red, Market a bargain-sign marigold, History cobalt, and Chats
  // jeepney green, where buyers and sellers talk it over.
  placeFeed: '#D63A14',
  onPlaceFeed: '#FFFFFF',
  placeMarket: '#FFC21A',
  onPlaceMarket: ink,
  placeHistory: '#2343C4',
  onPlaceHistory: '#FFF8EE',
  placeChat: '#1D6B47',
  onPlaceChat: '#FFF8EE',
  // Anything you can hold (cards, photos, chips, tags) is cut from the same paper: an ink
  // outline with a hard shadow offset beneath it, so stickers and tags belong on it.
  heldEdge: ink,
  heldShadow: ink,
  // The meetup map, printed on the same paper: land is the page, the bay a pale cobalt wash with
  // printed waves, parks a pale jeepney green, and roads paper strips with an ink edge.
  mapLand: '#FBF3E6',
  mapWater: '#D6DEF6',
  mapWaves: '#9DAEE6',
  mapPark: '#D3E8D4',
  mapRoad: '#FFFFFF',
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
  // A tag is a physical thing, so it stays manila at night, only dimmed.
  kraft: '#CDAE7C',
  kraftInk: '#3A2A12',
  kraftEdge: '#8E6E3F',
  marigold: '#F5B915',
  onMarigold: charcoal,
  cobalt: '#4A68E8',
  onCobalt: '#FFFFFF',
  stickerOutline: '#0B0805',
  // Deeper at night, so a block is bold without glaring.
  placeFeed: '#B5341A',
  onPlaceFeed: cream,
  placeMarket: '#E8AE12',
  onPlaceMarket: charcoal,
  placeHistory: '#2D46B0',
  onPlaceHistory: cream,
  placeChat: '#1A5C3E',
  onPlaceChat: cream,
  // At night the outline turns cream so it still reads; the shadow stays a deep ink.
  heldEdge: '#E6DAC6',
  heldShadow: '#000000',
  // At night the map is the charcoal page; water and parks keep their hue, deepened.
  mapLand: '#241C14',
  mapWater: '#1C2440',
  mapWaves: '#3A4C8E',
  mapPark: '#1F3324',
  mapRoad: '#3A3027',
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
  kraft: '#CDAE7C',
  kraftInk: '#3A2A12',
  kraftEdge: '#8E6E3F',
  marigold: '#F5B915',
  onMarigold: '#15101B',
  cobalt: '#4A68E8',
  onCobalt: '#FFFFFF',
  stickerOutline: '#0B0710',
  placeFeed: '#B5341A',
  onPlaceFeed: '#F3ECDD',
  placeMarket: '#E8AE12',
  onPlaceMarket: '#15101B',
  placeHistory: '#2D46B0',
  onPlaceHistory: '#F3ECDD',
  placeChat: '#1A5C3E',
  onPlaceChat: '#F3ECDD',
  heldEdge: '#E6DCF0',
  heldShadow: '#000000',
  mapLand: '#1E1726',
  mapWater: '#1D1F3E',
  mapWaves: '#3B4486',
  mapPark: '#1F2E2A',
  mapRoad: '#33283F',
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
   * The introduction's drawings: flat colour with one shade tone per material, no outlines. They
   * are pictures, so they keep these colours in every appearance; the brand colours they sit on
   * come from the theme.
   */
  illustration: {
    /** Each skin tone with its shade, for necks, ears and far arms. */
    skin: {
      light: ['#F4CDAA', '#E2B08A'],
      tan: ['#D49A6E', '#BC8156'],
      deep: ['#8E5A3B', '#77482D'],
    },
    hair: '#2A1D16',
    hairShine: '#4A3A30',
    denim: '#2343C4',
    denimShade: '#17257A',
    sneaker: '#FFF8EE',
    phone: '#1A1714',
    phoneScreen: '#3A3633',
    /** Shirt colours with their pattern or shade tone. */
    shirt: {
      marigold: ['#FFC21A', '#F0A400', '#E09400'],
      red: ['#D63A14', '#E8634A', '#B82F10'],
      cream: ['#FFF8EE', '#C9D3F5', '#E6DED0'],
    },
    /** The windbreaker on the card: teal, purple trim. */
    jacket: '#35C2BE',
    jacketTrim: '#7A4FD0',
    hanger: '#1A1714',
    cardStock: '#FFF8EE',
    box: '#D9B57E',
    boxShade: '#C9A16A',
    boxTape: '#E9CFA2',
    boxPrint: '#B48B57',
    stick: '#B8935C',
    leaf: '#1D6B47',
    leafLight: '#2F8A5E',
    pot: '#E2C595',
    potShade: '#C9A16A',
    coin: '#FFC21A',
    coinRim: '#E09400',
    coinMark: '#B87800',
    light: '#FFF8EE',
  },
  /**
   * Holographic foil, the mark of anything the AI worked out: the pastel shift of a real foil
   * sticker, the kind that marks a thing as checked. A material, so it keeps these colours in
   * every appearance, with its own dark ink printed on it.
   */
  holo: {
    stops: ['#FF9DBB', '#FFD978', '#8FE8C2', '#8CC4FF', '#C4A0FF'],
    sheen: '#FFFFFF',
    ink: '#2A1D33',
  },
  /**
   * Translucent layers for controls that sit over live media (the camera viewfinder, a photo
   * opened full screen), where a solid surface would hide what the user is looking at.
   */
  overlay: {
    chrome: 'rgba(11, 11, 13, 0.46)',
    border: 'rgba(255, 255, 255, 0.22)',
    scrim: 'rgba(0, 0, 0, 0.42)',
    text: '#FFFFFF',
    /** The near-black a photo sits on when opened full screen, in either appearance. */
    stage: '#0A0A0B',
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
     * Semantic families, resolved to bundled faces in `fonts.ts`: `display` for titles, `price`
     * for every ₱ figure, `mono` for what is printed on a tag, `sans` for everything else, and
     * `rounded` for the companion's voice.
     */
    family: {
      sans: 'sans',
      display: 'display',
      price: 'price',
      mono: 'mono',
      rounded: 'rounded',
    },
    webFamily: {
      sans: 'PlusJakartaSans_400Regular, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif',
      display:
        'BricolageGrotesque_700Bold, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif',
      price:
        'BricolageGrotesque_800ExtraBold, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif',
      mono: 'DMMono_500Medium, ui-monospace, "SF Mono", Menlo, monospace',
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
        letterSpacing: -1,
      },
      // A tab's title, set big and tight on its colour block: the type does the shouting.
      displayTitle: {
        family: 'display',
        size: 44,
        lineHeight: 46,
        weight: '800',
        letterSpacing: -1.4,
      },
      // A name or summary beside a portrait, a step down from a tab's title.
      displayMedium: {
        family: 'display',
        size: 34,
        lineHeight: 38,
        weight: '800',
        letterSpacing: -0.9,
      },
      // Prices are the product, so they get the display face at its heaviest.
      priceHero: { family: 'price', size: 52, lineHeight: 54, weight: '800', letterSpacing: -1.4 },
      priceLarge: { family: 'price', size: 40, lineHeight: 42, weight: '800', letterSpacing: -1 },
      priceMedium: {
        family: 'price',
        size: 23,
        lineHeight: 26,
        weight: '800',
        letterSpacing: -0.4,
      },
      priceSmall: { family: 'price', size: 16, lineHeight: 20, weight: '700', letterSpacing: -0.1 },
      headingLarge: {
        family: 'display',
        size: 24,
        lineHeight: 28,
        weight: '800',
        letterSpacing: -0.5,
      },
      headingMedium: {
        family: 'display',
        size: 19,
        lineHeight: 23,
        weight: '700',
        letterSpacing: -0.2,
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
      // Section labels read like the printing on a price tag.
      overline: {
        family: 'mono',
        size: 12,
        lineHeight: 14,
        weight: '500',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
      },
      /** The small print on a tag or a stamp. */
      stamp: {
        family: 'mono',
        size: 11,
        lineHeight: 13,
        weight: '500',
        letterSpacing: 1,
        textTransform: 'uppercase',
      },
      /** A sticker slapped on a photo: short, loud, display face. */
      sticker: {
        family: 'display',
        size: 13,
        lineHeight: 15,
        weight: '800',
        letterSpacing: 0.2,
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
  /**
   * The one lean every printed piece (sticker, sign, stamp, a single tag) takes, by the side of
   * its container it sits on: everything on the left leans one way, everything on the right
   * the other, by the same amount, so no two labels ever disagree. Degrees.
   */
  tilt: {
    start: -2,
    end: 2,
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
    /** The web on a wide window: a tab's content, up to where lines and grids stay easy to scan. */
    wideColumn: 1200,
    /** The web on a wide window: a screen opened from a tab, at a comfortable reading width. */
    readingColumn: 760,
    /** A detail page on a wide window: the photo's share of the row beside the details' share. */
    detailMediaFlex: 5,
    detailBodyFlex: 6,
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
      /** A soft start and a long landing, for a change that should feel like one continuous move. */
      morph: [0.33, 0, 0.15, 1],
      exit: [0.4, 0, 1, 1],
    },
    entrance: {
      offsetY: 12,
    },
    ambient: {
      /** Opacity of the warm blobs at the peak of their breath. */
      peakOpacity: { light: 0.9, dark: 0.75, night: 0.8 },
      /**
       * Opacity of the price-gun print: lighter where it covers the whole page, a touch stronger
       * where it only runs down the edges.
       */
      printOpacity: {
        full: { light: 0.13, dark: 0.17, night: 0.15 },
        edges: { light: 0.18, dark: 0.22, night: 0.2 },
      },
      /** What a mask keeps in full: white, so only each stop's opacity decides how much shows. */
      maskKeep: '#FFFFFF',
      /** Opacity of the cut-paper stickers along the edges. */
      stickerOpacity: { light: 0.3, dark: 0.36, night: 0.34 },
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
