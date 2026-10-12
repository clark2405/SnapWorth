import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoots = [
  join(frontendRoot, 'web'),
  join(frontendRoot, 'mobile'),
  join(frontendRoot, 'shared', 'src'),
];
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const ignoredDirectories = new Set([
  '.expo',
  'android',
  'coverage',
  'dist',
  'e2e',
  'ios',
  'node_modules',
]);
const manifests = [
  join(frontendRoot, 'package.json'),
  join(frontendRoot, 'web', 'package.json'),
  join(frontendRoot, 'mobile', 'package.json'),
  join(frontendRoot, 'shared', 'package.json'),
];

const layerRules = [
  {
    importer: /^(?:web|mobile)\/app\//,
    forbidden: /(?:^|\/)(?:services|ports|data|adapters|supabase)(?:\/|$)/,
    reason: 'route wrappers cannot import services, ports, data, adapters, or Supabase',
  },
  {
    importer: /^shared\/src\/components\//,
    forbidden: /(?:^|\/)(?:features|services|ports|data|adapters|supabase)(?:\/|$)/,
    reason: 'components can import only domain types and design foundations',
  },
  {
    importer: /^shared\/src\/services\//,
    forbidden: /(?:^|\/)(?:features|components|data|adapters|supabase)(?:\/|$)/,
    reason:
      'services depend inward on ports and types, not concrete infrastructure or presentation',
  },
  {
    importer: /^shared\/src\/ports\//,
    forbidden: /(?:^|\/)(?:features|components|services|data|adapters|supabase)(?:\/|$)/,
    reason: 'ports cannot depend on outward or presentation layers',
  },
  {
    importer: /^shared\/src\/(?:data|adapters)\//,
    forbidden: /(?:^|\/)(?:features|components|services)(?:\/|$)/,
    reason: 'infrastructure cannot depend on services or presentation layers',
  },
];

const rawVisualLiteral = /(?:#[\da-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\()/i;
const estimateToAskingAssignment =
  /(?:asking(?:Price|_price)|asking_price_cents)\s*[:=]\s*[^;\n]*(?:ai)?estimate|(?:copy|assign|prefill|initialize)[^;\n]*(?:ai)?estimate[^;\n]*asking(?:Price|_price)/i;
const browserSecret =
  /(?:SUPABASE_SERVICE_ROLE(?:_KEY)?|OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|provider(?:Api)?Secret|serviceRoleKey)/;
const productionMockSelection =
  /production[^;\n]*(?:seeded|mock(?:Pricing|Moderation)?|permit.?all)|(?:seeded|mock(?:Pricing|Moderation)?|permit.?all)[^;\n]*production/i;
const importPattern =
  /(?:import\s+(?:[^'"]+?\s+from\s+)?|require\s*\(|import\s*\()\s*['"]([^'"]+)['"]/g;
const visualSource = /^(?:web\/app|web\/src|mobile\/app|shared\/src\/(?:components|features))\//;
const tokenSource = /^shared\/src\/design\/(?:tokens|theme|nativewind-preset)\./;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function collectFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (sourceExtensions.has(extname(entry.name))) files.push(path);
  }

  return files;
}

function normalizeImport(importer, specifier) {
  if (specifier.startsWith('@snapworth/shared/')) {
    return `shared/src/${specifier.slice('@snapworth/shared/'.length)}`;
  }
  if (specifier.startsWith('.')) {
    const importerDirectory = importer.split('/').slice(0, -1);
    const segments = [...importerDirectory, ...specifier.split('/')];
    const normalized = [];
    for (const segment of segments) {
      if (segment === '.' || segment === '') continue;
      if (segment === '..') normalized.pop();
      else normalized.push(segment);
    }
    return normalized.join('/');
  }
  return specifier;
}

async function checkArchitecture(files) {
  for (const path of files) {
    const importer = relative(frontendRoot, path).replaceAll('\\', '/');
    const source = await readFile(path, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier) continue;
      const imported = normalizeImport(importer, specifier);
      for (const rule of layerRules) {
        assert(
          !rule.importer.test(importer) || !rule.forbidden.test(imported),
          `${importer} imports ${specifier}: ${rule.reason}.`,
        );
      }
    }
  }
  console.log(
    'Source imports respect route, view/component, service, port, and infrastructure boundaries.',
  );
}

async function checkVisualLiterals(files) {
  for (const path of files) {
    const name = relative(frontendRoot, path).replaceAll('\\', '/');
    if (!visualSource.test(name) || tokenSource.test(name)) continue;
    const source = await readFile(path, 'utf8');
    assert(
      !rawVisualLiteral.test(source),
      `${name} contains a raw color literal; use a design token.`,
    );
  }
  console.log('Presentation source contains no raw color literals outside design token modules.');
}

async function checkSemanticSafety(files) {
  for (const path of files) {
    const name = relative(frontendRoot, path).replaceAll('\\', '/');
    const source = await readFile(path, 'utf8');
    assert(
      !estimateToAskingAssignment.test(source),
      `${name} appears to assign or copy an AI estimate into an asking price.`,
    );
  }
  console.log('No estimate-to-asking-price assignment pattern was found.');
}

async function checkBrowserSafety(files) {
  for (const path of files) {
    const name = relative(frontendRoot, path).replaceAll('\\', '/');
    const source = await readFile(path, 'utf8');
    assert(!browserSecret.test(source), `${name} references a server/provider secret identifier.`);
    assert(
      !productionMockSelection.test(source),
      `${name} appears to select seeded, mock, or permit-all infrastructure in production.`,
    );
  }
  console.log(
    'Browser source contains no secret identifiers or production mock-selection patterns.',
  );
}

async function checkDependencies() {
  const forbiddenDependency =
    /(?:stripe|paypal|braintree|adyen|escrow|shipping|shippo|easypost|identity|persona|onfido|iot|mqtt)/i;
  for (const path of manifests) {
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const dependency of Object.keys(manifest[section] ?? {})) {
        assert(
          !forbiddenDependency.test(dependency),
          `${manifest.name}: forbidden out-of-scope dependency ${dependency}.`,
        );
      }
    }
  }
  console.log(
    'No payment, escrow, shipping, identity-verification, or IoT dependency is declared.',
  );
}

const command = process.argv[2] ?? 'all';
const files = (await Promise.all(sourceRoots.map(collectFiles))).flat();

if (command === 'architecture') {
  await checkArchitecture(files);
} else if (command === 'all') {
  await checkArchitecture(files);
  await checkVisualLiterals(files);
  await checkSemanticSafety(files);
  await checkBrowserSafety(files);
  await checkDependencies();
} else {
  throw new Error('Expected one validation target: architecture or all.');
}
