declare const process: {
  env: Record<string, string | undefined>;
};

/**
 * Where the meetup map's street tiles come from. Any standard `{z}/{x}/{y}` raster tile URL works;
 * set `EXPO_PUBLIC_MAP_TILES_URL` (and `EXPO_PUBLIC_MAP_TILES_ATTRIBUTION`, which the provider's
 * terms require on the map) to change it, or to `none` to turn the map off.
 *
 * The default is OpenStreetMap's own tiles: real, community-mapped streets, free to show with
 * credit, for building and testing only. Their policy allows light use and forbids leaning on them
 * in a released app, so pick a provider and plan before launch. (CARTO's free basemaps, the
 * earlier default, now need an API key: without one every tile reads "API key required".)
 */
const defaultTiles = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const defaultAttribution = '© OpenStreetMap contributors';

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
