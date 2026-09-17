import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(frontendRoot, '..');
const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const exactSemver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const exactWorkspaceSemver = /^workspace:\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function checkTopology() {
  const rootPackage = await readJson(join(frontendRoot, 'package.json'));
  assert(rootPackage.private === true, 'Frontend workspace root must remain private.');
  assert(
    JSON.stringify(rootPackage.workspaces) === JSON.stringify(['web', 'shared']),
    'Frontend workspaces must contain only web and shared while mobile is deferred.',
  );

  await Promise.all([
    access(join(frontendRoot, 'web', 'package.json')),
    access(join(frontendRoot, 'shared', 'package.json')),
    access(join(frontendRoot, 'mobile', 'README.md')),
    access(join(repositoryRoot, 'Backend')),
  ]);

  const mobileEntries = await readdir(join(frontendRoot, 'mobile'));
  assert(
    mobileEntries.length === 1 && mobileEntries[0] === 'README.md',
    'Frontend/mobile must contain only its deferred README.md.',
  );

  const legacyFolders = [
    'adapters',
    'app',
    'assets',
    'components',
    'constants',
    'design',
    'hooks',
    'lib',
    'providers',
    'services',
    'types',
  ];
  const rootEntries = new Set(await readdir(frontendRoot));
  const remainingLegacyFolders = legacyFolders.filter((folder) => rootEntries.has(folder));
  assert(
    remainingLegacyFolders.length === 0,
    `Legacy planning folders remain: ${remainingLegacyFolders.join(', ')}`,
  );

  console.log('Canonical Frontend/web + Frontend/shared topology is valid; mobile is deferred.');
}

async function checkDependencyPins() {
  const manifestPaths = [
    join(frontendRoot, 'package.json'),
    join(frontendRoot, 'web', 'package.json'),
    join(frontendRoot, 'shared', 'package.json'),
  ];

  for (const manifestPath of manifestPaths) {
    const manifest = await readJson(manifestPath);
    for (const section of dependencySections) {
      for (const [name, version] of Object.entries(manifest[section] ?? {})) {
        assert(
          typeof version === 'string' &&
            (exactSemver.test(version) || exactWorkspaceSemver.test(version)),
          `${manifest.name}: ${section}.${name} must use an exact version; received ${String(version)}.`,
        );
      }
    }
  }

  console.log('All workspace dependency versions are exact and bounded.');
}

const command = process.argv[2];
if (command === 'topology') {
  await checkTopology();
} else if (command === 'dependencies') {
  await checkDependencyPins();
} else {
  throw new Error('Expected one validation target: topology or dependencies.');
}
