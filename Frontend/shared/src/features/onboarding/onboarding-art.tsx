import { useId } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  Pattern,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { resolveFontFamily, tokens, useTheme } from '../../design';

/**
 * The introduction's drawings, in flat editorial illustration: natural proportions, one shade tone
 * per material, patterned shirts and no outlines, the way people are drawn in the best onboarding
 * work. People have no faces: a profile, or the back of a head, says enough and never looks odd.
 * Every drawing is a fixed size in design points; the scene scales them together.
 */
const art = tokens.illustration;
const display = resolveFontFamily('display', '800');

type Skin = keyof typeof art.skin;

/** A material's colours: base, then its pattern or shade, then a deeper fold. */
function tones(list: readonly string[]): readonly [string, string, string] {
  return [list[0] ?? '', list[1] ?? list[0] ?? '', list[2] ?? list[1] ?? list[0] ?? ''];
}
type Shirt = keyof typeof art.shirt;
type ShirtPattern = 'dots' | 'tris' | 'stripes';

/** A DOM-safe id for a pattern, so two drawings on one web page never share one. */
function usePatternId() {
  return `p${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function ShirtFill({ id, shirt, pattern }: { id: string; shirt: Shirt; pattern: ShirtPattern }) {
  const [base, mark] = tones(art.shirt[shirt]);
  if (pattern === 'dots') {
    return (
      <Pattern id={id} width={11} height={11} patternUnits="userSpaceOnUse">
        <Rect width={11} height={11} fill={base} />
        <Circle cx={3} cy={3} r={2.3} fill={mark} />
        <Circle cx={8.5} cy={8.5} r={2.3} fill={mark} />
      </Pattern>
    );
  }
  if (pattern === 'tris') {
    return (
      <Pattern id={id} width={14} height={13} patternUnits="userSpaceOnUse">
        <Rect width={14} height={13} fill={base} />
        <Path d="M2 10 L6 3 L9 10 Z" fill={mark} />
      </Pattern>
    );
  }
  return (
    <Pattern id={id} width={10} height={10} patternUnits="userSpaceOnUse">
      <Rect width={10} height={10} fill={base} />
      <Rect y={6} width={10} height={3} fill={mark} />
    </Pattern>
  );
}

/** An arm, a leg's worth of rounded stroke in one colour. */
function Limb({ d, color, width = 8.5 }: { d: string; color: string; width?: number }) {
  return (
    <Path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** A head in profile, facing right and centred on its cheek: forehead, nose, lips and chin. */
const profilePath =
  'M-11 -3 C-11 -14 -4 -19.5 4 -18.5 C11 -17.5 14.2 -11.5 13.6 -5.4 C13.5 -3.6 14.2 -2 15.8 .6 C16.4 1.7 15.8 2.6 14.5 2.8 L13.1 3 C13.3 4.6 13.2 6 12.3 7 C12.8 8 12.6 9.3 11.8 10 C10.4 12.4 7.6 13.4 4.2 13 C1.4 12.7 -1.6 13.2 -4 14.4 C-8.4 11.2 -11 5.4 -11 -3 Z';

function Profile({ skin, children }: { skin: Skin; children: React.ReactNode }) {
  const [face, shade] = tones(art.skin[skin]);
  return (
    <>
      <Path d={profilePath} fill={face} />
      {children}
      <Ellipse cx={-1.4} cy={-0.4} rx={2.6} ry={3.4} fill={shade} />
    </>
  );
}

/** Someone standing, holding a phone up to snap what's in front of them. Faces right. */
export function Photographer() {
  const id = usePatternId();
  const [skin, shade] = tones(art.skin.light);
  const [shirt, , fold] = tones(art.shirt.marigold);
  return (
    <Svg width={120} height={232} viewBox="0 0 120 232">
      <Defs>
        <ShirtFill id={id} shirt="marigold" pattern="stripes" />
      </Defs>
      <Path
        d="M47 128 C46 160 43 186 42 214 L52 214 C55 188 58 162 60 134 Z"
        fill={art.denimShade}
      />
      <Path d="M58 130 C62 160 66 186 70 214 L80 213 C78 186 75 158 72 128 Z" fill={art.denim} />
      <Path d="M37 212 H52 Q55 212 55 216 V219 H33 Q32 212 37 212 Z" fill={art.sneaker} />
      <Rect x={33} y={218} width={22} height={3} rx={1.5} fill={art.phone} />
      <Path d="M68 211 H80 Q88 211 89 217 V219 H67 Z" fill={art.sneaker} />
      <Rect x={67} y={218} width={22} height={3} rx={1.5} fill={art.phone} />
      <Limb d="M45 84 C34 100 40 112 52 104 L68 80" color={shade} />
      <Path d="M41 78 Q57 70 73 78 L77 134 Q57 141 37 134 Z" fill={`url(#${id})`} />
      <Path d="M62 73 Q69 74 73 78 L77 134 Q70 137 63 137 Z" fill={fold} opacity={0.55} />
      <Path d="M41 78 Q33 82 31 94 L41 96 Z" fill={shirt} />
      <Path d="M52 62 H62 V76 Q57 79 52 76 Z" fill={shade} />
      <G transform="translate(56 50)">
        <Profile skin="light">
          <Path
            d="M-12.4 -1 C-14.6 -14 -6 -21.4 4 -20.4 C11.4 -19.8 15.4 -15 14.4 -9.2 C9 -12.4 3 -13 -1.2 -10.2 C-3.4 -7 -3.6 -2.6 -4.6 1.4 C-6.4 5 -9 7.2 -11.2 5.6 C-12.6 3.8 -12.6 1.4 -12.4 -1 Z"
            fill={art.hair}
          />
          <Circle cx={-10.6} cy={-15.6} r={6.4} fill={art.hair} />
        </Profile>
      </G>
      <G transform="rotate(14 79 66)">
        <Rect x={72} y={52} width={14} height={24} rx={3.2} fill={art.phone} />
        <Rect x={74} y={55} width={10} height={17} rx={1.6} fill={art.phoneScreen} />
        <Circle cx={79} cy={57.5} r={1.2} fill={art.light} opacity={0.7} />
      </G>
      <Path d="M66 80 Q76 82 78 92 L70 96 Z" fill={shirt} />
      <Limb d="M73 92 C82 88 82 78 78 70" color={skin} />
      <Circle cx={78} cy={69} r={4.6} fill={skin} />
    </Svg>
  );
}

const curls = [
  [-8, -12],
  [-2, -17],
  [5, -18.5],
  [10.5, -14.5],
  [-11.5, -5],
  [-10, 2],
  [-4, -11],
  [3, -13],
] as const;

/** Someone sitting on a shipping box, chin on hand, looking up at something above. */
export function Thinker() {
  const id = usePatternId();
  const [skin, shade] = tones(art.skin.tan);
  const [shirt, , fold] = tones(art.shirt.red);
  return (
    <Svg width={140} height={200} viewBox="0 0 140 200">
      <Defs>
        <ShirtFill id={id} shirt="red" pattern="dots" />
      </Defs>
      <Rect x={18} y={128} width={78} height={72} rx={3} fill={art.box} />
      <Path d="M18 128 H96 V142 H18 Z" fill={art.boxShade} />
      <Rect x={50} y={128} width={14} height={72} fill={art.boxTape} />
      <Path
        d="M28 158 h18 M28 164 h12"
        stroke={art.boxPrint}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M60 124 C80 120 96 122 102 132 L100 184 L90 184 L88 140 C78 140 66 140 58 138 Z"
        fill={art.denimShade}
      />
      <Path
        d="M52 126 C72 124 88 128 92 138 L94 186 L84 186 L80 146 C70 146 58 144 50 140 Z"
        fill={art.denim}
      />
      <Path d="M80 184 H94 Q101 184 102 190 V192 H79 Z" fill={art.sneaker} />
      <Rect x={79} y={191} width={23} height={3} rx={1.5} fill={art.phone} />
      <Path d="M88 182 H101 Q108 182 109 188 V190 H87 Z" fill={art.sneaker} opacity={0.9} />
      <Path d="M38 78 Q54 70 70 78 L72 132 Q54 138 36 132 Z" fill={`url(#${id})`} />
      <Path d="M38 78 Q46 74 52 73 L48 136 Q41 135 36 132 Z" fill={fold} opacity={0.5} />
      <Limb d="M64 84 C78 98 80 108 72 112" color={shade} />
      <Path d="M66 80 Q74 84 76 94 L67 97 Z" fill={shirt} />
      <Limb d="M42 84 C36 106 46 110 62 74" color={skin} />
      <Path d="M40 79 Q33 84 32 96 L42 97 Z" fill={shirt} />
      <Path d="M49 58 H59 V75 Q54 78 49 75 Z" fill={shade} />
      <G transform="translate(55 46) rotate(-16)">
        <Profile skin="tan">
          <G fill={art.hair}>
            {curls.map(([x, y]) => (
              <Circle key={`${x}-${y}`} cx={x} cy={y} r={5.6} />
            ))}
          </G>
        </Profile>
      </G>
      <Circle cx={62} cy={62} r={4.6} fill={skin} />
    </Svg>
  );
}

export type VoterHair = 'bob' | 'short' | 'curly' | 'long';
export type VoterRaise = 'left' | 'right' | 'both';

/** Where a voter's sign sits: its bottom centre, in the voter's own points. */
export const voterSignAt: Record<VoterRaise, readonly [number, number]> = {
  both: [50, 30],
  right: [78, 5],
  left: [22, 5],
};

const curlyBack = [
  [39.5, 51],
  [42.5, 43],
  [50, 40],
  [57.5, 43],
  [60.5, 51],
  [44.5, 50],
  [55.5, 50],
  [50, 47],
  [41.5, 58],
  [58.5, 58],
  [50, 56],
] as const;

/** Seen from behind, the hair is the whole head, with the ears and nape of the neck showing. */
function BackHair({ hair }: { hair: VoterHair }) {
  const shine = { fill: 'none', stroke: art.hairShine, strokeLinecap: 'round' } as const;
  switch (hair) {
    case 'bob':
      return (
        <>
          <Ellipse cx={50} cy={54} rx={13.6} ry={15} fill={art.hair} />
          <Path d="M36.6 55 Q36 71 42 71.5 H58 Q64 71 63.4 55 Z" fill={art.hair} />
          <Path d="M41 47 Q48 41 57 44" strokeWidth={2.2} {...shine} />
        </>
      );
    case 'short':
      return (
        <>
          <Ellipse cx={50} cy={53.5} rx={13} ry={14} fill={art.hair} />
          <Path d="M38.4 60 Q50 64 61.6 60 Q60 66 50 67 Q40 66 38.4 60 Z" fill={art.hair} />
          <Path d="M42 46 Q49 41 57 44" strokeWidth={2.2} {...shine} />
        </>
      );
    case 'curly':
      return (
        <>
          <G fill={art.hair}>
            {curlyBack.map(([x, y]) => (
              <Circle key={`${x}-${y}`} cx={x} cy={y} r={6.6} />
            ))}
          </G>
          <Circle cx={46} cy={42} r={2} fill={art.hairShine} />
          <Circle cx={54} cy={41.5} r={1.6} fill={art.hairShine} />
        </>
      );
    case 'long':
      return (
        <>
          <Ellipse cx={50} cy={54} rx={13.6} ry={15} fill={art.hair} />
          <Path d="M36.6 56 Q35.6 82 40 94 H60 Q64.4 82 63.4 56 Z" fill={art.hair} />
          <Path d="M43 46 Q50 41 58 45 M48 60 Q49 76 47 88" strokeWidth={2} {...shine} />
        </>
      );
  }
}

/**
 * Someone seen from behind, holding a vote up to the listing: a paddle on a stick in one hand,
 * or a board held overhead in both. The sign itself is laid over the drawing at `voterSignAt`.
 */
export function Voter({
  skin,
  hair,
  shirt,
  pattern,
  raise,
  tilt = 0,
}: {
  skin: Skin;
  hair: VoterHair;
  shirt: Shirt;
  pattern: ShirtPattern;
  raise: VoterRaise;
  tilt?: number;
}) {
  const id = usePatternId();
  const { colors } = useTheme();
  const [face, shade] = tones(art.skin[skin]);
  const fill = `url(#${id})`;
  const sleeveLeft = <Path d="M38 86 Q24 86 20 98 L32 104 Z" fill={fill} />;
  const sleeveRight = <Path d="M62 86 Q76 86 80 98 L68 104 Z" fill={fill} />;
  const stick = (x: number) => (
    <Path d={`M${x} 36 V4`} stroke={art.stick} strokeWidth={4} strokeLinecap="round" />
  );
  return (
    <Svg width={100} height={150} viewBox="0 0 100 150">
      <Defs>
        <ShirtFill id={id} shirt={shirt} pattern={pattern} />
      </Defs>
      <Path d="M44 76 H56 V86 Q50 91 44 86 Z" fill={shade} />
      <Path d="M12 150 Q12 88 50 84 Q88 88 88 150 Z" fill={fill} />
      <Path
        d="M50 84 Q88 88 88 150 L64 150 Q66 110 50 84 Z"
        fill={colors.heldEdge}
        opacity={0.08}
      />
      {raise === 'both' ? (
        <>
          <Limb d="M34 94 C20 76 20 54 32 34" color={shade} width={9} />
          <Limb d="M66 94 C80 76 80 54 68 34" color={shade} width={9} />
          {sleeveLeft}
          {sleeveRight}
          <Circle cx={32} cy={32} r={5.2} fill={face} />
          <Circle cx={68} cy={32} r={5.2} fill={face} />
        </>
      ) : raise === 'right' ? (
        <>
          {stick(78)}
          <Limb d="M66 94 C86 80 88 58 78 38" color={shade} width={9} />
          {sleeveRight}
          <Circle cx={78} cy={36} r={5.2} fill={face} />
        </>
      ) : (
        <>
          {stick(22)}
          <Limb d="M34 94 C14 80 12 58 22 38" color={shade} width={9} />
          {sleeveLeft}
          <Circle cx={22} cy={36} r={5.2} fill={face} />
        </>
      )}
      <G transform={`translate(0 7) rotate(${tilt} 50 70)`}>
        <Ellipse cx={50} cy={57} rx={12.4} ry={14.6} fill={face} />
        <Ellipse cx={37.4} cy={58} rx={2.6} ry={3.8} fill={shade} />
        <Ellipse cx={62.6} cy={58} rx={2.6} ry={3.8} fill={shade} />
        <BackHair hair={hair} />
      </G>
    </Svg>
  );
}

/** The windbreaker on its hanger, drawn on the card the jacket is snapped as. */
export function JacketArt({ width, height }: { width: number; height: number }) {
  const { colors } = useTheme();
  const ink = colors.heldEdge;
  return (
    <Svg width={width} height={height} viewBox="0 0 156 196">
      <Rect width={156} height={196} fill={art.cardStock} />
      <Circle cx={78} cy={110} r={58} fill={colors.marigold} />
      <G fill="none" stroke={ink} strokeWidth={2.2} opacity={0.18}>
        <Path d="M18 30 h6 M21 27 v6" />
        <Path d="M132 168 h6 M135 165 v6" />
        <Circle cx={136} cy={34} r={3} />
      </G>
      <Path
        d="M78 40 q0 -11 9 -11 q8 0 8 8 q0 6 -9 9"
        fill="none"
        stroke={art.hanger}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Path
        d="M40 62 L78 40 L116 62"
        fill="none"
        stroke={art.hanger}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <G transform="translate(8 46)" stroke={ink} strokeWidth={2.2} strokeLinejoin="round">
        <Path d="M45 18 L20 35 L8 118 L27 122 L40 70 Z" fill={art.jacket} />
        <Path d="M95 18 L120 35 L132 118 L113 122 L100 70 Z" fill={art.jacket} />
        <Path d="M45 18 Q70 10 95 18 L100 132 Q70 139 40 132 Z" fill={art.jacket} />
        <Path d="M20 35 L45 18 L44 36 L22 52 Z" fill={art.jacketTrim} />
        <Path d="M22 52 L44 36 L43 47 L23.5 63 Z" fill={ink} />
        <Path d="M120 35 L95 18 L96 36 L118 52 Z" fill={art.jacketTrim} />
        <Path d="M118 52 L96 36 L97 47 L116.5 63 Z" fill={ink} />
        <Path d="M8.6 112 L27.6 116 L27 122 L8 118 Z" fill={art.jacketTrim} />
        <Path d="M131.4 112 L112.4 116 L113 122 L132 118 Z" fill={art.jacketTrim} />
        <Path d="M40.4 124 Q70 131 99.6 124 L100 132 Q70 139 40 132 Z" fill={art.jacketTrim} />
        <Path d="M57 14 L70 30 L83 14 L78 8 L62 8 Z" fill={art.jacketTrim} />
        <Path d="M70 30 L70 134" fill="none" strokeWidth={1.8} />
        <Path d="M52 76 h10 M78 76 h10" fill="none" strokeWidth={1.6} opacity={0.55} />
      </G>
    </Svg>
  );
}

/** A snake plant in a kraft pot. */
export function Plant() {
  return (
    <Svg width={60} height={100} viewBox="0 0 60 100">
      <Path d="M30 70 C22 50 16 34 18 12 C26 30 30 48 32 70 Z" fill={art.leaf} />
      <Path d="M30 70 C32 44 40 26 48 16 C46 38 40 56 34 72 Z" fill={art.leafLight} />
      <Path d="M28 72 C18 60 8 52 4 38 C16 46 24 56 32 70 Z" fill={art.leafLight} />
      <Path d="M32 72 C40 62 50 58 56 48 C52 62 44 70 34 74 Z" fill={art.leaf} />
      <Path d="M14 70 H46 L42 100 H18 Z" fill={art.pot} />
      <Path d="M14 70 H46 L45 78 H15 Z" fill={art.potShade} />
    </Svg>
  );
}

/** The soft shape a scene stands on: the sheet's own colour, lightened. */
export function Blob({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 260 230">
      <Path
        d="M58 22 C102 -8 170 4 210 34 C250 64 266 118 240 162 C214 206 150 236 92 222 C34 208 -6 160 2 108 C8 66 26 44 58 22 Z"
        fill={art.light}
        opacity={0.16}
      />
    </Svg>
  );
}

/** A dashed trail, the line a thrown thing leaves in editorial illustration. */
export function Trail({ color }: { color: string }) {
  return (
    <Svg width={90} height={60} viewBox="0 0 90 60">
      <Path
        d="M4 54 C20 50 22 30 40 34 C58 38 56 14 84 8"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** A thought, said in a bubble. */
export function Thought({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={54} height={38} viewBox="0 0 54 38">
      <Path
        d="M8 2 H46 Q52 2 52 8 V24 Q52 30 46 30 H20 L10 37 L12 30 H8 Q2 30 2 24 V8 Q2 2 8 2 Z"
        fill={art.light}
      />
      <SvgText
        x={27}
        y={22}
        textAnchor="middle"
        fontFamily={display}
        fontWeight="800"
        fontSize={16}
        fill={colors.heldEdge}
      >
        {text}
      </SvgText>
    </Svg>
  );
}

/** A ticked box, for a vote counted. */
export function Tick({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Rect x={2} y={5} width={18} height={18} rx={3} fill="none" stroke={color} strokeWidth={2} />
      <Path
        d="M7 13 L11 17 L24 3"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export type GlyphKind = 'sparkle' | 'plus' | 'dot' | 'ring' | 'squiggle' | 'arrow' | 'coin';

/** The small marks scattered over a scene, drawn on a 40pt square around their centre. */
export function Glyph({
  kind,
  color,
  size = 1,
}: {
  kind: GlyphKind;
  color: string;
  size?: number;
}) {
  return (
    <Svg width={40} height={40} viewBox="-20 -20 40 40">
      <G scale={size}>
        {kind === 'sparkle' ? (
          <Path
            d="M0 -11 C1.6 -2 2 -1.6 11 0 C2 1.6 1.6 2 0 11 C-1.6 2 -2 1.6 -11 0 C-2 -1.6 -1.6 -2 0 -11 Z"
            fill={color}
          />
        ) : kind === 'plus' ? (
          <Path d="M-6 0 H6 M0 -6 V6" stroke={color} strokeWidth={3} strokeLinecap="round" />
        ) : kind === 'dot' ? (
          <Circle r={3.2} fill={color} />
        ) : kind === 'ring' ? (
          <Circle r={6.5} fill="none" stroke={color} strokeWidth={2.4} />
        ) : kind === 'squiggle' ? (
          <Path
            d="M-15 0 q3.75 -7 7.5 0 t7.5 0 t7.5 0 t7.5 0"
            fill="none"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        ) : kind === 'arrow' ? (
          <Path
            d="M0 9 V-9 M-6.5 -2.5 L0 -9 L6.5 -2.5"
            fill="none"
            stroke={color}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <Circle r={11} fill={art.coin} />
            <Circle r={11} fill="none" stroke={art.coinRim} strokeWidth={2.4} />
            <SvgText
              y={4.6}
              textAnchor="middle"
              fontFamily={display}
              fontWeight="800"
              fontSize={13}
              fill={art.coinMark}
            >
              ₱
            </SvgText>
          </>
        )}
      </G>
    </Svg>
  );
}

/** The price tag's outline, cut in Worthy's shape: 128 × 176, eyelet at (64, 27). */
export const tagPath = 'M64 1 L127 41 L127 162 Q127 175 114 175 L14 175 Q1 175 1 162 L1 41 Z';
export const tagSize = { width: 128, height: 176, eyeletX: 64, eyeletY: 27 } as const;
