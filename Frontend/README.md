# SnapWorth Frontend

SnapWorth is organized as a web-first npm workspace. The browser product is delivered from `web/`, reusable product code lives in `shared/`, and native delivery remains documented but non-executable in `mobile/`. Every client uses the single backend in `../Backend/`.

## Workspace topology

| Path | Responsibility |
|---|---|
| `web/` | Expo Router website and desktop composition root |
| `shared/` | Route-neutral components, feature state, services, ports, domain types, and infrastructure implementations |
| `mobile/README.md` | Deferred future Expo shell for both iOS and Android |

`web/` may select and inject infrastructure at its composition root, but route files remain thin wrappers around shared feature views. Shared services depend inward on ports; seeded, Supabase, pricing, and moderation implementations satisfy those ports. No client-specific backend is permitted.

## Development

From the repository root, launch the Expo web development server with:

```sh
npm run dev
```

Alternatively, run the Frontend-owned command from `Frontend/`:

```sh
npm run dev
```

## Package management

Run npm commands from this directory. `web` and `shared` are the only active workspaces. `.npmrc` enables exact saves, and `npm run check:dependency-pins` rejects ranges such as `^`, `~`, `latest`, `*`, and unbounded workspace ranges.

```sh
npm install --save-exact <package>
npm run validate
```

Expo, NativeWind, TypeScript, lint, and test tooling are configured through the workspace scripts above.
