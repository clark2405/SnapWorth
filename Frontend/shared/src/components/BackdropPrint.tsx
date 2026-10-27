import { useId } from 'react';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Mask,
  Path,
  Pattern,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { resolveFontFamily, tokens, useTheme } from '../design';
import edgeMask from './backdrop/edge-mask.png';
import printTile from './backdrop/print-tile.png';

export type AmbientArea = keyof typeof tokens.ambient.light;

/**
 * How much of the page the price-gun print covers: all of it on a quiet screen, only the edges
 * where the content is busy, so nothing is printed behind cards and text.
 */
export type PrintCoverage = 'full' | 'edges';

const priceFace = resolveFontFamily('price', '800');

/** A DOM-safe id, so two prints on one web page never borrow each other's pattern. */
function useSvgId(name: string) {
  return `${name}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * The price-gun print, like wrapping paper: peso marks, tag eyelets and dots on a 64pt tile. On
 * a phone it's one small tile repeated and tinted, faded to the edges by a gradient mask, so the
 * GPU draws it and a change of screen never has to paint the whole print again.
 */
export function PrintLayer(props: {
  readonly ink: string;
  readonly coverage: PrintCoverage;
  readonly width: number;
  readonly height: number;
}) {
  if (Platform.OS === 'web') return <PrintSvg {...props} />;
  const { ink, coverage, width, height } = props;
  const size = { width, height };
  const print = <Image source={printTile} resizeMode="repeat" style={[size, { tintColor: ink }]} />;
  if (coverage === 'full') return print;
  return (
    <MaskedView
      style={size}
      maskElement={<Image source={edgeMask} resizeMode="stretch" style={size} />}
    >
      {print}
    </MaskedView>
  );
}

/** The same print drawn as SVG, for the web, where a browser paints it cheaply. */
function PrintSvg({
  ink,
  coverage,
  width,
  height,
}: {
  readonly ink: string;
  readonly coverage: PrintCoverage;
  readonly width: number;
  readonly height: number;
}) {
  const tile = useSvgId('price-gun');
  const fade = useSvgId('edge-fade');
  const mask = useSvgId('edge-mask');
  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id={tile} width={64} height={64} patternUnits="userSpaceOnUse">
          <SvgText x={6} y={22} fontSize={15} fontFamily={priceFace} fill={ink}>
            ₱
          </SvgText>
          <Circle cx={44} cy={14} r={4} fill="none" stroke={ink} strokeWidth={1.5} />
          <Circle cx={24} cy={46} r={1.8} fill={ink} />
          <SvgText x={38} y={56} fontSize={15} fontFamily={priceFace} fill={ink}>
            ₱
          </SvgText>
          <Circle cx={8} cy={52} r={4} fill="none" stroke={ink} strokeWidth={1.5} />
          <Circle cx={56} cy={34} r={1.8} fill={ink} />
        </Pattern>
        {coverage === 'edges' ? (
          <>
            {/* Full strength at both edges, clear through the middle third. */}
            <LinearGradient id={fade} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={tokens.motion.ambient.maskKeep} stopOpacity={1} />
              <Stop offset="0.3" stopColor={tokens.motion.ambient.maskKeep} stopOpacity={0} />
              <Stop offset="0.7" stopColor={tokens.motion.ambient.maskKeep} stopOpacity={0} />
              <Stop offset="1" stopColor={tokens.motion.ambient.maskKeep} stopOpacity={1} />
            </LinearGradient>
            <Mask id={mask} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
              <Rect width={width} height={height} fill={`url(#${fade})`} />
            </Mask>
          </>
        ) : null}
      </Defs>
      <Rect
        width={width}
        height={height}
        fill={`url(#${tile})`}
        mask={coverage === 'edges' ? `url(#${mask})` : undefined}
      />
    </Svg>
  );
}

export type StickerShape = 'tag' | 'scallop' | 'coin';

export interface StickerSlot {
  readonly shape: StickerShape;
  /** Which edge it's stuck to; it leans the way everything on that side does. */
  readonly side: 'start' | 'end';
  /** Its centre, as fractions of the screen: just off an edge, so about half of it shows. */
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

/** A sticker's lean, a little more than a tag's, since it's stuck down rather than hung. */
export const stickerLean = { start: -12, end: 12 } as const;

type Four<T> = readonly [T, T, T, T];

/**
 * Where each place's stickers sit. Every place has four, so going from one screen to another
 * each sticker can travel to its new spot instead of vanishing.
 */
export const stickerLayouts: Record<AmbientArea, Four<StickerSlot>> = {
  feed: [
    { shape: 'scallop', side: 'end', x: 0.9, y: 0.3, size: 120 },
    { shape: 'tag', side: 'start', x: -0.08, y: 0.46, size: 150 },
    { shape: 'coin', side: 'end', x: 0.92, y: 0.74, size: 104 },
    { shape: 'scallop', side: 'start', x: 0.02, y: 0.88, size: 90 },
  ],
  market: [
    { shape: 'coin', side: 'end', x: 0.93, y: 0.34, size: 100 },
    { shape: 'scallop', side: 'start', x: 0.01, y: 0.4, size: 116 },
    { shape: 'tag', side: 'end', x: 1.04, y: 0.62, size: 150 },
    { shape: 'coin', side: 'start', x: 0.03, y: 0.82, size: 92 },
  ],
  history: [
    { shape: 'tag', side: 'end', x: 1.04, y: 0.32, size: 146 },
    { shape: 'coin', side: 'start', x: 0.02, y: 0.42, size: 98 },
    { shape: 'scallop', side: 'end', x: 0.93, y: 0.7, size: 112 },
    { shape: 'tag', side: 'start', x: -0.08, y: 0.86, size: 140 },
  ],
  chat: [
    { shape: 'scallop', side: 'start', x: 0.02, y: 0.3, size: 108 },
    { shape: 'tag', side: 'end', x: 1.04, y: 0.44, size: 146 },
    { shape: 'scallop', side: 'start', x: 0.0, y: 0.66, size: 96 },
    { shape: 'coin', side: 'end', x: 0.93, y: 0.84, size: 100 },
  ],
  calm: [
    { shape: 'scallop', side: 'end', x: 0.92, y: 0.26, size: 116 },
    { shape: 'tag', side: 'start', x: -0.08, y: 0.48, size: 150 },
    { shape: 'coin', side: 'end', x: 0.93, y: 0.76, size: 104 },
    { shape: 'scallop', side: 'start', x: 0.02, y: 0.9, size: 90 },
  ],
};

/** Room around a shape for half its outline, so no edge of it is ever cut off. */
const pad = 3;
/** How far the hard shadow sits down and to the right, as on every card. */
const shadow = 4;
const outline = 2.5;

/** A tag's silhouette, `w` by `h`, nose to the left, drawn from (`x`, `y`). */
function tagPath(w: number, h: number, x: number, y: number) {
  const nose = w * 0.2;
  const r = h * 0.1;
  return [
    `M${x + nose} ${y}`,
    `H${x + w - r}`,
    `Q${x + w} ${y} ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `Q${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H${x + nose}`,
    `L${x} ${y + h / 2}`,
    'Z',
  ].join(' ');
}

/**
 * A disc of `bumps` half-round bumps whose outermost edge is radius `outer` around (`cx`, `cy`):
 * the bumps' centres sit on an inner circle, so the outline closes exactly at `outer`.
 */
function scallopPath(outer: number, bumps: number, cx: number, cy: number) {
  const step = Math.sin(Math.PI / bumps);
  const r = outer / (1 + step);
  const bump = r * step;
  const points = Array.from({ length: bumps + 1 }, (_, i) => {
    const a = (i / bumps) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  });
  const [first, ...rest] = points;
  const arcs = rest.map(([x, y]) => `A${bump} ${bump} 0 0 1 ${x} ${y}`).join(' ');
  return `M${first?.[0] ?? cx} ${first?.[1] ?? cy} ${arcs} Z`;
}

/**
 * One cut-paper sticker, centred on its parent's origin: a flat shape in `ink` with the same ink
 * outline and hard shadow as every card. Every shape is drawn in whole pixels inside a canvas
 * with room for its outline and shadow, so its edge is always cut clean.
 */
export function StickerArt({
  shape,
  size,
  ink,
}: {
  readonly shape: StickerShape;
  readonly size: number;
  readonly ink: string;
}) {
  const { colors } = useTheme();
  const w = size;
  const h = shape === 'tag' ? Math.round(size * 0.6) : size;
  const edge = { stroke: colors.heldEdge, strokeWidth: outline, strokeLinejoin: 'round' as const };
  const cx = pad + w / 2;
  const cy = pad + h / 2;
  const tag = shape === 'tag' ? tagPath(w, h, pad, pad) : '';
  const scallop = shape === 'scallop' ? scallopPath(w / 2, 14, cx, cy) : '';
  return (
    <View style={[styles.art, { left: -cx, top: -cy }]}>
      <Svg width={w + pad * 2 + shadow} height={h + pad * 2 + shadow}>
        {shape === 'tag' ? (
          <>
            <Path d={tag} fill={colors.heldShadow} transform={`translate(${shadow} ${shadow})`} />
            <Path d={tag} fill={ink} {...edge} />
            <Circle
              cx={pad + w * 0.17}
              cy={cy}
              r={h * 0.09}
              fill={colors.canvas}
              stroke={colors.heldEdge}
              strokeWidth={2}
            />
          </>
        ) : shape === 'scallop' ? (
          <>
            <Path
              d={scallop}
              fill={colors.heldShadow}
              transform={`translate(${shadow} ${shadow})`}
            />
            <Path d={scallop} fill={ink} {...edge} />
          </>
        ) : (
          <>
            <Circle cx={cx + shadow} cy={cy + shadow} r={w / 2} fill={colors.heldShadow} />
            <Circle cx={cx} cy={cy} r={w / 2} fill={ink} {...edge} />
            <Circle
              cx={cx}
              cy={cy}
              r={w / 2 - 11}
              fill="none"
              stroke={colors.heldEdge}
              strokeWidth={1.5}
            />
            <SvgText
              x={cx}
              y={cy + w * 0.15}
              fontSize={w * 0.42}
              fontFamily={priceFace}
              fill={colors.heldEdge}
              textAnchor="middle"
            >
              ₱
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

// The geometry and faces, shared with the web's CSS-drawn backdrop.
export {
  outline as stickerOutline,
  pad as stickerPad,
  priceFace,
  scallopPath,
  shadow as stickerShadow,
  tagPath,
};

const styles = StyleSheet.create({
  art: {
    position: 'absolute',
  },
});
