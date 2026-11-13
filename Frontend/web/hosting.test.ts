import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The website is exported as static pages, and a page with a parameter in its path
 * (`/listing/[id]`) is one file for every listing. A host only finds it for a real link
 * (`/listing/polaroid-sun-600`) through a rewrite in `vercel.json`. Without one, a shared link
 * opens on "Not Found", though clicking through inside the site works.
 */
const webRoot = __dirname;
const appDir = join(webRoot, 'app');

/** The URL of every route file with a `[param]` in it, groups like `(product)` left out. */
function parameterRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return parameterRoutes(path);
    if (!/\.tsx$/.test(name) || name.startsWith('_') || !name.includes('[')) return [];
    const url = relative(appDir, path)
      .replace(/\.tsx$/, '')
      .split(sep)
      .filter((part) => !/^\(.*\)$/.test(part))
      .join('/');
    return [`/${url}`];
  });
}

interface Rewrite {
  readonly source: string;
  readonly destination: string;
}

const config = JSON.parse(readFileSync(join(webRoot, 'vercel.json'), 'utf8')) as {
  readonly cleanUrls: boolean;
  readonly rewrites: readonly Rewrite[];
};

it('rewrites every page with a parameter to its exported file', () => {
  const routes = parameterRoutes(appDir);
  expect(routes).toContain('/listing/[id]');
  for (const route of routes) {
    const source = route.replace(/\[(\w+)\]/g, ':$1');
    expect(config.rewrites).toContainEqual({ source, destination: `${route}.html` });
  }
});

it('serves the other pages without their .html', () => {
  expect(config.cleanUrls).toBe(true);
});
