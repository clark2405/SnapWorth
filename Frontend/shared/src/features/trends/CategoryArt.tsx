import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { tokens, useTheme } from '../../design';
import type { MarketCategory } from '../../ports/marketplace';

/**
 * A category's own drawing, for the places that stand for a whole category rather than one
 * item (the Feed's "Most listed this month" tiles and a trend's page). Drawn like the onboarding
 * windbreaker (`JacketArt`): one thing in flat colour with an ink outline, on a disc of a brand
 * colour, on card stock, with a few faint marks around it. Everything sits on a 160pt square;
 * `slice` fills any other shape from the middle.
 */
export function CategoryArt({
  category,
  width,
  height = width,
}: {
  readonly category: MarketCategory;
  readonly width: number | `${number}%`;
  readonly height?: number | `${number}%`;
}) {
  const { colors } = useTheme();
  const ink = colors.heldEdge;
  const disc: Readonly<Record<MarketCategory, string>> = {
    fashion: colors.marigold,
    sneakers: colors.cobalt,
    electronics: colors.placeChat,
    collectibles: colors.accent,
    home: art.box,
  };
  const Drawing = drawings[category];
  return (
    <Svg width={width} height={height} viewBox="0 0 160 160" preserveAspectRatio="xMidYMid slice">
      <Rect width={160} height={160} fill={art.cardStock} />
      <Circle cx={80} cy={90} r={58} fill={disc[category]} />
      <G fill="none" stroke={ink} strokeWidth={2.2} opacity={0.18}>
        <Path d="M16 24 h6 M19 21 v6" />
        <Path d="M138 140 h6 M141 137 v6" />
        <Circle cx={140} cy={26} r={3} />
        <Circle cx={22} cy={140} r={2.2} />
      </G>
      <G stroke={ink} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
        <Drawing ink={ink} />
      </G>
    </Svg>
  );
}

const art = tokens.illustration;
const [red, redLight] = art.shirt.red;
const [marigold] = art.shirt.marigold;

/** A windbreaker on a hanger, the onboarding's own jacket. */
function Fashion({ ink }: { readonly ink: string }) {
  return (
    <G transform="translate(19 -4) scale(0.78)">
      <Path d="M78 40 q0 -11 9 -11 q8 0 8 8 q0 6 -9 9" fill="none" stroke={art.hanger} />
      <Path d="M40 62 L78 40 L116 62" fill="none" stroke={art.hanger} strokeWidth={3.2} />
      <G transform="translate(8 46)">
        <Path d="M45 18 L20 35 L8 118 L27 122 L40 70 Z" fill={art.jacket} />
        <Path d="M95 18 L120 35 L132 118 L113 122 L100 70 Z" fill={art.jacket} />
        <Path d="M45 18 Q70 10 95 18 L100 132 Q70 139 40 132 Z" fill={art.jacket} />
        <Path d="M20 35 L45 18 L44 36 L22 52 Z" fill={art.jacketTrim} />
        <Path d="M22 52 L44 36 L43 47 L23.5 63 Z" fill={ink} />
        <Path d="M120 35 L95 18 L96 36 L118 52 Z" fill={art.jacketTrim} />
        <Path d="M118 52 L96 36 L97 47 L116.5 63 Z" fill={ink} />
        <Path d="M40.4 124 Q70 131 99.6 124 L100 132 Q70 139 40 132 Z" fill={art.jacketTrim} />
        <Path d="M57 14 L70 30 L83 14 L78 8 L62 8 Z" fill={art.jacketTrim} />
        <Path d="M70 30 L70 134" fill="none" strokeWidth={1.8} />
      </G>
    </G>
  );
}

/** A high-top, side on, toe to the right. */
function Sneakers({ ink }: { readonly ink: string }) {
  return (
    <G transform="translate(0 4)">
      <Path
        d="M28 112 L32 60 Q33 52 41 52 L62 52 Q70 52 72 60 L76 76 Q98 82 120 90 Q140 97 141 112 Z"
        fill={red}
      />
      <Path d="M32 74 L28 112 L44 112 L46 74 Z" fill={art.light} />
      <Path d="M104 86 Q130 94 138 104 L141 112 L104 112 Z" fill={art.light} />
      <Path d="M36 52 Q38 46 46 46 L60 46 Q66 46 68 52 L66 58 L38 58 Z" fill={ink} />
      <Path d="M72 66 l10 -4 M77 73 l10 -4 M82 80 l10 -4" fill="none" strokeWidth={2} />
      <Path d="M52 100 Q74 90 98 96" fill="none" stroke={redLight} strokeWidth={5} />
      <Path
        d="M22 112 H140 Q146 112 146 118 Q146 125 139 125 H24 Q17 125 17 118 Q17 112 22 112 Z"
        fill={art.sneaker}
      />
      <Path d="M18 119 H145" fill="none" strokeWidth={1.4} opacity={0.4} />
    </G>
  );
}

/** A cassette player with its headphones, tipped a little. */
function Electronics({ ink }: { readonly ink: string }) {
  return (
    <G transform="rotate(-8 80 92)">
      <Path
        d="M126 98 C144 102 148 120 136 132 C126 142 110 138 100 144"
        fill="none"
        strokeWidth={2}
      />
      <Circle cx={98} cy={145} r={6} fill={marigold} />
      <Rect x={46} y={52} width={12} height={8} rx={2} fill={marigold} />
      <Rect x={62} y={52} width={12} height={8} rx={2} fill={red} />
      <Rect x={78} y={52} width={12} height={8} rx={2} fill={art.light} />
      <Rect x={34} y={58} width={92} height={64} rx={8} fill={art.denim} />
      <Rect x={44} y={70} width={60} height={36} rx={4} fill={art.phoneScreen} />
      <Rect x={50} y={74} width={48} height={10} rx={2} fill={art.light} />
      <Circle cx={61} cy={95} r={6.5} fill={art.light} strokeWidth={1.6} />
      <Circle cx={61} cy={95} r={2} fill={ink} stroke="none" />
      <Circle cx={87} cy={95} r={6.5} fill={art.light} strokeWidth={1.6} />
      <Circle cx={87} cy={95} r={2} fill={ink} stroke="none" />
      <Rect x={110} y={70} width={8} height={36} rx={2} fill={red} />
    </G>
  );
}

/** An instant camera with a print sliding out of it. */
function Collectibles({ ink }: { readonly ink: string }) {
  return (
    <G>
      <Rect x={52} y={110} width={56} height={40} fill={art.cardStock} />
      <Rect x={57} y={128} width={46} height={16} fill={art.jacket} strokeWidth={1.6} />
      <Path d="M44 70 L50 48 H110 L116 70 Z" fill={art.phone} />
      <Rect x={84} y={53} width={20} height={10} rx={2} fill={art.light} strokeWidth={1.6} />
      <Rect x={56} y={54} width={13} height={9} rx={2} fill={art.phoneScreen} strokeWidth={1.6} />
      <Rect x={34} y={68} width={92} height={56} rx={8} fill={art.light} />
      <Rect x={34} y={78} width={92} height={7} fill={marigold} />
      <Circle cx={80} cy={103} r={17} fill={art.phone} />
      <Circle cx={80} cy={103} r={10} fill={art.phoneScreen} strokeWidth={1.6} />
      <Circle cx={76} cy={99} r={3} fill={art.light} stroke="none" opacity={0.7} />
      <Circle cx={113} cy={95} r={4} fill={red} />
      <Path d="M40 118 H58" fill="none" stroke={ink} strokeWidth={1.6} opacity={0.4} />
    </G>
  );
}

/** A reading lamp on a stack of books, beside a plant. */
function Home({ ink }: { readonly ink: string }) {
  return (
    <G>
      <G transform="translate(18 72) scale(0.62)" stroke="none">
        <Path d="M30 70 C22 50 16 34 18 12 C26 30 30 48 32 70 Z" fill={art.leaf} />
        <Path d="M30 70 C32 44 40 26 48 16 C46 38 40 56 34 72 Z" fill={art.leafLight} />
        <Path d="M28 72 C18 60 8 52 4 38 C16 46 24 56 32 70 Z" fill={art.leafLight} />
        <Path d="M14 70 H46 L42 100 H18 Z" fill={art.pot} stroke={ink} strokeWidth={3.5} />
      </G>
      <Rect x={62} y={128} width={64} height={10} rx={2} fill={red} />
      <Rect x={68} y={118} width={52} height={10} rx={2} fill={art.denim} />
      <Path d="M84 118 L88 110 H100 L104 118 Z" fill={art.phone} />
      <Rect x={92} y={72} width={4} height={38} fill={art.phone} strokeWidth={1.6} />
      <Path d="M68 76 L78 44 H110 L120 76 Z" fill={marigold} />
      <Path d="M70 70 H118" fill="none" stroke={ink} strokeWidth={1.6} opacity={0.35} />
    </G>
  );
}

const drawings: Readonly<
  Record<MarketCategory, (props: { readonly ink: string }) => React.ReactElement>
> = {
  fashion: Fashion,
  sneakers: Sneakers,
  electronics: Electronics,
  collectibles: Collectibles,
  home: Home,
};
