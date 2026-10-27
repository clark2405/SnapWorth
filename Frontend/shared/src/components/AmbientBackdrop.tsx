import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Image, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
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

/**
 * The look on screen right now. Each screen's backdrop sits in this look whenever the screen is
 * out of view, so the moment it comes into view it matches what was just there, and then changes
 * into its own: switching screens reads as one backdrop changing, never as a cut.
 */
let shownLook: Look | null = null;
const watchers = new Set<() => void>();

function show(look: Look) {
  if (shownLook && sameLook(shownLook, look)) return;
  shownLook = look;
  watchers.forEach((watcher) => watcher());
}

function watch(watcher: () => void) {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

const readShownLook = () => shownLook;

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

/**
 * Behind every screen: two or three huge, soft, warm blobs drifting on a slow loop, a price-gun
 * print, and a few cut-paper stickers stuck along the edges, all in the place's colour. When the
 * screen changes, the stickers travel to their new spots and change shape on the way, and the
 * print and blobs change colour and reach in place, so the backdrop moves as one piece.
 */
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
  const shown = useSyncExternalStore(watch, readShownLook, readShownLook);

  // A screen can be focused a moment before it's drawn: a tab opened for the first time is still
  // being built. It only takes over once it has been laid out and a frame has gone by, so the
  // screen being left keeps its own look while it's still in view, and the new one opens in that
  // same look and then changes into its own.
  const [laidOut, setLaidOut] = useState(false);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!focused || !laidOut) {
      setInView(false);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setInView(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [focused, laidOut]);

  // The screen in view sets the look; every other screen follows it, out of sight.
  useEffect(() => {
    if (inView) show(own);
  }, [inView, own]);
  const target = inView || !shown ? own : shown;

  // `from` is the look being left while a morph runs; null once the backdrop has settled.
  const [from, setFrom] = useState<Look | null>(null);
  const [to, setTo] = useState<Look>(target);
  const [origin, setOrigin] = useState<readonly StickerPose[]>(() =>
    posesFor(target, width, height),
  );
  const progress = useSharedValue(1);

  useEffect(() => {
    if (sameLook(target, to)) return;
    // Out of view there's nothing to watch, so a hidden screen just takes the new look; only the
    // screen in view spends frames on the morph.
    if (reduceMotion || !focused) {
      progress.value = 1;
      setFrom(null);
      setTo(target);
      return;
    }
    // A morph cut short starts the next from wherever the stickers had got to, and from
    // whichever look was showing more, so nothing jumps.
    const p = from ? progress.value : 1;
    const fromPoses = posesFor(from ?? to, width, height);
    const toPoses = posesFor(to, width, height);
    setOrigin(
      toPoses.map((end, i) => {
        const start = fromPoses[i] ?? end;
        return {
          x: start.x + (end.x - start.x) * p,
          y: start.y + (end.y - start.y) * p,
          rotate: start.rotate + (end.rotate - start.rotate) * p,
        };
      }),
    );
    setFrom(from && p < 0.5 ? from : to);
    setTo(target);
    progress.value = 0;
    progress.value = withTiming(1, morphTiming);
    // Updates to a screen out of view can be dropped, so the end state is committed outright.
    const settle = setTimeout(() => setFrom(null), morphTiming.duration + settleMargin);
    return () => clearTimeout(settle);
    // Only a new target starts a morph; everything else is read as it stands at that moment.
  }, [target.mood, target.print]);

  // The look being left, while there is one to leave.
  const leaving = from !== null && !sameLook(from, to) ? from : null;
  const breath = useBreath(focused, reduceMotion);
  const destination = posesFor(to, width, height);
  const stickerOpacity = tokens.motion.ambient.stickerOpacity[name];

  return (
    <View style={styles.layer} onLayout={() => setLaidOut(true)}>
      {leaving && leaving.mood !== to.mood ? (
        <Fade progress={progress} out>
          <Blobs mood={leaving.mood} breath={breath} width={width} height={height} />
        </Fade>
      ) : null}
      <Fade progress={progress} still={!leaving || leaving.mood === to.mood} remount>
        <Blobs mood={to.mood} breath={breath} width={width} height={height} />
      </Fade>

      {leaving ? (
        <Fade progress={progress} out>
          <Print look={leaving} width={width} height={height} />
        </Fade>
      ) : null}
      <Fade progress={progress} still={!leaving} remount>
        <Print look={to} width={width} height={height} />
      </Fade>

      <View style={[styles.layer, { opacity: stickerOpacity }]}>
        {destination.map((end, index) => (
          <Sticker
            key={index}
            index={index}
            from={leaving}
            to={to}
            start={origin[index] ?? end}
            end={end}
            progress={progress}
          />
        ))}
      </View>
    </View>
  );
}

/** The slow breath the blobs share; only the screen in view breathes. */
function useBreath(focused: boolean, reduceMotion: boolean) {
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || !focused) return;
    breath.value = withRepeat(
      withTiming(1, {
        duration: tokens.motion.duration.ambientLoop,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath, focused, reduceMotion]);
  return breath;
}

/** A layer fading in with the morph, or out with `out`; `still` holds it fully shown. */
function Fade({
  progress,
  out = false,
  still = false,
  style = styles.layer,
  remount = false,
  children,
}: {
  readonly progress: SharedValue<number>;
  readonly out?: boolean;
  readonly still?: boolean;
  readonly style?: ViewStyle;
  readonly remount?: boolean;
  readonly children: ReactNode;
}) {
  const fade = useAnimatedStyle(() => ({
    opacity: out ? 1 - progress.value : progress.value,
  }));
  // At rest the layer is set fully shown outright, so a dropped animation frame can't leave it
  // part-faded. `remount` goes further and rebuilds it at rest, for layers that are cheap to.
  return (
    <Animated.View
      key={remount ? (still ? 'rest' : 'fading') : undefined}
      style={[style, still ? styles.shown : fade]}
    >
      {children}
    </Animated.View>
  );
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
 * One sticker. It travels from where it was to its spot on this screen, and its old shape and
 * colour fade into the new ones on the way.
 */
function Sticker({
  index,
  from,
  to,
  start,
  end,
  progress,
}: {
  readonly index: number;
  readonly from: Look | null;
  readonly to: Look;
  readonly start: StickerPose;
  readonly end: StickerPose;
  readonly progress: SharedValue<number>;
}) {
  const toSlot = stickerLayouts[to.mood][index];
  const fromSlot = from ? stickerLayouts[from.mood][index] : undefined;
  const toInk = useLookInk(to.mood).paper;
  const fromInk = useLookInk(from?.mood ?? to.mood).paper;
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
  if (!toSlot) return null;
  const rest = {
    transform: [{ translateX: end.x }, { translateY: end.y }, { rotate: `${end.rotate}deg` }],
  };
  const changes =
    fromSlot !== undefined &&
    (fromSlot.shape !== toSlot.shape || fromSlot.size !== toSlot.size || fromInk !== toInk);
  return (
    <Animated.View key={from ? 'travel' : 'rest'} style={[styles.point, from ? travel : rest]}>
      {changes && fromSlot ? (
        <Fade progress={progress} out style={styles.point}>
          <StickerArt shape={fromSlot.shape} size={fromSlot.size} ink={fromInk} />
        </Fade>
      ) : null}
      <Fade progress={progress} still={!changes} style={styles.point} remount>
        <StickerArt shape={toSlot.shape} size={toSlot.size} ink={toInk} />
      </Fade>
    </Animated.View>
  );
}

function Blobs({
  mood,
  breath,
  width,
  height,
}: {
  readonly mood: AmbientArea;
  readonly breath: SharedValue<number>;
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
          breath={breath}
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
  breath,
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
  readonly breath: SharedValue<number>;
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
