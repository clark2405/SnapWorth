import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';

import { placeColors, tokens, useTheme } from '../design';
import printTile from './backdrop/print-tile-web.png';
import {
  priceFace,
  scallopPath,
  stickerLayouts,
  stickerLean,
  stickerOutline,
  stickerPad,
  stickerShadow,
  tagPath,
  type AmbientArea,
  type PrintCoverage,
  type StickerShape,
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
.sw-sticker .sw-ink{transition:${morph('fill')}}
.sw-in{animation:sw-fade-in ${morphMs}ms ${morphEase} both}
.sw-out{animation:sw-fade-out ${morphMs}ms ${morphEase} both}
@keyframes sw-fade-in{from{opacity:0}to{opacity:1}}
@keyframes sw-fade-out{from{opacity:1}to{opacity:0}}
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

interface StickerLayer {
  readonly key: string;
  readonly shape: StickerShape;
  readonly size: number;
  readonly state: 'rest' | 'in' | 'out';
}

/**
 * One sticker's art. A change of colour fades on the shape itself; a change of shape or size
 * fades the old art out as the new fades in, while the sticker travels to its new spot.
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
  const key = `${shape}-${size}`;
  const [layers, setLayers] = useState<readonly StickerLayer[]>([
    { key, shape, size, state: 'rest' },
  ]);

  useEffect(() => {
    setLayers((current) =>
      current[current.length - 1]?.key === key
        ? current
        : [
            ...current
              .filter((layer) => layer.key !== key)
              .map((layer) => ({ ...layer, state: 'out' as const })),
            { key, shape, size, state: 'in' },
          ],
    );
    const settle = setTimeout(
      () => setLayers((current) => current.filter((layer) => layer.state !== 'out')),
      morphMs + 120,
    );
    return () => clearTimeout(settle);
  }, [key, shape, size]);

  return (
    <>
      {layers.map((layer) => (
        <StickerSvg
          key={layer.key}
          shape={layer.shape}
          size={layer.size}
          ink={ink}
          className={layer.state === 'in' ? 'sw-in' : layer.state === 'out' ? 'sw-out' : undefined}
        />
      ))}
    </>
  );
}

/** The same cut-paper shapes as the apps' `StickerArt`, as inline SVG, centred on its parent. */
function StickerSvg({
  shape,
  size,
  ink,
  className,
}: {
  readonly shape: StickerShape;
  readonly size: number;
  readonly ink: string;
  readonly className?: string;
}) {
  const { colors } = useTheme();
  const w = size;
  const h = shape === 'tag' ? Math.round(size * 0.6) : size;
  const cx = stickerPad + w / 2;
  const cy = stickerPad + h / 2;
  const edge = {
    stroke: colors.heldEdge,
    strokeWidth: stickerOutline,
    strokeLinejoin: 'round' as const,
  };
  const offset = `translate(${stickerShadow} ${stickerShadow})`;
  const inkStyle = { fill: ink };
  const outline =
    shape === 'tag'
      ? tagPath(w, h, stickerPad, stickerPad)
      : shape === 'scallop'
        ? scallopPath(w / 2, 14, cx, cy)
        : null;

  return (
    <svg
      className={className}
      width={w + stickerPad * 2 + stickerShadow}
      height={h + stickerPad * 2 + stickerShadow}
      style={{ left: -cx, top: -cy }}
    >
      {outline ? (
        <>
          <path d={outline} fill={colors.heldShadow} transform={offset} />
          <path d={outline} className="sw-ink" style={inkStyle} {...edge} />
          {shape === 'tag' ? (
            <circle
              cx={stickerPad + w * 0.17}
              cy={cy}
              r={h * 0.09}
              fill={colors.canvas}
              stroke={colors.heldEdge}
              strokeWidth={2}
            />
          ) : null}
        </>
      ) : (
        <>
          <circle
            cx={cx + stickerShadow}
            cy={cy + stickerShadow}
            r={w / 2}
            fill={colors.heldShadow}
          />
          <circle cx={cx} cy={cy} r={w / 2} className="sw-ink" style={inkStyle} {...edge} />
          <circle
            cx={cx}
            cy={cy}
            r={w / 2 - 11}
            fill="none"
            stroke={colors.heldEdge}
            strokeWidth={1.5}
          />
          <text
            x={cx}
            y={cy + w * 0.15}
            fontSize={w * 0.42}
            fontFamily={priceFace}
            fill={colors.heldEdge}
            textAnchor="middle"
          >
            ₱
          </text>
        </>
      )}
    </svg>
  );
}
