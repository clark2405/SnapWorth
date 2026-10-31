import { useEffect, useMemo, useState } from 'react';
import { Image, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { Stamp, Sticker, SWText } from '../../components';
import { held, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { mapTiles } from './map-tiles';
import { frameAt, project, tilesFor, type Frame } from './meetup-map-geo';

/**
 * The map under a meetup: street tiles from an online map provider, shown as they are. Only what
 * sits around and on top of the map (frame, pin, stickers, buttons) wears the app's design. While
 * tiles load the frame shows plain paper, and if they can't load it says so instead of showing a
 * map that might be wrong.
 */
export function MapLayer({
  frame,
  size,
}: {
  readonly frame: Frame;
  readonly size: { readonly width: number; readonly height: number };
}) {
  const styles = useThemedStyles(stylesFor);
  const tiles = useMemo(() => (mapTiles ? tilesFor(frame, size) : []), [frame, size]);
  const zoom = tiles[0]?.z;
  // Tiles that failed at this zoom; when every one has, the map can't be shown.
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => setFailed(new Set()), [zoom]);
  const unavailable =
    !mapTiles || (tiles.length > 0 && tiles.every((tile) => failed.has(keyOf(tile))));

  return (
    <View
      style={styles.layer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {tiles.map((tile) => (
        <Image
          key={keyOf(tile)}
          source={{ uri: mapTiles?.url(tile.z, tile.x, tile.y) }}
          onError={() => setFailed((current) => new Set(current).add(keyOf(tile)))}
          style={{
            position: 'absolute',
            left: tile.left,
            top: tile.top,
            width: tile.size + 0.5,
            height: tile.size + 0.5,
          }}
        />
      ))}
      {unavailable ? (
        <View style={styles.unavailable}>
          <View style={styles.notice}>
            <View style={styles.noticeEyelet} />
            <SWText variant="overline" tone="kraftInk">
              {mapTiles ? 'Map can’t load' : 'Map unavailable'}
            </SWText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const keyOf = (tile: { readonly z: number; readonly x: number; readonly y: number }) =>
  `${tile.z}/${tile.x}/${tile.y}`;

/** The tile provider's credit, which its terms require wherever its map is shown. */
export function MapCredit() {
  const styles = useThemedStyles(stylesFor);
  if (!mapTiles?.attribution) return null;
  return (
    <View style={styles.credit} pointerEvents="none">
      <SWText variant="caption" tone="textSecondary" style={styles.creditText}>
        {mapTiles.attribution}
      </SWText>
    </View>
  );
}

/** A map pin cut like a price tag, point down, with an eyelet and a hard shadow. */
export function TagPin({
  width,
  height,
  fill,
  eyelet,
}: {
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  readonly eyelet: string;
}) {
  const { colors } = useTheme();
  const outline = 'M5 2 H19 Q22 2 22 5 V18 L12 28 L2 18 V5 Q2 2 5 2 Z';
  return (
    <Svg width={width + 2} height={height + 2} viewBox="0 0 26 32">
      <Path d={outline} fill={colors.heldShadow} transform="translate(2 2)" />
      <Path
        d={outline}
        fill={fill}
        stroke={colors.heldEdge}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Ellipse
        cx={12}
        cy={9}
        rx={3.2}
        ry={3.2}
        fill={eyelet}
        stroke={colors.heldEdge}
        strokeWidth={1.6}
      />
    </Svg>
  );
}

export const pinSize = { width: 30, height: 38 };

/** A place's name on a marigold sticker, sitting above the pin at `at`, kept inside the map. */
export function PinSticker({
  label,
  at,
  bounds,
}: {
  readonly label: string;
  readonly at: { readonly left: number; readonly top: number };
  readonly bounds: { readonly width: number; readonly height: number };
}) {
  const [width, setWidth] = useState(0);
  const left = Math.min(Math.max(at.left - width / 2, 6), bounds.width - width - 6);
  const top = Math.max(at.top - pinSize.height - 40, 6);
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left, top, opacity: width > 0 ? 1 : 0 }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Sticker label={label} tone="marigold" />
    </View>
  );
}

export interface MeetupMapProps {
  readonly lat: number;
  readonly lng: number;
  /** Both sides have agreed: the pin turns jeepney green and the map is stamped. */
  readonly agreed?: boolean;
  readonly accessibilityLabel: string;
}

/** How close the chat card's map is: a few streets around the pin. */
const cardZoom = 15.5;

/** The small map on a meetup card in the chat: where the two people are meeting. */
export function MeetupMap({ lat, lng, agreed = false, accessibilityLabel }: MeetupMapProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const camera = useMemo(() => ({ center: project(lat, lng), zoom: cardZoom }), [lat, lng]);
  const frame = useMemo(() => frameAt(camera, size), [camera, size]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <View style={[styles.frame, held(colors, 2)]}>
      <View
        style={styles.cardClip}
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        {size.width > 0 ? <MapLayer frame={frame} size={size} /> : null}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: size.width / 2 - pinSize.width / 2,
            top: size.height / 2 - pinSize.height,
          }}
        >
          <TagPin
            width={pinSize.width}
            height={pinSize.height}
            fill={agreed ? colors.placeChat : colors.marigold}
            eyelet={agreed ? colors.onPlaceChat : colors.mapLand}
          />
        </View>
        {agreed ? <Stamp label="Agreed" side="end" style={styles.stamp} /> : null}
        <MapCredit />
      </View>
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  frame: {
    borderRadius: tokens.radius.large,
    backgroundColor: colors.mapLand,
  },
  cardClip: {
    width: '100%',
    aspectRatio: 2.2,
    borderRadius: tokens.radius.large - 2,
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: colors.mapLand,
  },
  // Bottom left, clear of the pin in the middle.
  unavailable: {
    position: 'absolute',
    left: tokens.spacing[2],
    bottom: tokens.spacing[4],
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    paddingVertical: 3,
    paddingLeft: tokens.spacing[2],
    paddingRight: tokens.spacing[3],
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.kraft,
    ...held(colors, 2),
  },
  noticeEyelet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.heldEdge,
    backgroundColor: colors.mapLand,
  },
  // Clear of the frame's rounded corner, which would otherwise cut the credit's last word off.
  credit: {
    position: 'absolute',
    right: tokens.spacing[3],
    bottom: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[1],
    borderRadius: tokens.radius.small,
    backgroundColor: colors.mapLand,
    opacity: 0.85,
  },
  creditText: {
    fontSize: 9,
    lineHeight: 12,
  },
  stamp: {
    position: 'absolute',
    top: tokens.spacing[2],
    right: tokens.spacing[2],
  },
}));
