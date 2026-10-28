import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  makeMutable,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { placeColors, tokens, useTheme } from '../design';
import blobImage from './backdrop/blob.png';
import {
  PrintLayer,
  StickerArt,
  stickerLayouts,
  stickerLean,
  type AmbientArea,
  type PrintCoverage,
} from './BackdropPrint';

export type { AmbientArea, PrintCoverage } from './BackdropPrint';

export interface AmbientBackdropProps {
  /**
   * Which area's colour the backdrop takes, so each tab feels a little different while the base
   * stays constant. `none` is only for screens over live media.
   */
  readonly mood?: AmbientArea | 'none';
  /**
   * How much of the page the price-gun print covers. `full` suits a quiet screen with room to
   * spare, such as logging in; `edges` keeps it out from behind busy content.
   */
  readonly print?: PrintCoverage;
}

/** One full drift of a blob, there and back. */
const blobDriftPeriod = tokens.motion.duration.ambientLoop * 3.2;

/** Where each blob rests, as fractions of the screen, and how far it wanders. */
const blobs = [
  { x: -0.35, y: -0.18, size: 1.3, driftX: 0.08, driftY: 0.05, phase: 0 },
  { x: 0.35, y: 0.18, size: 1.1, driftX: -0.1, driftY: 0.06, phase: 0.33 },
  { x: -0.2, y: 0.55, size: 1.2, driftX: 0.07, driftY: -0.05, phase: 0.66 },
] as const;

/** One screen's backdrop: its colour and how far its print reaches. */
interface Look {
  readonly mood: AmbientArea;
  readonly print: PrintCoverage;
}

const sameLook = (a: Look, b: Look) => a.mood === b.mood && a.print === b.print;

const morphCurve = tokens.motion.bezier.morph;
const morphTiming = {
  duration: tokens.motion.duration.backdropMorph,
  easing: Easing.bezier(
    morphCurve[0] ?? 0,
    morphCurve[1] ?? 0,
    morphCurve[2] ?? 1,
    morphCurve[3] ?? 1,
  ),
};
/** How long after a morph should have landed its end state is committed outright. */
const settleMargin = 120;
/** A layer this faint at the start of a morph is dropped rather than faded. */
const faintest = 0.02;

interface StickerPose {
  readonly x: number;
  readonly y: number;
  readonly rotate: number;
}

function posesFor(look: Look, width: number, height: number): readonly StickerPose[] {
  return stickerLayouts[look.mood].map((slot) => ({
    x: width * slot.x,
    y: height * slot.y,
    rotate: stickerLean[slot.side],
  }));
}

/** A look on its way out, and how strongly it showed when the current change of look began. */
interface Leaving {
  readonly look: Look;
  readonly from: number;
}

/**
 * The backdrop's one change of look, shared by every screen. Each screen draws its own copy, but
 * they all draw from this, at the same `progress`, so the screen you switch to shows exactly the
 * frame the last one was showing. A new look arriving mid-change starts from what's on screen:
 * each look fades out from the strength it has at that moment, and the stickers set off from
 * wherever they've got to. Nothing restarts, so a quick run of switches reads as one movement.
 */
interface Morph {
  readonly id: number;
  readonly target: Look;
  /** How strongly the target already showed when this change began. */
  readonly base: number;
  readonly leaving: readonly Leaving[];
  /** Where the stickers set off from, while they're travelling. */
  readonly origin: readonly StickerPose[] | null;
  /**
   * This change's own progress. A new change gets a fresh one rather than resetting this, so a
   * screen still drawing the last change holds its frame (the old value stops where it is) until
   * it draws the new one, which starts from that same picture at 0: there's no frame in between.
   */
  readonly progress: SharedValue<number>;
}

let morph: Morph | null = null;
const atRest = makeMutable(1);
const watchers = new Set<() => void>();
let settleTimer: ReturnType<typeof setTimeout> | undefined;

function publish(next: Morph) {
  morph = next;
  watchers.forEach((watcher) => watcher());
}

function watch(watcher: () => void) {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

const readMorph = () => morph;

const settledMorph = (current: Morph): boolean =>
  current.leaving.length === 0 && current.base >= 1 && current.origin === null;

function retarget(look: Look, animate: boolean) {
  const current = morph;
  if (!current) {
    publish({ id: 1, target: look, base: 1, leaving: [], origin: null, progress: atRest });
    return;
  }
  if (sameLook(current.target, look)) return;
  clearTimeout(settleTimer);
  cancelAnimation(current.progress);
  const id = current.id + 1;
  if (!animate) {
    publish({ id, target: look, base: 1, leaving: [], origin: null, progress: atRest });
    return;
  }

  // How strongly each look shows right now.
  const p = settledMorph(current) ? 1 : current.progress.value;
  const showing: Leaving[] = [
    ...current.leaving.map((layer) => ({ look: layer.look, from: layer.from * (1 - p) })),
    { look: current.target, from: current.base + (1 - current.base) * p },
  ];
  const base = Math.min(
    1,
    showing.filter((layer) => sameLook(layer.look, look)).reduce((sum, l) => sum + l.from, 0),
  );
  const leaving: Leaving[] = [];
  for (const layer of showing) {
    if (sameLook(layer.look, look) || layer.from < faintest) continue;
    const twin = leaving.find((entry) => sameLook(entry.look, layer.look));
    if (twin) leaving.splice(leaving.indexOf(twin), 1, { ...twin, from: twin.from + layer.from });
    else leaving.push(layer);
  }

  // The stickers set off from wherever they are now.
  const { width, height } = Dimensions.get('window');
  const ends = posesFor(current.target, width, height);
  const starts = current.origin ?? ends;
  const origin = ends.map((end, i) => {
    const start = starts[i] ?? end;
    return {
      x: start.x + (end.x - start.x) * p,
      y: start.y + (end.y - start.y) * p,
      rotate: start.rotate + (end.rotate - start.rotate) * p,
    };
  });

  const progress = makeMutable(0);
  publish({ id, target: look, base, leaving: leaving.slice(-3), origin, progress });
  progress.value = withTiming(1, morphTiming);
  // An update to a view out of sight can be dropped, so the end is committed outright.
  settleTimer = setTimeout(() => {
    if (morph?.id === id) publish({ ...morph, base: 1, leaving: [], origin: null });
  }, morphTiming.duration + settleMargin);
}

/**
 * The blobs' slow breath, one for every screen, so a screen coming into view breathes in step
 * with the one before it instead of starting its own breath over.
 */
const breath = makeMutable(0);
let breathing = false;

function startBreathing() {
  if (breathing) return;
  breathing = true;
  breath.value = withRepeat(
    withTiming(1, {
      duration: tokens.motion.duration.ambientLoop,
      easing: Easing.inOut(Easing.sin),
    }),
    -1,
    true,
  );
}

/**
 * Behind every screen: two or three huge, soft, warm blobs drifting on a slow loop, a price-gun
 * print, and a few cut-paper stickers stuck along the edges, all in the place's colour. When the
 * screen changes, the stickers travel to their new spots and change shape on the way, and the
 * print and blobs change colour and reach in place, so the backdrop moves as one piece.
 */
/**
 * Shared backdrops are a web arrangement (see the web file); the apps' native navigators keep each
 * screen's own, kept in step by the shared change of look above.
 */
export function SharedBackdrop(): null {
  return null;
}

export function useBackdropClaim(
  _mood: AmbientArea | 'none',
  _print: PrintCoverage,
  _enabled: boolean,
): boolean {
  return false;
}

export function AmbientBackdrop({ mood = 'calm', print = 'edges' }: AmbientBackdropProps) {
  if (mood === 'none') return null;
  return <Backdrop mood={mood} print={print} />;
}

function Backdrop({ mood, print }: { readonly mood: AmbientArea; readonly print: PrintCoverage }) {
  const { name } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const own = useMemo(() => ({ mood, print }), [mood, print]);
  const shared = useSyncExternalStore(watch, readMorph, readMorph);

  // A screen can be focused a moment before it's drawn: a tab opened for the first time is still
  // being built. It opens in the look that's showing, and changes into its own only once it has
  // been laid out and stayed in view.
  const [laidOut, setLaidOut] = useState(false);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!focused || !laidOut) {
      setInView(false);
      return;
    }
    // It takes over only once it's drawn and has stayed in view a moment: one passed through on
    // the way to another leaves the backdrop alone, so it changes once, for where you land.
    const settle = setTimeout(() => setInView(true), tokens.motion.duration.backdropSettle);
    return () => clearTimeout(settle);
  }, [focused, laidOut]);

  useEffect(() => {
    if (inView) retarget(own, !reduceMotion);
  }, [inView, own, reduceMotion]);

  useEffect(() => {
    if (focused && !reduceMotion) startBreathing();
  }, [focused, reduceMotion]);

  // A screen being left keeps moving with the change until it's out of sight (a pushed screen
  // slides over it); after that it holds still, so only what can be seen spends frames.
  const [lingering, setLingering] = useState(false);
  useEffect(() => {
    if (focused) {
      setLingering(true);
      return;
    }
    const done = setTimeout(() => setLingering(false), morphTiming.duration + settleMargin);
    return () => clearTimeout(done);
  }, [focused]);

  const current: Morph = shared ?? {
    id: 0,
    target: own,
    base: 1,
    leaving: [],
    origin: null,
    progress: atRest,
  };
  const live = (focused || lingering) && !reduceMotion && !settledMorph(current);
  const view: Morph = live ? current : { ...current, base: 1, leaving: [], origin: null };
  const target = view.target;
  const ends = posesFor(target, width, height);
  const stickerOpacity = tokens.motion.ambient.stickerOpacity[name];

  return (
    <View style={styles.layer} onLayout={() => setLaidOut(true)}>
      <Layers view={view} keyOf={(look) => look.mood}>
        {(look) => <Blobs mood={look.mood} width={width} height={height} />}
      </Layers>
      <Layers view={view} keyOf={(look) => `${look.mood}-${look.print}`}>
        {(look) => <Print look={look} width={width} height={height} />}
      </Layers>

      <View style={[styles.layer, { opacity: stickerOpacity }]}>
        {ends.map((end, index) => (
          <Sticker
            key={index}
            index={index}
            view={view}
            start={view.origin?.[index] ?? end}
            end={end}
          />
        ))}
      </View>
    </View>
  );
}

/** One drawing through a change of look: how strongly it starts, and whether it's leaving. */
interface Layer<T> {
  readonly key: string;
  readonly item: T;
  readonly from: number;
  readonly out: boolean;
}

/**
 * The drawings a change of look needs, each keyed by what it draws: the target fading up from how
 * strongly it already shows, and each look on its way out fading down from its strength. Looks
 * that draw the same thing fold into one. Keyed by what they draw, the drawing on screen when a
 * change begins is the same element that fades out, never torn down and redrawn: a fresh copy
 * shows at the wrong strength for a frame before its fade takes hold, which reads as a flash.
 */
function layersOf<T>(view: Morph, drawn: (look: Look) => { key: string; item: T } | null) {
  const layers: Layer<T>[] = [];
  const add = (look: Look, from: number, out: boolean) => {
    const drawing = drawn(look);
    if (!drawing) return;
    const twin = layers.find((layer) => layer.key === drawing.key);
    if (twin) {
      const merged = { ...twin, from: Math.min(1, twin.from + from), out: twin.out && out };
      layers.splice(layers.indexOf(twin), 1, merged);
    } else layers.push({ key: drawing.key, item: drawing.item, from, out });
  };
  view.leaving.forEach((layer) => add(layer.look, layer.from, true));
  add(view.target, view.base, false);
  // The target draws on top, and a leaving look folded into it fades in with it, not out.
  const target = drawn(view.target)?.key;
  return [
    ...layers.filter((layer) => layer.key !== target),
    ...layers.filter((layer) => layer.key === target).map((layer) => ({ ...layer, out: false })),
  ];
}

function Layers({
  view,
  keyOf,
  children,
}: {
  readonly view: Morph;
  readonly keyOf: (look: Look) => string;
  readonly children: (look: Look) => ReactNode;
}) {
  const layers = layersOf(view, (look) => ({ key: keyOf(look), item: look }));
  const settled = layers.length === 1 && (layers[0]?.from ?? 0) >= 1;
  return (
    <>
      {layers.map((layer) => (
        <Fade
          key={layer.key}
          progress={view.progress}
          from={layer.from}
          out={layer.out}
          still={settled}
          epoch={view.id}
        >
          {children(layer.item)}
        </Fade>
      ))}
    </>
  );
}

/**
 * A layer through the change of look: fading in from `from` to full, or with `out`, from `from`
 * to nothing. Its plain style starts at the strength the fade starts at, so the frame before the
 * fade takes hold already matches. `still` holds it fully shown with a plain style; the tiny step
 * in that value with each change (`epoch`) makes sure it's sent afresh, so a fade value left on
 * the view by a dropped frame never lingers.
 */
function Fade({
  progress,
  from,
  out = false,
  still = false,
  epoch = 0,
  style = styles.layer,
  children,
}: {
  readonly progress: SharedValue<number>;
  readonly from: number;
  readonly out?: boolean;
  readonly still?: boolean;
  readonly epoch?: number;
  readonly style?: ViewStyle;
  readonly children: ReactNode;
}) {
  const fade = useAnimatedStyle(() => ({
    opacity: out ? from * (1 - progress.value) : from + (1 - from) * progress.value,
  }));
  const plain = { opacity: still ? 1 - (epoch % 2) * 0.001 : from };
  return <Animated.View style={[style, plain, still ? null : fade]}>{children}</Animated.View>;
}

function paperFor(colors: ReturnType<typeof useTheme>['colors'], mood: AmbientArea): string {
  return mood === 'calm' ? colors.kraft : placeColors(colors, mood).fill;
}

function useLookInk(mood: AmbientArea) {
  const { colors } = useTheme();
  if (mood === 'calm') return { print: colors.textPrimary, paper: colors.kraft, light: false };
  const place = placeColors(colors, mood);
  return { print: place.fill, paper: place.fill, light: !place.dark };
}

function Print({
  look,
  width,
  height,
}: {
  readonly look: Look;
  readonly width: number;
  readonly height: number;
}) {
  const { name } = useTheme();
  const ink = useLookInk(look.mood);
  // A light colour (the market's marigold) all but vanishes into light paper, so it's printed
  // heavier there to read as strongly as the others.
  const boost = name === 'light' && ink.light ? 1.6 : 1;
  const opacity = tokens.motion.ambient.printOpacity[look.print][name] * boost;
  return (
    <View style={[styles.layer, { opacity }]}>
      <PrintLayer ink={ink.print} coverage={look.print} width={width} height={height} />
    </View>
  );
}

/**
 * One sticker. It travels from where it was to its spot on this screen, and its old shapes and
 * colours fade into the new one on the way.
 */
function Sticker({
  index,
  view,
  start,
  end,
}: {
  readonly index: number;
  readonly view: Morph;
  readonly start: StickerPose;
  readonly end: StickerPose;
}) {
  const { colors } = useTheme();
  const progress = view.progress;
  const travel = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: start.x + (end.x - start.x) * p },
        { translateY: start.y + (end.y - start.y) * p },
        { rotate: `${start.rotate + (end.rotate - start.rotate) * p}deg` },
      ],
    };
  });
  const layers = layersOf(view, (look) => {
    const at = stickerLayouts[look.mood][index];
    if (!at) return null;
    const ink = paperFor(colors, look.mood);
    return { key: `${at.shape}-${at.size}-${ink}`, item: { shape: at.shape, size: at.size, ink } };
  });
  if (layers.length === 0) return null;
  const moving = view.origin !== null;
  const settled = layers.length === 1 && (layers[0]?.from ?? 0) >= 1;
  // Its plain place is where the travel starts (or, at rest, where it ends), so no frame shows it
  // anywhere else; the step with each change sends it afresh, as with `Fade`.
  const pose = moving ? start : end;
  const nudge = moving ? 0 : (view.id % 2) * 0.01;
  const place = {
    transform: [
      { translateX: pose.x + nudge },
      { translateY: pose.y },
      { rotate: `${pose.rotate}deg` },
    ],
  };
  return (
    <Animated.View style={[styles.point, place, moving ? travel : null]}>
      {layers.map((layer) => (
        <Fade
          key={layer.key}
          progress={progress}
          from={layer.from}
          out={layer.out}
          still={settled}
          epoch={view.id}
          style={styles.point}
        >
          <StickerArt shape={layer.item.shape} size={layer.item.size} ink={layer.item.ink} />
        </Fade>
      ))}
    </Animated.View>
  );
}

function Blobs({
  mood,
  width,
  height,
}: {
  readonly mood: AmbientArea;
  readonly width: number;
  readonly height: number;
}) {
  const { name } = useTheme();
  const tints = tokens.ambient[name][mood];
  const peak = tokens.motion.ambient.peakOpacity[name];
  return (
    <>
      {blobs.map((blob, index) => (
        <Blob
          key={index}
          tint={tints[index] ?? ''}
          peak={peak}
          width={width}
          height={height}
          {...blob}
        />
      ))}
    </>
  );
}

function Blob({
  tint,
  peak,
  width,
  height,
  x,
  y,
  size,
  driftX,
  driftY,
  phase,
}: {
  readonly tint: string;
  readonly peak: number;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly driftX: number;
  readonly driftY: number;
  readonly phase: number;
}) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(phase);
  const diameter = width * size;

  // Each blob drifts on a loop tied to the clock, offset by its phase so they never move in
  // lockstep. Being tied to the clock, a blob built afresh mid-loop (as a backdrop's layers are
  // when a change of look settles) picks up exactly where the one before it was.
  useEffect(() => {
    if (reduceMotion) return;
    const start = (Date.now() / blobDriftPeriod + phase) % 1;
    offset.value = start;
    offset.value = withSequence(
      withTiming(1, { duration: (1 - start) * blobDriftPeriod, easing: Easing.linear }),
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: blobDriftPeriod, easing: Easing.linear }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(offset);
  }, [offset, phase, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const wander = Math.sin(offset.value * Math.PI * 2) * 0.75;
    return {
      opacity: peak * (0.7 + breath.value * 0.3),
      transform: [
        { translateX: width * (x + wander * driftX) },
        { translateY: height * y + width * wander * driftY },
        { scale: 0.92 + breath.value * 0.12 },
      ],
    };
  });

  // One soft disc image, tinted: drawn by the GPU, so a new set costs next to nothing.
  return (
    <Animated.View style={[styles.blob, { width: diameter, height: diameter }, style]}>
      <Image
        source={blobImage}
        resizeMode="stretch"
        style={{ width: diameter, height: diameter, tintColor: tint }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  blob: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // A zero-size anchor at the screen's top left: a sticker is placed by moving it, and draws
  // centred on it.
  point: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  shown: {
    opacity: 1,
  },
});
