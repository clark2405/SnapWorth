declare const process: {
  env: Record<string, string | undefined>;
};

/**
 * Where the meetup map's street tiles come from. Any standard `{z}/{x}/{y}` raster tile URL works;
 * set `EXPO_PUBLIC_MAP_TILES_URL` (and `EXPO_PUBLIC_MAP_TILES_ATTRIBUTION`, which the provider's
 * terms require on the map) to change it, or to `none` to turn the map off.
 *
 * The default is CARTO's Voyager style of OpenStreetMap: real, community-mapped streets in a
 * light, quiet style, so the app's own pin, stickers and buttons on top stay easy to see. CARTO's
 * free basemaps have usage limits and need a license for commercial use, so pick a provider and
 * plan before launch.
 */
const defaultTiles = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png';
const defaultAttribution = '© OpenStreetMap contributors © CARTO';

export interface TileSource {
  readonly url: (z: number, x: number, y: number) => string;
  readonly attribution: string;
}

/** Fills in a `{z}/{x}/{y}` template, spreading requests over `{s}` subdomains a to d. */
export function tileSource(template: string, attribution: string): TileSource {
  return {
    attribution,
    url: (z, x, y) =>
      template
        .replace('{s}', 'abcd'[(x + y) % 4] ?? 'a')
        .replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(y))
        .replace('{r}', '@2x'),
  };
}

const configured = process.env.EXPO_PUBLIC_MAP_TILES_URL;

/** The app's tile source, or null when tiles are turned off. */
export const mapTiles: TileSource | null =
  configured === 'none'
    ? null
    : tileSource(
        configured || defaultTiles,
        process.env.EXPO_PUBLIC_MAP_TILES_ATTRIBUTION || (configured ? '' : defaultAttribution),
      );
