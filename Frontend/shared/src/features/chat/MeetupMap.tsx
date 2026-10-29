import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { PressableScale, Stamp, Sticker, SWText } from '../../components';
import { held, monoFaces, themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import {
  inside,
  parks,
  pathOf,
  placeLabels,
  project,
  rivers,
  roads,
  toScreen,
  water,
  world,
  type Frame,
  type Point,
} from './meetup-map-geo';

export interface MapPin {
  readonly key: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

/** A group of spots shown as one paper chip, for a view too wide to tell pins apart. */
export interface MapCluster {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly lat: number;
  readonly lng: number;
  /** Which side of its point the chip sits, so neighbouring chips don't overlap. */
  readonly side: 'start' | 'end' | 'center';
}

export interface MeetupMapProps {
  /** The part of the map to show (see `frameForArea`); its shape sets the map's. */
  readonly frame: Frame;
  readonly pins: readonly MapPin[];
  readonly selectedKey?: string;
  /** Makes each pin a button. Without it the map is a picture of where to meet. */
  readonly onSelect?: (key: string) => void;
  /** Both sides have agreed: the pin turns jeepney green and the map is stamped. */
  readonly agreed?: boolean;
  /** The small map on a chat card: no compass or legend, smaller print. */
  readonly compact?: boolean;
  readonly accessibilityLabel: string;
  readonly clusters?: readonly MapCluster[];
  readonly onSelectCluster?: (key: string) => void;
}

const pinSize = { width: 24, height: 30 };
const selectedScale = 1.25;

/**
 * Metro Manila printed on the app's paper: land is the page, the bay a cobalt wash with printed
 * waves, roads are paper strips with an ink edge and kraft name tags, and every meetup spot is a
 * little price tag with an eyelet, cut out with a hard shadow like everything you can hold. The
 * chosen spot turns marigold and wears its name on a sticker; an agreed one turns jeepney green
 * under the price-gun's stamp.
 */
export function MeetupMap({
  frame,
  pins,
  selectedKey,
  onSelect,
  agreed = false,
  compact = false,
  accessibilityLabel,
  clusters = [],
  onSelectCluster,
}: MeetupMapProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const aspect = frame.width / frame.height;
  // Map units per screen pixel, so lines and print keep their size at any zoom.
  const px = size.width > 0 ? frame.width / size.width : frame.width / 320;

  const waves = useMemo(() => wavesIn(frame, px), [frame, px]);
  const dots = useMemo(() => dotsIn(frame, px), [frame, px]);
  const selected = pins.find((pin) => pin.key === selectedKey);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  const mono = monoFaces['500'];
  const visible = (point: Point) =>
    point.x >= frame.x &&
    point.x <= frame.x + frame.width &&
    point.y >= frame.y &&
    point.y <= frame.y + frame.height;

  return (
    <View style={[styles.frame, held(colors, compact ? 2 : 3), compact ? null : styles.tagged]}>
      <View
        style={[styles.clip, { aspectRatio: aspect }]}
        onLayout={onLayout}
        accessible={!onSelect}
        accessibilityRole={onSelect ? undefined : 'image'}
        accessibilityLabel={accessibilityLabel}
      >
        <View
          style={styles.drawing}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg
            width="100%"
            height="100%"
            viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
          >
            <Rect
              x={world.x - 100}
              y={world.y - 100}
              width={world.width + 200}
              height={world.height + 200}
              fill={colors.mapLand}
            />
            <Path
              d={dots}
              stroke={colors.borderStrong}
              strokeWidth={1.6 * px}
              strokeLinecap="round"
            />
            {parks.map((park, index) => (
              <Ellipse
                key={index}
                cx={park.center.x}
                cy={park.center.y}
                rx={park.rx}
                ry={park.ry}
                fill={colors.mapPark}
              />
            ))}
            {rivers.map((river, index) => (
              <G key={index}>
                <Path
                  d={pathOf(river)}
                  stroke={colors.heldEdge}
                  strokeWidth={4.5 * px}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={pathOf(river)}
                  stroke={colors.mapWater}
                  strokeWidth={3 * px}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            ))}
            {[water.bay, water.lake].map((outline, index) => (
              <Path
                key={index}
                d={pathOf(outline, true)}
                fill={colors.mapWater}
                stroke={colors.heldEdge}
                strokeWidth={1.5 * px}
                strokeLinejoin="round"
              />
            ))}
            <Path
              d={waves}
              stroke={colors.mapWaves}
              strokeWidth={1.2 * px}
              fill="none"
              strokeLinecap="round"
            />
            {roads.map((road) => (
              <G key={road.name}>
                <Path
                  d={pathOf(road.points)}
                  stroke={colors.heldEdge}
                  strokeWidth={(road.major ? 7 : 5) * px}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={pathOf(road.points)}
                  stroke={colors.mapRoad}
                  strokeWidth={(road.major ? 4.5 : 2.8) * px}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            ))}
            {placeLabels
              .filter((label) => visible(label.at))
              .map((label) => (
                <SvgText
                  key={label.text}
                  x={label.at.x}
                  y={label.at.y}
                  fill={colors.textMuted}
                  fontFamily={mono}
                  fontSize={(compact ? 8 : 9.5) * px}
                  letterSpacing={1.2 * px}
                  textAnchor="middle"
                >
                  {label.text}
                </SvgText>
              ))}
            {compact
              ? null
              : roads
                  .filter((road) => (road.major || frame.width < 60) && visible(road.label))
                  .map((road) => (
                    <RoadTag key={road.name} name={road.name} at={road.label} px={px} />
                  ))}
          </Svg>
        </View>

        {size.width > 0
          ? pins.map((pin) => {
              const at = toScreen(project(pin.lat, pin.lng), frame, size);
              const isSelected = pin.key === selectedKey;
              const scale = isSelected ? selectedScale : 1;
              const width = pinSize.width * scale;
              const height = pinSize.height * scale;
              const fill = isSelected
                ? agreed
                  ? colors.placeChat
                  : colors.marigold
                : colors.kraft;
              const body = (
                <TagPin
                  width={width}
                  height={height}
                  fill={fill}
                  eyelet={isSelected && agreed ? colors.onPlaceChat : colors.mapLand}
                />
              );
              // The tag's point sits on the spot; the touch target reaches out to 44pt.
              const place = {
                position: 'absolute' as const,
                left: at.left - width / 2,
                top: at.top - height,
                zIndex: isSelected ? 2 : 1,
              };
              const reach = {
                left: Math.max(0, (44 - width) / 2),
                right: Math.max(0, (44 - width) / 2),
                top: Math.max(0, (44 - height) / 2),
                bottom: Math.max(0, (44 - height) / 2),
              };
              return onSelect ? (
                <PressableScale
                  key={pin.key}
                  accessibilityRole="button"
                  accessibilityLabel={pin.name}
                  accessibilityState={{ selected: isSelected }}
                  haptic="select"
                  hitSlop={reach}
                  onPress={() => onSelect(pin.key)}
                  containerStyle={place}
                >
                  {body}
                </PressableScale>
              ) : (
                <View key={pin.key} style={place} pointerEvents="none">
                  {body}
                </View>
              );
            })
          : null}

        {size.width > 0
          ? clusters.map((cluster) => (
              <ClusterChip
                key={cluster.key}
                cluster={cluster}
                at={toScreen(project(cluster.lat, cluster.lng), frame, size)}
                bounds={size}
                onPress={onSelectCluster ? () => onSelectCluster(cluster.key) : undefined}
              />
            ))
          : null}

        {selected && size.width > 0 && !compact ? (
          <PlaceSticker pin={selected} frame={frame} size={size} />
        ) : null}

        {compact ? null : (
          <View style={styles.compass} pointerEvents="none">
            <SWText variant="overline" tone="kraftInk">
              N
            </SWText>
          </View>
        )}
        {agreed ? <Stamp label="Agreed" side="end" style={styles.stamp} /> : null}
      </View>
      {/* Tied on below the map like a tag, so it never covers a place. */}
      {compact ? null : (
        <View style={styles.legend} pointerEvents="none">
          <View style={styles.legendEyelet} />
          <SWText variant="overline" tone="kraftInk">
            Public spots only
          </SWText>
        </View>
      )}
    </View>
  );
}

/**
 * An area on the wide map: an ink dot where its spots are, and a cut-paper chip with its name
 * and a jeepney-green count. Pressing it zooms in.
 */
function ClusterChip({
  cluster,
  at,
  bounds,
  onPress,
}: {
  readonly cluster: MapCluster;
  readonly at: { readonly left: number; readonly top: number };
  readonly bounds: { readonly width: number; readonly height: number };
  readonly onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const gap = 8;
  const keepIn = (value: number, size: number, room: number) =>
    Math.min(Math.max(value, 6), room - size - 6);
  const left = keepIn(
    cluster.side === 'start'
      ? at.left - box.width - gap
      : cluster.side === 'end'
        ? at.left + gap
        : at.left - box.width / 2,
    box.width,
    bounds.width,
  );
  const top = keepIn(
    cluster.side === 'center' ? at.top - box.height - gap : at.top - box.height / 2,
    box.height,
    bounds.height,
  );
  const spots = `${cluster.count} ${cluster.count === 1 ? 'spot' : 'spots'}`;
  return (
    <>
      <View
        pointerEvents="none"
        style={[styles.clusterDot, { left: at.left - 6, top: at.top - 6 }]}
      />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${cluster.label}, ${spots}. Zoom in`}
        haptic="select"
        disabled={!onPress}
        onPress={onPress}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width !== box.width || height !== box.height) setBox({ width, height });
        }}
        containerStyle={{
          position: 'absolute',
          left,
          top,
          opacity: box.width > 0 ? 1 : 0,
          zIndex: 3,
        }}
        style={styles.cluster}
      >
        <SWText variant="labelSmall">{cluster.label}</SWText>
        <View style={styles.clusterCount}>
          <SWText variant="tag" color={colors.onPlaceChat}>
            {String(cluster.count)}
          </SWText>
        </View>
      </PressableScale>
    </>
  );
}

/** A map pin cut like a price tag, point down, with an eyelet and a hard shadow. */
function TagPin({
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

/** A road's name on a little kraft tag, printed in the tag's mono. */
function RoadTag({
  name,
  at,
  px,
}: {
  readonly name: string;
  readonly at: Point;
  readonly px: number;
}) {
  const { colors } = useTheme();
  const fontSize = 8 * px;
  const width = (name.length * 0.62 * 8 + 10) * px;
  const height = 13 * px;
  return (
    <G>
      <Rect
        x={at.x - width / 2 + 1.5 * px}
        y={at.y - height / 2 + 1.5 * px}
        width={width}
        height={height}
        rx={2.5 * px}
        fill={colors.heldShadow}
      />
      <Rect
        x={at.x - width / 2}
        y={at.y - height / 2}
        width={width}
        height={height}
        rx={2.5 * px}
        fill={colors.kraft}
        stroke={colors.heldEdge}
        strokeWidth={1.2 * px}
      />
      <SvgText
        x={at.x}
        y={at.y + fontSize * 0.36}
        fill={colors.kraftInk}
        fontFamily={monoFaces['500']}
        fontSize={fontSize}
        textAnchor="middle"
      >
        {name.toUpperCase()}
      </SvgText>
    </G>
  );
}

/** The chosen place's name on a marigold sticker above its pin, kept inside the map. */
function PlaceSticker({
  pin,
  frame,
  size,
}: {
  readonly pin: MapPin;
  readonly frame: Frame;
  readonly size: { readonly width: number; readonly height: number };
}) {
  const [width, setWidth] = useState(0);
  const at = toScreen(project(pin.lat, pin.lng), frame, size);
  const pinHeight = pinSize.height * selectedScale;
  const left = Math.min(Math.max(at.left - width / 2, 6), size.width - width - 6);
  const above = at.top - pinHeight - 34;
  const top = above > 6 ? above : at.top + 8;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left, top, opacity: width > 0 ? 1 : 0 }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Sticker label={pin.name} tone="marigold" />
    </View>
  );
}

/** The paper's print: a fine grid of dots across the land in view, the same on screen at any zoom. */
function dotsIn(frame: Frame, px: number): string {
  const step = 12 * px;
  let d = '';
  for (let y = frame.y + step / 2; y < frame.y + frame.height; y += step) {
    for (let x = frame.x + step / 2; x < frame.x + frame.width; x += step) {
      const point = { x, y };
      if (inside(point, water.bay) || inside(point, water.lake)) continue;
      d += `M${x.toFixed(2)} ${y.toFixed(2)}h0.001 `;
    }
  }
  return d;
}

/** Printed waves across whatever water is in view, spaced the same on screen at any zoom. */
function wavesIn(frame: Frame, px: number): string {
  const step = 20 * px;
  const half = 3 * px;
  let d = '';
  let row = 0;
  for (let y = frame.y + step / 2; y < frame.y + frame.height; y += step * 0.8, row += 1) {
    for (let x = frame.x + (row % 2 ? step / 2 : 0); x < frame.x + frame.width; x += step) {
      const point = { x, y };
      if (!inside(point, water.bay) && !inside(point, water.lake)) continue;
      d += `M${(x - half * 2).toFixed(2)} ${y.toFixed(2)} q${half} ${-half} ${half * 2} 0 t${half * 2} 0 `;
    }
  }
  return d;
}

const stylesFor = themedStyles((colors) => ({
  frame: {
    borderRadius: tokens.radius.large,
    backgroundColor: colors.mapLand,
  },
  clip: {
    width: '100%',
    borderRadius: tokens.radius.large - 2,
    overflow: 'hidden',
  },
  compass: {
    position: 'absolute',
    top: tokens.spacing[2],
    right: tokens.spacing[2],
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.kraft,
    ...held(colors, 2),
  },
  // Room below the map for the tag tied to its edge.
  tagged: {
    marginBottom: tokens.spacing[3],
  },
  legend: {
    position: 'absolute',
    left: tokens.spacing[3],
    bottom: -tokens.spacing[3],
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
    transform: [{ rotate: `${tokens.tilt.start}deg` }],
    ...held(colors, 2),
  },
  legendEyelet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.heldEdge,
    backgroundColor: colors.mapLand,
  },
  drawing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  clusterDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.heldEdge,
    backgroundColor: colors.marigold,
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    paddingVertical: tokens.spacing[1],
    paddingLeft: tokens.spacing[2],
    paddingRight: tokens.spacing[1],
    borderRadius: tokens.radius.full,
    backgroundColor: colors.surface,
    ...held(colors, 2),
  },
  clusterCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    backgroundColor: colors.placeChat,
  },
  stamp: {
    position: 'absolute',
    top: tokens.spacing[2],
    right: tokens.spacing[2],
  },
}));
