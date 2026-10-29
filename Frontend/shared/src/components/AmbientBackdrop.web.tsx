import { useIsFocused } from 'expo-router';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';

import { placeColors, tokens, useTheme } from '../design';
import printTile from './backdrop/print-tile-web.png';
import {
  priceFace,
  stickerLayouts,
  stickerLean,
  stickerOutline,
  stickerShadow,
  type AmbientArea,
  type PrintCoverage,
  type StickerShape,
} from './BackdropPrint';
import {
  cubicBezier,
  formAt,
  outlinePath,
  stickerCanvas,
  stickerForm,
  type StickerForm,
} from './sticker-form';

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

/**
 * The web's backdrop: the same blobs, price-gun print and cut-paper stickers as the apps, drawn
 * with plain CSS. The blobs drift on CSS keyframes and every change of screen is a CSS
 * transition, so the browser animates it all on the compositor and no script runs per frame;
 * the native version's Reanimated loops would run on the page's one thread here.
 */
export function AmbientBackdrop({ mood = 'calm', print = 'edges' }: AmbientBackdropProps) {
  if (mood === 'none') return null;
  return <Backdrop mood={mood} print={print} />;
}

/** One screen's backdrop: its colour and how far its print reaches. */
interface Look {
  readonly mood: AmbientArea;
  readonly print: PrintCoverage;
}

const sameLook = (a: Look, b: Look) => a.mood === b.mood && a.print === b.print;

/**
 * The look on screen right now. Each screen's backdrop sits in this look while it's out of view,
 * so the moment it comes into view it matches what was just there, then changes into its own.
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

const morphMs = tokens.motion.duration.backdropMorph;
const [m1, m2, m3, m4] = tokens.motion.bezier.morph;
const morphEase = `cubic-bezier(${m1}, ${m2}, ${m3}, ${m4})`;
const morph = (property: string) => `${property} ${morphMs}ms ${morphEase}`;
const keep = tokens.motion.ambient.maskKeep;
const loopMs = tokens.motion.duration.ambientLoop;
const driftMs = loopMs * 1.6;
const tileUrl = `url("${String((printTile as { uri?: string }).uri ?? printTile)}")`;

/** Where each blob rests, as fractions of the screen, and how far it wanders. */
const blobs = [
  { x: -0.35, y: -0.18, size: 1.3, driftX: 0.08, driftY: 0.05, phase: 0 },
  { x: 0.35, y: 0.18, size: 1.1, driftX: -0.1, driftY: 0.06, phase: 0.33 },
  { x: -0.2, y: 0.55, size: 1.2, driftX: 0.07, driftY: -0.05, phase: 0.66 },
] as const;

const css = `
.sw-backdrop{position:absolute;inset:0;overflow:hidden;pointer-events:none;contain:strict}
.sw-backdrop *{pointer-events:none}
.sw-blob{position:absolute;aspect-ratio:1;animation:sw-drift ${driftMs}ms ease-in-out infinite alternate;will-change:transform}
.sw-blob>div{position:absolute;inset:0;animation:sw-breath ${loopMs}ms ease-in-out infinite alternate;transition:${morph('background-color')};-webkit-mask-image:radial-gradient(closest-side,${keep} 0%,color-mix(in srgb,${keep} 55%,transparent) 55%,transparent 100%);mask-image:radial-gradient(closest-side,${keep} 0%,color-mix(in srgb,${keep} 55%,transparent) 55%,transparent 100%);will-change:transform,opacity}
.sw-paused .sw-blob,.sw-paused .sw-blob>div{animation-play-state:paused}
@keyframes sw-drift{from{transform:translate(0,0)}to{transform:translate(var(--dx),var(--dy))}}
@keyframes sw-breath{from{opacity:calc(var(--peak) * .7);transform:scale(.92)}to{opacity:var(--peak);transform:scale(1.04)}}
.sw-print,.sw-band,.sw-tile{position:absolute;inset:0}
.sw-print{transition:${morph('opacity')}}
.sw-band{transition:${morph('opacity')}}
.sw-band-edges{-webkit-mask-image:linear-gradient(to right,${keep} 0%,transparent 30%,transparent 70%,${keep} 100%);mask-image:linear-gradient(to right,${keep} 0%,transparent 30%,transparent 70%,${keep} 100%)}
.sw-band-middle{-webkit-mask-image:linear-gradient(to right,transparent 0%,${keep} 30%,${keep} 70%,transparent 100%);mask-image:linear-gradient(to right,transparent 0%,${keep} 30%,${keep} 70%,transparent 100%)}
.sw-tile{transition:${morph('background-color')};-webkit-mask-image:${tileUrl};mask-image:${tileUrl};-webkit-mask-size:64px 64px;mask-size:64px 64px;-webkit-mask-repeat:repeat;mask-repeat:repeat}
.sw-stickers{position:absolute;inset:0}
.sw-sticker{position:absolute;width:0;height:0;transform-origin:0 0;transition:${morph('left')},${morph('top')},${morph('transform')}}
.sw-sticker svg{position:absolute;overflow:visible}
@media (prefers-reduced-motion:reduce){.sw-backdrop *{animation:none!important;transition:none!important}}
`;

let stylesInjected = false;

/** Adds the backdrop's stylesheet to the page once, the first time a backdrop mounts. */
function useBackdropStyles() {
  useEffect(() => {
    if (stylesInjected || typeof document === 'undefined') return;
    const sheet = document.createElement('style');
    sheet.setAttribute('data-snapworth-backdrop', '');
    sheet.textContent = css;
    document.head.appendChild(sheet);
    stylesInjected = true;
  }, []);
}

/**
 * A screen's say in the backdrop: while it's in view, its look is the one shown. It opens in the
 * look that was showing and takes over only once it has stayed in view a moment, so passing
 * through on the way to another screen changes nothing.
 */
export function useBackdropClaim(
  mood: AmbientArea | 'none',
  print: PrintCoverage,
  enabled: boolean,
): boolean {
  const focused = useIsFocused();
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!enabled || !focused) {
      setInView(false);
      return;
    }
    // It takes over only once it's drawn and has stayed in view a moment: one passed through on
    // the way to another leaves the backdrop alone, so it changes once, for where you land.
    const settle = setTimeout(() => setInView(true), tokens.motion.duration.backdropSettle);
    return () => clearTimeout(settle);
  }, [enabled, focused]);
  useEffect(() => {
    if (inView && mood !== 'none') show({ mood, print });
  }, [inView, mood, print]);
  return inView;
}

/**
 * The one backdrop drawn behind a group of screens that share it (see `BackdropHostContext`).
 * It's always the same element, so a change of look is one CSS transition that a quick run of
 * switches simply redirects from wherever it has got to, never a jump between two drawings.
 */
export function SharedBackdrop() {
  const shown = useSyncExternalStore(watch, readShownLook, readShownLook);
  const focused = useIsFocused();
  return <BackdropView look={shown ?? fallbackLook} focused={focused} />;
}

const fallbackLook: Look = { mood: 'feed', print: 'edges' };

function Backdrop({ mood, print }: { readonly mood: AmbientArea; readonly print: PrintCoverage }) {
  const focused = useIsFocused();
  const own = useMemo(() => ({ mood, print }), [mood, print]);
  const shown = useSyncExternalStore(watch, readShownLook, readShownLook);
  const inView = useBackdropClaim(mood, print, true);
  // Out of view it shows whatever is showing, so it comes into view matching it.
  return <BackdropView look={inView || !shown ? own : shown} focused={focused} />;
}

function BackdropView({ look, focused }: { readonly look: Look; readonly focused: boolean }) {
  useBackdropStyles();
  const { colors, name } = useTheme();
  const ink = lookInk(colors, look.mood);
  const tints = tokens.ambient[name][look.mood];
  const peak = tokens.motion.ambient.peakOpacity[name];
  // A light colour (the market's marigold) all but vanishes into light paper, so it's printed
  // heavier there to read as strongly as the others.
  const boost = name === 'light' && ink.light ? 1.6 : 1;
  const printOpacity = tokens.motion.ambient.printOpacity[look.print][name] * boost;

  return (
    <div className={focused ? 'sw-backdrop' : 'sw-backdrop sw-paused'} aria-hidden>
      {blobs.map((blob, index) => (
        <div
          key={index}
          className="sw-blob"
          style={
            {
              left: `${blob.x * 100}%`,
              top: `${blob.y * 100}%`,
              width: `${blob.size * 100}%`,
              '--dx': `${(blob.driftX / blob.size) * 100}%`,
              '--dy': `${(blob.driftY / blob.size) * 100}%`,
              animationDelay: `${-blob.phase * driftMs}ms`,
            } as CSSProperties
          }
        >
          <div
            style={
              {
                backgroundColor: tints[index],
                '--peak': peak,
                animationDelay: `${-blob.phase * loopMs}ms`,
              } as CSSProperties
            }
          />
        </div>
      ))}

      <div className="sw-print" style={{ opacity: printOpacity }}>
        <div className="sw-band sw-band-edges">
          <div className="sw-tile" style={{ backgroundColor: ink.print }} />
        </div>
        <div className="sw-band sw-band-middle" style={{ opacity: look.print === 'full' ? 1 : 0 }}>
          <div className="sw-tile" style={{ backgroundColor: ink.print }} />
        </div>
      </div>

      <div className="sw-stickers" style={{ opacity: tokens.motion.ambient.stickerOpacity[name] }}>
        {stickerLayouts[look.mood].map((slot, index) => (
          <div
            key={index}
            className="sw-sticker"
            style={{
              left: `${slot.x * 100}%`,
              top: `${slot.y * 100}%`,
              transform: `rotate(${stickerLean[slot.side]}deg)`,
            }}
          >
            <Sticker shape={slot.shape} size={slot.size} ink={ink.paper} />
          </div>
        ))}
      </div>
    </div>
  );
}

function lookInk(colors: ReturnType<typeof useTheme>['colors'], mood: AmbientArea) {
  if (mood === 'calm') return { print: colors.textPrimary, paper: colors.kraft, light: false };
  const place = placeColors(colors, mood);
  return { print: place.fill, paper: place.fill, light: !place.dark };
}

const easeMorph = cubicBezier(m1 ?? 0, m2 ?? 0, m3 ?? 1, m4 ?? 1);
const canvas = stickerCanvas + stickerShadow;
const centre = stickerCanvas / 2;

function reducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * One sticker's art. A change of shape, size or colour turns it into the new one: its outline
 * blends point by point and its colour with it (`sticker-form`), redrawn straight onto the SVG
 * for the length of the change and still otherwise. A change that arrives mid-way sets off from
 * the shape on screen.
 */
function Sticker({
  shape,
  size,
  ink,
}: {
  readonly shape: StickerShape;
  readonly size: number;
  readonly ink: string;
}) {
  const { colors } = useTheme();
  const target = useMemo(() => stickerForm(shape, size, ink), [shape, size, ink]);
  const shown = useRef(target);
  const paper = useRef<SVGPathElement>(null);
  const shade = useRef<SVGPathElement>(null);
  const eyelet = useRef<SVGGElement>(null);
  const coin = useRef<SVGGElement>(null);
  // The small print keeps the geometry of the shape it belongs to while it fades.
  const [print, setPrint] = useState({ tag: target, coin: target });

  useEffect(() => {
    const from = shown.current;
    setPrint((current) => ({
      tag: target.tag > 0 ? target : from.tag > 0 ? from : current.tag,
      coin: target.coin > 0 ? target : from.coin > 0 ? from : current.coin,
    }));
    const draw = (form: StickerForm) => {
      const d = outlinePath(form.radii, centre, centre);
      paper.current?.setAttribute('d', d);
      shade.current?.setAttribute('d', d);
      if (paper.current) paper.current.style.fill = form.ink;
      if (eyelet.current) eyelet.current.style.opacity = String(form.tag);
      if (coin.current) coin.current.style.opacity = String(form.coin);
    };
    if (from === target || reducedMotion()) {
      shown.current = target;
      draw(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const raw = Math.min(1, (now - start) / morphMs);
      shown.current = raw >= 1 ? target : formAt(from, target, easeMorph(raw));
      draw(shown.current);
      if (raw < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const d = outlinePath(shown.current.radii, centre, centre);
  return (
    <svg width={canvas} height={canvas} style={{ left: -centre, top: -centre }}>
      <path
        ref={shade}
        d={d}
        fill={colors.heldShadow}
        transform={`translate(${stickerShadow} ${stickerShadow})`}
      />
      <path
        ref={paper}
        d={d}
        style={{ fill: shown.current.ink }}
        stroke={colors.heldEdge}
        strokeWidth={stickerOutline}
        strokeLinejoin="round"
      />
      <g ref={eyelet} style={{ opacity: shown.current.tag }}>
        <circle
          cx={centre + print.tag.eyeletX}
          cy={centre}
          r={print.tag.eyeletR}
          fill={colors.canvas}
          stroke={colors.heldEdge}
          strokeWidth={2}
        />
      </g>
      <g ref={coin} style={{ opacity: shown.current.coin }}>
        <circle
          cx={centre}
          cy={centre}
          r={print.coin.coinSize / 2 - 11}
          fill="none"
          stroke={colors.heldEdge}
          strokeWidth={1.5}
        />
        <text
          x={centre}
          y={centre + print.coin.coinSize * 0.15}
          fontSize={print.coin.coinSize * 0.42}
          fontFamily={priceFace}
          fill={colors.heldEdge}
          textAnchor="middle"
        >
          ₱
        </text>
      </g>
    </svg>
  );
}
