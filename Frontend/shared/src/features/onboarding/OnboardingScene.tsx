import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { CountUp, ScallopEdge, Sticker, SWText, Wordmark } from '../../components';
import {
  haptic,
  held,
  placeColors,
  themedStyles,
  tokens,
  useTheme,
  useThemedStyles,
  type Place,
} from '../../design';
import {
  Blob,
  Glyph,
  JacketArt,
  Photographer,
  Plant,
  Thinker,
  Thought,
  Tick,
  Trail,
  Voter,
  tagPath,
  tagSize,
  voterSignAt,
  type GlyphKind,
  type VoterHair,
  type VoterRaise,
} from './onboarding-art';

/**
 * The tour's scene, drawn in design points on a 300 × 380 stage that the tour scales to the
 * screen. Everything follows one number, `p`, the swipe position from 0 to 2, so a swipe scrubs
 * the whole scene under the finger; what happens once a step comes to rest is `arrived`. The
 * jacket card and the price tag are physical: grab them and they answer on the UI thread.
 */
export const stage = { width: 300, height: 380, edge: 372 } as const;
export const places: readonly Place[] = ['feed', 'market', 'history'];

/**
 * The step that came to rest, a count that changes each time one does, and whether this is the
 * first time it has been reached. Each step's moment plays only then: coming back to a step finds
 * it as it was left, not reset and replayed.
 */
export interface Arrival {
  readonly step: number;
  readonly run: number;
  readonly first: boolean;
}

interface SceneProps {
  readonly p: SharedValue<number>;
  /** Design points to screen points. */
  readonly k: number;
  readonly arrived: Arrival;
  readonly reduceMotion: boolean;
  /** The tour's swipe: the card and tag block it while they're held. */
  readonly pager: GestureType;
  /**
   * The first page's entrance, 0 to 1, run as the cover lifts away: the blob grows in, the
   * photographer rises and the wordmark fades in, while the card falls and the doodles pop.
   */
  readonly intro: SharedValue<number>;
}

// ——— Worklet maths ———
const clamp = (v: number, a = 0, b = 1) => {
  'worklet';
  return Math.min(b, Math.max(a, v));
};
const seg = (p: number, a: number, b: number) => {
  'worklet';
  return clamp((p - a) / (b - a));
};
/** Piecewise between the values at steps 0, 1 and 2. */
const at = (p: number, v0: number, v1: number, v2: number) => {
  'worklet';
  return p < 1 ? v0 + (v1 - v0) * clamp(p) : v1 + (v2 - v1) * clamp(p - 1);
};
const easeOut = (t: number) => {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
};
/** A soft overshoot, for doodles popping onto the page. */
const popOut = (t: number) => {
  'worklet';
  const c = 1.6;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
/** One damped-spring step: returns the new value and velocity. */
const springStep = (x: number, v: number, to: number, k: number, c: number, dt: number) => {
  'worklet';
  const nv = v + (-k * (x - to) - c * v) * dt;
  return [x + nv * dt, nv] as const;
};
const frameDt = (ms: number | null) => {
  'worklet';
  return Math.min(0.034, (ms ?? 16) / 1000);
};

/** The jacket's place on each step: centre, scale and lean. */
const heroAt = (p: number) => {
  'worklet';
  return {
    x: at(p, 176, 80, 132),
    y: at(p, 196, 142, 146),
    s: at(p, 0.86, 0.56, 0.62),
    r: at(p, -3, -6, -3),
  };
};

/**
 * Each step's colour block, laid over the last from the right edge as you swipe, scalloped edge
 * and all. Each block keeps its content still while its edge moves, so the wordmark changes
 * colour exactly where the new sheet meets the old.
 */
export function Sheets({
  p,
  width,
  height,
  top,
  skipLabel,
  intro,
}: {
  readonly p: SharedValue<number>;
  readonly width: number;
  readonly height: number;
  /** Where the wordmark row sits, below the status bar. */
  readonly top: number;
  readonly skipLabel?: string;
  readonly intro: SharedValue<number>;
}) {
  return (
    <>
      {places.map((place, index) => (
        <Sheet
          key={place}
          place={place}
          index={index}
          p={p}
          width={width}
          height={height}
          top={top}
          skipLabel={skipLabel}
          intro={intro}
        />
      ))}
    </>
  );
}

function Sheet({
  place,
  index,
  p,
  width,
  height,
  top,
  skipLabel,
  intro,
}: {
  readonly place: Place;
  readonly index: number;
  readonly p: SharedValue<number>;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly skipLabel?: string;
  readonly intro: SharedValue<number>;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const brand = placeColors(colors, place);
  const edge = useAnimatedStyle(() => {
    const left = index === 0 ? 0 : clamp((index - p.value) * width, 0, width);
    return { left, width: width - left };
  });
  const inner = useAnimatedStyle(() => {
    const left = index === 0 ? 0 : clamp((index - p.value) * width, 0, width);
    return { transform: [{ translateX: -left }] };
  });
  const skipStyle = useAnimatedStyle(() => ({ opacity: 1 - seg(p.value, 1.5, 2) }));
  const topStyle = useAnimatedStyle(() => {
    const t = easeOut(seg(intro.value, 0.35, 0.85));
    return { opacity: t, transform: [{ translateY: (1 - t) * -8 }] };
  });
  return (
    <Animated.View style={[styles.sheet, { height: height + 8 }, edge]} pointerEvents="none">
      <Animated.View style={[{ width, height: height + 8 }, inner]}>
        <View style={[styles.sheetFill, { height, backgroundColor: brand.fill }]}>
          <ScallopEdge color={brand.fill} span={width} />
        </View>
        <Animated.View style={[styles.sheetTop, { top }, topStyle]}>
          <Wordmark ink={brand.ink} lensColor={brand.lens} />
          {skipLabel ? (
            <Animated.View style={skipStyle}>
              <SWText variant="label" color={brand.ink}>
                {skipLabel}
              </SWText>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** The whole picture above the copy: drawn in design points, scaled by `k`. */
export function Scene({ p, k, arrived, reduceMotion, pager, intro }: SceneProps) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View
      style={[styles.stage, { transform: [{ scale: k }] }]}
      pointerEvents="box-none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Doodles p={p} arrived={arrived} reduceMotion={reduceMotion} intro={intro} />
      <Crowd p={p} arrived={arrived} reduceMotion={reduceMotion} intro={intro} />
      <PriceTagRig
        p={p}
        k={k}
        arrived={arrived}
        reduceMotion={reduceMotion}
        pager={pager}
        intro={intro}
      />
      <JacketCard
        p={p}
        k={k}
        arrived={arrived}
        reduceMotion={reduceMotion}
        pager={pager}
        intro={intro}
      />
      <StepThreeMarks p={p} arrived={arrived} reduceMotion={reduceMotion} intro={intro} />
    </View>
  );
}

// ——— The jacket card ———

const corners = [
  { key: 'tl', x: -12, y: -12 },
  { key: 'tr', x: 12, y: -12 },
  { key: 'bl', x: -12, y: 12 },
  { key: 'br', x: 12, y: 12 },
] as const;

/**
 * The jacket, drawn on a card cut from the same paper as everything you can hold. It falls into
 * the viewfinder when the tour opens. Grab it to tilt it in 3D; flick it to turn it over. It
 * always springs back face up, its hard shadow staying on the page beneath it.
 */
function JacketCard({ p, k, arrived, reduceMotion, pager, intro }: SceneProps) {
  const styles = useThemedStyles(stylesFor);
  const ax = useSharedValue(0);
  const axV = useSharedValue(0);
  const ay = useSharedValue(0);
  const ayV = useSharedValue(0);
  const ox = useSharedValue(0);
  const oxV = useSharedValue(0);
  const oy = useSharedValue(0);
  const oyV = useSharedValue(0);
  const spin = useSharedValue(0);
  const spinV = useSharedValue(0);
  const spinTo = useSharedValue(0);
  const drop = useSharedValue(0);
  const dropV = useSharedValue(0);
  const tumble = useSharedValue(0);
  const tumbleV = useSharedValue(0);
  const grab = useSharedValue(0);
  const want = useSharedValue<{ ax: number; ay: number; ox: number; oy: number }>({
    ax: 0,
    ay: 0,
    ox: 0,
    oy: 0,
  });
  const press = useSharedValue(0);
  const flash = useSharedValue(0);
  // The frame and the label wait for the first arrival, then lock on and stay.
  const lock = useSharedValue(reduceMotion ? 1 : 0);
  const reveal = useSharedValue(reduceMotion ? 1 : 0);

  useFrameCallback((frame) => {
    const dt = frameDt(frame.timeSincePreviousFrame) / 3;
    const held = grab.value === 1;
    const kk = held ? 700 : 150;
    const cc = held ? 53 : 9;
    const w = want.value;
    for (let i = 0; i < 3; i++) {
      [ax.value, axV.value] = springStep(ax.value, axV.value, held ? w.ax : 0, kk, cc, dt);
      [ay.value, ayV.value] = springStep(ay.value, ayV.value, held ? w.ay : 0, kk, cc, dt);
      [ox.value, oxV.value] = springStep(ox.value, oxV.value, held ? w.ox : 0, kk, cc, dt);
      [oy.value, oyV.value] = springStep(oy.value, oyV.value, held ? w.oy : 0, kk, cc, dt);
      [spin.value, spinV.value] = springStep(spin.value, spinV.value, spinTo.value, 46, 8.5, dt);
      [drop.value, dropV.value] = springStep(drop.value, dropV.value, 0, 170, 11, dt);
      [tumble.value, tumbleV.value] = springStep(tumble.value, tumbleV.value, 0, 120, 11, dt);
    }
  });

  // Arriving: it falls into the frame on the first step, then the shutter fires; on the last
  // step, the stamp presses it into the page.
  useEffect(() => {
    if (!arrived.first) return;
    if (arrived.step === 0) {
      // The photo just taken, arriving as the iris opens: it settles with a small flat spin (not
      // a 3D tumble, which iOS draws with part of the card missing) and develops from white.
      if (!reduceMotion) {
        drop.value = -26;
        dropV.value = 0;
        tumble.value = -7;
        tumbleV.value = 0;
        flash.value = 1;
        flash.value = withTiming(0, { duration: 1000, easing: Easing.out(Easing.quad) });
      }
      lock.value = 0;
      lock.value = withDelay(260, withTiming(1, { duration: reduceMotion ? 1 : 650 }));
      reveal.value = 0;
      reveal.value = withDelay(700, withTiming(1, { duration: reduceMotion ? 1 : 600 }));
    }
    if (arrived.step === 2) {
      press.value = withDelay(
        1070,
        withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 210 })),
      );
    }
  }, [arrived, drop, dropV, flash, lock, press, reduceMotion, reveal, tumble, tumbleV]);

  const pan = Gesture.Pan()
    .blocksExternalGesture(pager)
    .onBegin(() => {
      spin.value += ay.value;
      ay.value = 0;
      grab.value = 1;
    })
    .onUpdate((event) => {
      const s = heroAt(p.value).s * k;
      const dx = event.translationX / s;
      const dy = event.translationY / s;
      want.value = {
        ay: clamp(dx * 0.55, -60, 60),
        ax: clamp(-dy * 0.5, -45, 45),
        ox: dx * 0.28,
        oy: dy * 0.28,
      };
    })
    .onFinalize((event) => {
      if (grab.value === 0) return;
      grab.value = 0;
      spin.value += ay.value;
      ay.value = 0;
      ayV.value = 0;
      // A flick turns it over; it always comes to rest face up.
      spinV.value += (event.velocityX / k) * 0.45;
      axV.value += (-event.velocityY / k) * 0.2;
      spinTo.value = Math.round((spin.value + spinV.value * 0.32) / 360) * 360;
    });

  const place = useAnimatedStyle(() => {
    const h = heroAt(p.value);
    return {
      // Not there until the entrance starts, so it never shows at rest before it falls in.
      opacity: intro.value > 0 ? 1 : 0,
      transform: [
        { translateX: h.x - 78 },
        { translateY: h.y - 98 },
        { scale: h.s },
        { rotate: `${h.r}deg` },
      ],
    };
  });
  const cardStyle = useAnimatedStyle(() => {
    const s = heroAt(p.value).s;
    return {
      transform: [
        { perspective: 700 },
        { translateX: ox.value + (press.value * 4) / s },
        { translateY: oy.value + drop.value + (press.value * 4) / s },
        { rotateX: `${ax.value}deg` },
        { rotateY: `${ay.value + spin.value}deg` },
        { rotate: `${tumble.value}deg` },
      ],
    };
  });
  const shadowStyle = useAnimatedStyle(() => {
    const h = heroAt(p.value);
    const turn = ((ay.value + spin.value) * Math.PI) / 180;
    const lift = Math.max(0, -drop.value) * 0.07 + (Math.abs(ax.value) + Math.abs(ay.value)) * 0.05;
    const depth = (at(p.value, 5, 8, 5) - press.value * 4 + lift) / h.s;
    return {
      // Falling in, the card is high above the page: its shadow is faint and small, and gathers
      // under it as it comes down.
      opacity: 1 - clamp(-drop.value / 260),
      transform: [
        { translateX: depth + ox.value },
        { translateY: depth + oy.value },
        { scale: 1 - clamp(-drop.value / 440) * 0.4 },
        { rotate: `${tumble.value}deg` },
        { scaleX: Math.max(0.04, Math.abs(Math.cos(turn))) },
        { scaleY: Math.max(0.3, Math.cos((ax.value * Math.PI) / 180)) },
      ],
    };
  });
  // Which side faces you, from the turn itself: both platforms flatten the faces into the card
  // before it turns, so a hidden back face can't be left to the renderer.
  const frontStyle = useAnimatedStyle(() => {
    const a = (ax.value * Math.PI) / 180;
    const b = ((ay.value + spin.value) * Math.PI) / 180;
    return { opacity: Math.cos(a) * Math.cos(b) >= 0 ? 1 : 0 };
  });
  const backStyle = useAnimatedStyle(() => {
    const a = (ax.value * Math.PI) / 180;
    const b = ((ay.value + spin.value) * Math.PI) / 180;
    return { opacity: Math.cos(a) * Math.cos(b) >= 0 ? 0 : 1 };
  });
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: clamp((Math.abs(ax.value) + Math.abs(ay.value)) / 35) * 0.28,
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const finderStyle = useAnimatedStyle(() => {
    const out = easeOut(seg(p.value, 0, 0.3));
    return { opacity: 1 - out, transform: [{ scale: 1 + out * 0.12 }] };
  });

  const foundStyle = useAnimatedStyle(() => {
    const out = seg(p.value, 0.02, 0.36);
    return {
      opacity: (1 - out) * reveal.value,
      transform: [
        { translateY: out * 12 + (1 - reveal.value) * 8 },
        { scale: 0.92 + 0.08 * reveal.value },
      ],
    };
  });

  return (
    <>
      <Animated.View style={[styles.hero, place]} pointerEvents="box-none">
        <Animated.View style={[styles.heroShadow, shadowStyle]} />
        {/* Its own layer: iOS depth-sorts 3D siblings, so the flat shadow would cut through it. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
          <GestureDetector gesture={pan}>
            <Animated.View style={[StyleSheet.absoluteFill, cardStyle]}>
              <Animated.View style={[styles.face, styles.front, frontStyle]}>
                <JacketArt width={152} height={192} />
                <Animated.View style={[styles.sheen, sheenStyle]} />
                <Animated.View style={[styles.capture, flashStyle]} />
              </Animated.View>
              <Animated.View style={[styles.face, styles.back, backStyle]}>
                <View>
                  <SWText variant="stamp" style={styles.backInk}>
                    Snapped
                  </SWText>
                  <SWText variant="priceLarge" style={styles.backInk}>
                    9:41
                  </SWText>
                </View>
                <SWText variant="labelSmall" style={styles.backInk}>
                  Nike windbreaker{'\n'}90s · teal and purple
                </SWText>
                <SWText variant="stamp" style={styles.backInk}>
                  snapworth · fair prices
                </SWText>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </View>
        <Animated.View style={[styles.finder, finderStyle]} pointerEvents="none">
          {corners.map((corner) => (
            <Corner key={corner.key} corner={corner} lock={lock} />
          ))}
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.foundSpot, foundStyle]} pointerEvents="none">
        <View style={styles.chip}>
          <View style={styles.lens}>
            <View style={styles.lensDot} />
          </View>
          <SWText variant="labelSmall">
            Nike windbreaker{' '}
            <SWText variant="labelSmall" tone="textSecondary">
              90s
            </SWText>
          </SWText>
        </View>
      </Animated.View>
    </>
  );
}

function Corner({
  corner,
  lock,
}: {
  readonly corner: (typeof corners)[number];
  readonly lock: SharedValue<number>;
}) {
  const styles = useThemedStyles(stylesFor);
  const style = useAnimatedStyle(() => ({
    opacity: lock.value,
    transform: [
      { translateX: corner.x * (1 - easeOut(lock.value)) },
      { translateY: corner.y * (1 - easeOut(lock.value)) },
    ],
  }));
  return <Animated.View style={[styles.bracket, styles[corner.key], style]} />;
}

// ——— The price tag ———

const AnimatedPath = Animated.createAnimatedComponent(Path);
const rest = { x: 206, length: 128 } as const;

/**
 * The fair range on a kraft tag cut in Worthy's outline, hung on a string from above. As you
 * arrive the string is lowered and the tag drops, goes taut with a bounce and swings. Pull it,
 * fling it to spin it round on its string, throw it: gravity and the string bring it back.
 */
function PriceTagRig({ p, k, arrived, reduceMotion, pager }: SceneProps) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const x = useSharedValue<number>(rest.x);
  const y = useSharedValue(-320);
  const vx = useSharedValue(0);
  const vy = useSharedValue(0);
  const rz = useSharedValue(0);
  const rzV = useSharedValue(0);
  const phi = useSharedValue(0);
  const phiV = useSharedValue(0);
  const tx = useSharedValue(0);
  const txV = useSharedValue(0);
  const grab = useSharedValue(0);
  const grabAt = useSharedValue<{ x: number; y: number }>({ x: 0, y: 0 });
  const anchor = useSharedValue<{ x: number; y: number }>({ x: rest.x, y: -370 });
  const touched = useSharedValue(0);
  const hint = useSharedValue(0);
  // The price sits at zero, the line undrawn and the sticker off until the tag first arrives.
  const roll = useSharedValue(reduceMotion ? 1 : 0);
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const slap = useSharedValue(reduceMotion ? 1 : 0);

  useFrameCallback((frame) => {
    const dt = frameDt(frame.timeSincePreviousFrame) / 3;
    const away = easeOut(seg(Math.abs(p.value - 1), 0, 0.55));
    const ax = rest.x + clamp(1 - p.value, 0, 1) * 36;
    const ay = -10 - away * 380;
    anchor.value = { x: ax, y: ay };
    const held = grab.value === 1;
    const L = rest.length;
    for (let i = 0; i < 3; i++) {
      if (held) {
        x.value = grabAt.value.x;
        y.value = grabAt.value.y;
      } else {
        vy.value += 2300 * dt;
        const damp = Math.exp(-1.7 * dt);
        vx.value *= damp;
        vy.value *= damp;
        x.value += vx.value * dt;
        y.value += vy.value * dt;
      }
      // The string holds it, with a little give; a taut string takes the outward speed away.
      const dx = x.value - ax;
      const dy = y.value - ay;
      const d = Math.hypot(dx, dy) || 1;
      const max = held ? L * 1.45 : L;
      if (d > max) {
        const nx = dx / d;
        const ny = dy / d;
        const give = held ? 0 : (d - max) * 0.1;
        x.value = ax + nx * (max + give);
        y.value = ay + ny * (max + give);
        const vr = vx.value * nx + vy.value * ny;
        if (vr > 0 && !held) {
          vx.value -= nx * vr * 1.5;
          vy.value -= ny * vr * 1.5;
        }
      }
      const along = d > L * 0.9 ? (-Math.atan2(dx, dy) * 180) / Math.PI : rz.value;
      [rz.value, rzV.value] = springStep(rz.value, rzV.value, along, 170, 15, dt);
      [phi.value, phiV.value] = springStep(phi.value, phiV.value, 0, 8, 1.1, dt);
      [tx.value, txV.value] = springStep(tx.value, txV.value, 0, 90, 5, dt);
    }
  });

  useEffect(() => {
    if (arrived.step !== 1 || !arrived.first) return;
    const quick = reduceMotion ? 1 : undefined;
    roll.value = 0;
    roll.value = withDelay(160, withTiming(1, { duration: quick ?? 1500, easing: Easing.linear }));
    draw.value = 0;
    draw.value = withDelay(
      380,
      withTiming(1, { duration: quick ?? 1100, easing: Easing.inOut(Easing.cubic) }),
    );
    slap.value = 0;
    slap.value = withDelay(
      1500,
      withTiming(1, { duration: quick ?? 260, easing: Easing.in(Easing.quad) }),
    );
    hint.value = withDelay(1900, withTiming(1, { duration: 400 }));
  }, [arrived, draw, hint, reduceMotion, roll, slap]);

  const pan = Gesture.Pan()
    .blocksExternalGesture(pager)
    .onBegin(() => {
      grab.value = 1;
      touched.value = 1;
      grabAt.value = { x: x.value, y: y.value };
    })
    .onChange((event) => {
      grabAt.value = {
        x: grabAt.value.x + event.changeX / k,
        y: grabAt.value.y + event.changeY / k,
      };
      // Dragging sideways twists it on its string as it goes.
      phiV.value += (event.changeX / k) * 0.02;
    })
    .onFinalize((event) => {
      if (grab.value === 0) return;
      grab.value = 0;
      vx.value = event.velocityX / k;
      vy.value = event.velocityY / k;
      phiV.value += (event.velocityX / k) * 0.0065;
      txV.value += (-event.velocityY / k) * 0.06;
    });

  const stringProps = useAnimatedProps(() => {
    const a = anchor.value;
    const d = Math.hypot(x.value - a.x, y.value - a.y);
    const sag = Math.sqrt(Math.max(0, rest.length * rest.length - d * d)) * 0.55;
    return {
      d: `M${a.x} ${a.y} Q ${(a.x + x.value) / 2} ${(a.y + y.value) / 2 + sag} ${x.value} ${y.value}`,
    };
  });
  const visible = useAnimatedStyle(() => ({ opacity: Math.abs(p.value - 1) < 1 ? 1 : 0 }));
  const tagStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value - tagSize.eyeletX },
      { translateY: y.value - tagSize.eyeletY },
      { perspective: 800 },
      { rotate: `${rz.value}deg` },
      { rotateY: `${phi.value}rad` },
      { rotateX: `${tx.value}deg` },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => {
    const t = (tx.value * Math.PI) / 180;
    const lift = 4 + Math.abs(Math.sin(t)) * 12;
    return {
      transform: [
        { translateX: x.value - tagSize.eyeletX + lift },
        { translateY: y.value - tagSize.eyeletY + lift },
        { rotate: `${rz.value}deg` },
        { scaleX: Math.max(0.03, Math.abs(Math.cos(phi.value))) },
        { scaleY: Math.max(0.2, Math.cos(t)) },
      ],
    };
  });
  const frontStyle = useAnimatedStyle(() => ({
    opacity: Math.cos(phi.value) * Math.cos((tx.value * Math.PI) / 180) >= 0 ? 1 : 0,
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: Math.cos(phi.value) * Math.cos((tx.value * Math.PI) / 180) >= 0 ? 0 : 1,
  }));
  const shadeStyle = useAnimatedStyle(() => ({
    opacity:
      (1 - Math.abs(Math.cos(phi.value))) * 0.38 +
      Math.max(0, Math.sin((tx.value * Math.PI) / 180)) * 0.12,
  }));
  const hintStyle = useAnimatedStyle(() => {
    const a = anchor.value;
    return {
      opacity: hint.value * (1 - touched.value) * (Math.abs(p.value - 1) < 0.1 ? 1 : 0),
      transform: [
        { translateX: clamp(a.x - 150, -60, 0) + 14 },
        { translateY: a.y + rest.length + 160 },
      ],
    };
  });
  const trendStyle = useAnimatedStyle(() => ({
    opacity: slap.value,
    transform: [{ rotate: `${-12 + 7 * slap.value}deg` }, { scale: 1.5 - 0.5 * slap.value }],
  }));

  const face = (
    <Svg width={tagSize.width} height={tagSize.height} style={StyleSheet.absoluteFill}>
      <Path
        d={tagPath}
        fill={colors.kraft}
        stroke={colors.heldEdge}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle
        cx={tagSize.eyeletX}
        cy={tagSize.eyeletY}
        r={7}
        fill={colors.canvas}
        stroke={colors.kraftEdge}
        strokeWidth={2.2}
      />
    </Svg>
  );
  const shade = (
    <Animated.View style={[StyleSheet.absoluteFill, shadeStyle]} pointerEvents="none">
      <Svg width={tagSize.width} height={tagSize.height}>
        <Path d={tagPath} fill={colors.heldEdge} />
      </Svg>
    </Animated.View>
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, visible]} pointerEvents="box-none">
      <Svg
        width={stage.width}
        height={stage.height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <AnimatedPath
          animatedProps={stringProps}
          fill="none"
          stroke={colors.heldEdge}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
      <Animated.View style={[styles.tagBox, shadowStyle]} pointerEvents="none">
        <Svg width={tagSize.width} height={tagSize.height}>
          <Path d={tagPath} fill={colors.heldShadow} />
        </Svg>
      </Animated.View>
      {/* Its own layer: iOS depth-sorts 3D siblings, so the flat shadow would cut through it. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.tagBox, tagStyle]}>
            <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
              {face}
              <View style={styles.tagContent}>
                <SWText variant="stamp" color={colors.kraftInk}>
                  Fair range
                </SWText>
                <Odometer value="₱2,100" roll={roll} delay={0} />
                <SWText variant="stamp" color={colors.kraftInk} style={styles.to}>
                  to
                </SWText>
                <Odometer value="₱2,850" roll={roll} delay={0.08} />
                <Spark draw={draw} />
              </View>
              <Animated.View style={[styles.trend, trendStyle]}>
                <Sticker label="↑ 12%" tone="cobalt" side="start" />
              </Animated.View>
              {shade}
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.tagBack, backStyle]}>
              {face}
              <View style={[styles.tagContent, styles.tagBackContent]}>
                <SWText variant="stamp" color={colors.kraftInk}>
                  SnapWorth
                </SWText>
                <Barcode color={colors.kraftInk} />
                <SWText variant="caption" color={colors.kraftInk}>
                  AI estimate
                </SWText>
                <SWText variant="caption" color={colors.kraftInk}>
                  Nike · 90s · teal
                </SWText>
                <SWText variant="stamp" color={colors.kraftInk} align="center" style={styles.motto}>
                  {'Fair price,\nfairly found'}
                </SWText>
              </View>
              {shade}
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
      <Animated.View style={[styles.hintSpot, hintStyle]} pointerEvents="none">
        <View style={styles.hint}>
          <SWText variant="stamp">Grab it · give it a spin</SWText>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const digitHeight = 26;
const strip = Array.from({ length: 20 }, (_, index) => index % 10);

/** A price that rolls up digit by digit, the way a counter does. */
function Odometer({
  value,
  roll,
  delay,
}: {
  readonly value: string;
  readonly roll: SharedValue<number>;
  readonly delay: number;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  let digit = 0;
  return (
    <View style={styles.odometer}>
      {[...value].map((char, index) => {
        if (!/\d/.test(char)) {
          return (
            <SWText
              key={index}
              variant="priceMedium"
              color={colors.kraftInk}
              style={styles.digitText}
            >
              {char}
            </SWText>
          );
        }
        digit += 1;
        return <Digit key={index} value={Number(char)} roll={roll} delay={delay + digit * 0.04} />;
      })}
    </View>
  );
}

function Digit({
  value,
  roll,
  delay,
}: {
  readonly value: number;
  readonly roll: SharedValue<number>;
  readonly delay: number;
}) {
  const styles = useThemedStyles(stylesFor);
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -digitHeight * (10 + value) * easeOut(seg(roll.value, delay, delay + 0.7)) },
    ],
  }));
  return (
    <View style={styles.digit}>
      <Animated.View style={style}>
        {strip.map((n, index) => (
          <SWText
            key={index}
            variant="priceMedium"
            color={colors.kraftInk}
            style={styles.digitText}
          >
            {n}
          </SWText>
        ))}
      </Animated.View>
    </View>
  );
}

/** The trend line, drawing itself. */
function Spark({ draw }: { readonly draw: SharedValue<number> }) {
  const { colors } = useTheme();
  const props = useAnimatedProps(() => ({ strokeDashoffset: 110 * (1 - draw.value) }));
  const end = useAnimatedProps(() => ({ r: 3 * seg(draw.value, 0.85, 1) }));
  return (
    <Svg
      width={92}
      height={22}
      viewBox="0 0 92 22"
      style={{ marginTop: tokens.spacing[2], overflow: 'visible' }}
    >
      <AnimatedPath
        animatedProps={props}
        d="M0 19 C 8 18, 12 20, 18 16 S 30 13, 36 14 S 47 10, 54 11 S 66 7, 72 7 S 84 3, 90 2"
        fill="none"
        stroke={colors.kraftInk}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeDasharray={[110, 110]}
      />
      <AnimatedCircle animatedProps={end} cx={90} cy={2} fill={colors.kraftInk} />
    </Svg>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const bars = [2, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2];

function Barcode({ color }: { readonly color: string }) {
  let left = 0;
  return (
    <Svg width={84} height={30} style={{ marginVertical: tokens.spacing[2] }}>
      {bars.map((w, index) => {
        const rect = <Rect key={index} x={left} width={w} height={30} fill={color} />;
        left += w + 2;
        return rect;
      })}
    </Svg>
  );
}

// ——— People ———

interface PersonSpec {
  readonly key: string;
  readonly step: number;
  readonly x: number;
  readonly y: number;
  readonly h: number;
  readonly art: ReactNode;
  readonly vote?: {
    readonly raise: VoterRaise;
    readonly big: string;
    readonly small: string;
    readonly rot: number;
    readonly pick?: boolean;
  };
}

function voter(
  key: string,
  x: number,
  y: number,
  look: {
    skin: 'light' | 'tan' | 'deep';
    hair: VoterHair;
    shirt: 'marigold' | 'red' | 'cream';
    pattern: 'dots' | 'tris' | 'stripes';
    tilt: number;
  },
  vote: NonNullable<PersonSpec['vote']>,
): PersonSpec {
  return {
    key,
    step: 2,
    x,
    y,
    h: 150,
    art: <Voter {...look} raise={vote.raise} />,
    vote,
  };
}

const people: readonly PersonSpec[] = [
  { key: 'photographer', step: 0, x: -10, y: 150, h: 232, art: <Photographer /> },
  { key: 'thinker', step: 1, x: -10, y: 176, h: 200, art: <Thinker /> },
  voter(
    'high',
    -10,
    250,
    { skin: 'light', hair: 'short', shirt: 'marigold', pattern: 'stripes', tilt: -6 },
    { raise: 'right', big: '12', small: 'Too high', rot: -6 },
  ),
  voter(
    'low',
    200,
    250,
    { skin: 'tan', hair: 'curly', shirt: 'red', pattern: 'tris', tilt: 5 },
    { raise: 'left', big: '4', small: 'Too low', rot: 5 },
  ),
  // Drawn last so the community's pick sits in front.
  voter(
    'pick',
    98,
    256,
    { skin: 'deep', hair: 'long', shirt: 'cream', pattern: 'dots', tilt: 0 },
    { raise: 'both', big: '✓ Just right', small: 'votes', rot: 2, pick: true },
  ),
];

/** People rise from behind each sheet's scalloped edge as you arrive, and sink back as you leave. */
function Crowd({ p, arrived, reduceMotion, intro }: Omit<SceneProps, 'k' | 'pager'>) {
  const styles = useThemedStyles(stylesFor);
  return (
    <View style={styles.crowd} pointerEvents="none">
      {people.map((person, index) => (
        <Person
          key={person.key}
          person={person}
          index={index}
          p={p}
          arrived={arrived}
          reduceMotion={reduceMotion}
          intro={intro}
        />
      ))}
    </View>
  );
}

function Person({
  person,
  index,
  p,
  arrived,
  reduceMotion,
  intro,
}: {
  readonly person: PersonSpec;
  readonly index: number;
  readonly p: SharedValue<number>;
  readonly arrived: Arrival;
  readonly reduceMotion: boolean;
  readonly intro: SharedValue<number>;
}) {
  const styles = useThemedStyles(stylesFor);
  const hop = useSharedValue(0);
  const { step } = person;
  // The pick's tally counts up once, on the first arrival at the votes.
  const countRun = useRef(0);
  if (arrived.step === 2 && arrived.first) countRun.current = arrived.run;
  const lift = person.vote?.pick ? 14 : 6;

  useEffect(() => {
    if (arrived.step !== step || !arrived.first || reduceMotion) return;
    const delay = step === 0 ? 760 : step === 2 ? 150 + (index - 2) * 120 : 0;
    if (step === 1) return;
    hop.value = 0;
    hop.value = withDelay(delay, withTiming(1, { duration: step === 0 ? 420 : 560 }));
  }, [arrived, hop, index, reduceMotion, step]);

  const place = useAnimatedStyle(() => {
    // The first page's people wait behind the edge until the cover lifts.
    const swiped = clamp(1 - Math.abs(p.value - step));
    const near = step === 0 ? Math.min(swiped, seg(intro.value, 0.15, 0.7)) : swiped;
    const up = easeOut(seg(near, 0.25 + (index % 3) * 0.06, 1));
    return {
      opacity: near > 0 ? 1 : 0,
      transform: [
        { translateX: person.x + (step - p.value) * stage.width * 0.35 },
        { translateY: person.y + (1 - up) * (person.h + 20) },
      ],
    };
  });
  const bob = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.sin(hop.value * Math.PI) * lift }],
  }));

  const vote = person.vote;
  const [sx, sy] = vote ? voterSignAt[vote.raise] : [0, 0];
  return (
    <Animated.View style={[styles.person, place]}>
      <Animated.View style={bob}>
        {person.art}
        {vote ? (
          <View style={[styles.signSpot, { left: sx - 70, top: sy - 70 }]}>
            <View
              style={[
                styles.sign,
                vote.pick ? styles.signPick : null,
                { transform: [{ rotate: `${vote.rot}deg` }] },
              ]}
            >
              <SWText
                variant="headingMedium"
                style={vote.pick ? styles.signPickText : styles.signBig}
              >
                {vote.big}
              </SWText>
              {vote.pick ? (
                <SWText variant="caption" style={styles.signSmall}>
                  <CountUp
                    key={countRun.current}
                    variant="caption"
                    value={38}
                    from={30}
                    format={String}
                  />{' '}
                  {vote.small}
                </SWText>
              ) : (
                <SWText variant="caption" tone="textSecondary" style={styles.signSmall}>
                  {vote.small}
                </SWText>
              )}
            </View>
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

// ——— Doodles and props ———

interface Mark {
  readonly key: string;
  readonly step: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rot: number;
  readonly depth: number;
  /** A blob behind a scene: it grows in rather than popping, and barely moves. */
  readonly back?: boolean;
  readonly node: ReactNode;
}

function useMarks(): readonly Mark[] {
  const { colors } = useTheme();
  const light = tokens.illustration.light;
  const glyph = (
    step: number,
    kind: GlyphKind,
    x: number,
    y: number,
    size: number,
    rot: number,
    depth: number,
    color: string,
  ): Mark => ({
    key: `${step}-${kind}-${x}-${y}`,
    step,
    x,
    y,
    w: 40,
    h: 40,
    rot,
    depth,
    node: <Glyph kind={kind} color={color} size={size} />,
  });
  return [
    {
      key: 'blob-0',
      step: 0,
      x: 172,
      y: 204,
      w: 250,
      h: 220,
      rot: 0,
      depth: 0.25,
      back: true,
      node: <Blob width={250} height={220} />,
    },
    {
      key: 'blob-1',
      step: 1,
      x: 150,
      y: 206,
      w: 260,
      h: 226,
      rot: 0,
      depth: 0.25,
      back: true,
      node: <Blob width={260} height={226} />,
    },
    {
      key: 'blob-2',
      step: 2,
      x: 150,
      y: 200,
      w: 250,
      h: 220,
      rot: 0,
      depth: 0.25,
      back: true,
      node: <Blob width={250} height={220} />,
    },
    { key: 'plant', step: 0, x: 274, y: 326, w: 60, h: 100, rot: 0, depth: 0.55, node: <Plant /> },
    {
      key: 'trail',
      step: 0,
      x: 60,
      y: 84,
      w: 90,
      h: 60,
      rot: 0,
      depth: 0.7,
      node: <Trail color={light} />,
    },
    {
      key: 'thought',
      step: 1,
      x: 104,
      y: 224,
      w: 54,
      h: 38,
      rot: 0,
      depth: 0.5,
      node: <Thought text="₱?" />,
    },
    {
      key: 'tick',
      step: 2,
      x: 276,
      y: 112,
      w: 26,
      h: 26,
      rot: 0,
      depth: 0.8,
      node: <Tick color={light} />,
    },
    glyph(0, 'sparkle', 250, 112, 1.2, 12, 0.5, light),
    glyph(0, 'sparkle', 84, 112, 0.75, -8, 0.8, colors.marigold),
    glyph(0, 'plus', 268, 214, 1, 0, 0.9, colors.marigold),
    glyph(0, 'ring', 30, 120, 1, 0, 0.6, light),
    glyph(0, 'dot', 282, 156, 1, 0, 1.1, colors.marigold),
    glyph(0, 'coin', 248, 262, 1, -12, 0.7, light),
    glyph(1, 'coin', 150, 96, 0.8, 14, 0.9, light),
    glyph(1, 'arrow', 136, 214, 1, 8, 0.7, colors.cobalt),
    glyph(1, 'plus', 22, 120, 1, 0, 1, colors.cobalt),
    glyph(1, 'sparkle', 284, 300, 0.9, 0, 0.8, light),
    glyph(1, 'dot', 284, 112, 1, 0, 1.1, colors.heldEdge),
    glyph(1, 'squiggle', 236, 334, 1, 6, 0.9, colors.cobalt),
    glyph(2, 'sparkle', 52, 104, 1.1, -6, 0.6, colors.marigold),
    glyph(2, 'sparkle', 268, 196, 0.85, 10, 0.9, light),
    glyph(2, 'plus', 270, 150, 1, 0, 0.8, light),
    glyph(2, 'ring', 32, 170, 1, 0, 1, colors.marigold),
    glyph(2, 'dot', 214, 82, 1, 0, 1.1, light),
  ];
}

/** Doodles drift in with their sheet, each at its own depth, bob a little, and pop on arrival. */
function Doodles({ p, arrived, reduceMotion, intro }: Omit<SceneProps, 'k' | 'pager'>) {
  const styles = useThemedStyles(stylesFor);
  const marks = useMarks();
  const clock = useSharedValue(0);
  // Hidden until their step is first reached; then they pop in once and stay.
  const hidden = reduceMotion ? 1 : 0;
  const pops = [useSharedValue(hidden), useSharedValue(hidden), useSharedValue(hidden)] as const;

  useFrameCallback((frame) => {
    if (!reduceMotion) clock.value += frameDt(frame.timeSincePreviousFrame);
  });

  useEffect(() => {
    const pop = pops[arrived.step];
    if (!pop || !arrived.first) return;
    cancelAnimation(pop);
    pop.value = 0;
    pop.value = withDelay(
      180,
      withTiming(1, { duration: reduceMotion ? 1 : 1100, easing: Easing.linear }),
    );
  }, [arrived, reduceMotion]);

  // Each step's doodles pop one after another, in the order they're listed.
  const seen = [0, 0, 0];
  return (
    <View style={styles.doodles} pointerEvents="none">
      {marks.map((mark, index) => {
        const slot = mark.back ? 0 : (seen[mark.step] = (seen[mark.step] ?? 0) + 1);
        return (
          <Doodle
            key={mark.key}
            mark={mark}
            phase={index * 0.73}
            slot={slot}
            p={p}
            clock={clock}
            pop={pops[mark.step] ?? pops[0]}
            intro={intro}
          />
        );
      })}
    </View>
  );
}

function Doodle({
  mark,
  phase,
  slot,
  p,
  clock,
  pop,
  intro,
}: {
  readonly mark: Mark;
  readonly phase: number;
  readonly slot: number;
  readonly p: SharedValue<number>;
  readonly clock: SharedValue<number>;
  readonly pop: SharedValue<number>;
  readonly intro: SharedValue<number>;
}) {
  const styles = useThemedStyles(stylesFor);
  const style = useAnimatedStyle(() => {
    const d = p.value - mark.step;
    const near = clamp(1 - Math.abs(d) * 1.6);
    const bob = Math.sin(clock.value * 1.3 + phase) * 3;
    const wob = mark.back ? 0 : Math.sin(clock.value * 0.9 + phase) * 4;
    const start = 0.05 * (slot - 1);
    const t = mark.back ? 1 : seg(pop.value, start, start + 0.45);
    // The first page's blob grows in as the cover lifts; later ones grow with the swipe.
    const enter = mark.step === 0 ? easeOut(seg(intro.value, 0, 0.6)) : 1;
    const grow = mark.back ? (0.85 + 0.15 * near) * (0.6 + 0.4 * enter) : popOut(t);
    return {
      opacity: near * (mark.back ? enter : 1),
      transform: [
        { translateX: mark.x - mark.w / 2 - d * stage.width * mark.depth },
        { translateY: mark.y - mark.h / 2 + (mark.back ? bob * 0.4 : bob) },
        { rotate: `${mark.rot + wob - (1 - t) * 40}deg` },
        { scale: grow },
      ],
    };
  });
  return (
    <Animated.View style={[styles.doodle, { width: mark.w, height: mark.h }, style]}>
      {mark.node}
    </Animated.View>
  );
}

// ——— The last step's marks on the card ———

/** "Listed at" settles onto the card's corner, and the price-gun stamp comes down once. */
function StepThreeMarks({ p, arrived, reduceMotion }: Omit<SceneProps, 'k' | 'pager'>) {
  const styles = useThemedStyles(stylesFor);
  const stamp = useSharedValue(0);

  useEffect(() => {
    if (arrived.step !== 2 || !arrived.first) return;
    stamp.value = 0;
    stamp.value = withDelay(
      900,
      withTiming(1, { duration: reduceMotion ? 1 : 170, easing: Easing.in(Easing.quad) }),
    );
    const thud = setTimeout(() => haptic('heavy'), reduceMotion ? 0 : 1070);
    return () => clearTimeout(thud);
  }, [arrived, reduceMotion, stamp]);

  const listedStyle = useAnimatedStyle(() => {
    const h = heroAt(p.value);
    const t = easeOut(seg(p.value, 1.55, 2));
    return {
      opacity: t,
      transform: [
        { translateX: h.x + 46 * h.s },
        { translateY: h.y - 84 * h.s + (1 - t) * 14 },
        { rotate: '5deg' },
      ],
    };
  });
  const stampStyle = useAnimatedStyle(() => {
    const h = heroAt(p.value);
    return {
      opacity: p.value > 1.75 ? stamp.value : 0,
      transform: [
        { translateX: h.x - 80 },
        { translateY: h.y - 12 },
        { rotate: '-9deg' },
        { scale: 1 + (1 - stamp.value) * 0.9 },
      ],
    };
  });

  return (
    <>
      <Animated.View style={[styles.listed, listedStyle]} pointerEvents="none">
        <SWText variant="stamp" tone="textSecondary">
          Listed at
        </SWText>
        <SWText variant="priceSmall">₱2,450</SWText>
      </Animated.View>
      <Animated.View style={[styles.stampSpot, stampStyle]} pointerEvents="none">
        <View style={styles.stamp}>
          <SWText variant="stamp" tone="accent">
            Priced right
          </SWText>
        </View>
      </Animated.View>
    </>
  );
}

const bracket = 26;
const stroke = 3;

const stylesFor = themedStyles((colors) => ({
  sheet: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  sheetFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  sheetTop: {
    position: 'absolute',
    left: tokens.layout.pageGutterCompact - 2,
    right: tokens.layout.pageGutterCompact - 2,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: stage.width,
    height: stage.height,
    transformOrigin: 'top left',
  },
  hero: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 156,
    height: 196,
  },
  heroShadow: {
    ...StyleSheet.absoluteFill,
    borderRadius: tokens.radius.large,
    backgroundColor: colors.heldShadow,
  },
  face: {
    ...StyleSheet.absoluteFill,
    borderRadius: tokens.radius.large,
    borderWidth: 2,
    borderColor: colors.heldEdge,
    overflow: 'hidden',
  },
  front: {
    backgroundColor: tokens.illustration.cardStock,
  },
  back: {
    backgroundColor: colors.kraft,
    padding: tokens.spacing[4],
    justifyContent: 'space-between',
    // Drawn mirrored, so it reads true once the card has turned over. Faces aren't hidden by
    // facing away: iOS flattens them into the card before it turns, so a hidden back face would
    // already count as facing away and the card would show nothing but its shadow.
    transform: [{ scaleX: -1 }],
  },
  backInk: {
    color: colors.kraftInk,
  },
  sheen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tokens.illustration.light,
  },
  capture: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tokens.overlay.text,
  },
  finder: {
    position: 'absolute',
    top: -14,
    right: -14,
    bottom: -14,
    left: -14,
  },
  bracket: {
    position: 'absolute',
    width: bracket,
    height: bracket,
    borderColor: tokens.overlay.text,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: stroke,
    borderLeftWidth: stroke,
    borderTopLeftRadius: 14,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: stroke,
    borderRightWidth: stroke,
    borderTopRightRadius: 14,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: stroke,
    borderLeftWidth: stroke,
    borderBottomLeftRadius: 14,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: stroke,
    borderRightWidth: stroke,
    borderBottomRightRadius: 14,
  },
  foundSpot: {
    position: 'absolute',
    left: 80,
    width: 240,
    top: 283,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    height: 34,
    paddingLeft: 6,
    paddingRight: tokens.spacing[4],
    borderRadius: tokens.radius.full,
    backgroundColor: colors.surface,
    ...held(colors),
  },
  lens: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.kraftEdge,
  },
  tagBox: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: tagSize.width,
    height: tagSize.height,
    // As a string: the web ignores the array form and would turn the tag about its middle.
    transformOrigin: `${tagSize.eyeletX}px ${tagSize.eyeletY}px`,
  },
  // Mirrored for the same reason as the card's back.
  tagBack: {
    transform: [{ scaleX: -1 }],
  },
  tagContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 46,
    alignItems: 'center',
  },
  tagBackContent: {
    top: 50,
  },
  to: {
    marginVertical: 2,
  },
  motto: {
    marginTop: tokens.spacing[2],
  },
  trend: {
    position: 'absolute',
    right: -14,
    top: 146,
  },
  odometer: {
    flexDirection: 'row',
    height: digitHeight,
  },
  digit: {
    height: digitHeight,
    overflow: 'hidden',
  },
  digitText: {
    lineHeight: digitHeight,
    height: digitHeight,
  },
  hintSpot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: stage.width,
    alignItems: 'center',
  },
  hint: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: 5,
    borderRadius: tokens.radius.full,
    borderWidth: 1.5,
    borderColor: colors.heldEdge,
    backgroundColor: colors.canvas,
  },
  crowd: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: stage.width,
    height: stage.edge + 1,
    overflow: 'hidden',
  },
  person: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  signSpot: {
    position: 'absolute',
    width: 140,
    height: 70,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sign: {
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[3],
    paddingTop: 5,
    paddingBottom: 6,
    borderRadius: tokens.radius.small,
    backgroundColor: colors.surface,
    transformOrigin: 'bottom',
    ...held(colors),
  },
  signPick: {
    backgroundColor: colors.marigold,
  },
  signBig: {
    fontSize: 17,
    lineHeight: 19,
  },
  signPickText: {
    fontSize: 14,
    lineHeight: 17,
  },
  signSmall: {
    fontSize: 9.5,
    lineHeight: 12,
    marginTop: 2,
  },
  doodles: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: stage.width,
    height: stage.edge + 1,
    overflow: 'hidden',
  },
  doodle: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  listed: {
    position: 'absolute',
    left: 0,
    top: 0,
    paddingHorizontal: tokens.spacing[3] - 1,
    paddingVertical: 5,
    borderRadius: tokens.radius.medium,
    backgroundColor: colors.surface,
    ...held(colors),
  },
  stampSpot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 160,
    alignItems: 'center',
  },
  stamp: {
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: 3,
    borderRadius: tokens.radius.small,
    borderWidth: 2.5,
    borderColor: colors.accent,
    backgroundColor: colors.canvas,
  },
}));
