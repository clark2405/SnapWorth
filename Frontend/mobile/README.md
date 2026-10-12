# SnapWorth Mobile

The Expo Router app for iOS and Android. It shares every screen, component, token, and product
rule with the website through `../shared/`; the files under `app/` are thin route wrappers.
All clients use the single backend in `../../Backend/`.

The iOS app uses native modules Expo Go does not ship (the Liquid Glass tab bar, zoom
transitions, Reanimated, haptics), so it runs as its own development build, installed on the
simulator as **SnapWorth** with its own icon.

## Run it

From the repository root:

```sh
npm run ios       # builds and installs the SnapWorth dev build, then starts Metro
npm run android   # same for the Android emulator
```

The first build takes a few minutes; after that, `npm run dev:mobile` starts Metro and the
installed app reloads JavaScript changes. Rebuild only after adding a native dependency or
changing `app.config.ts`.

To open one screen directly while reviewing it, set a start route:

```sh
EXPO_PUBLIC_DEV_START_ROUTE=/item/nike-neon-windbreaker npm run dev:mobile
```

## Navigation

- `app/(tabs)/` — the native tab bar (Feed, Market, Snap, Chats, History). On iOS 26 it is the
  system Liquid Glass bar and minimises on scroll.
- Everything else pushes over the tabs on the root stack. Cards zoom into their detail screen
  on iOS 18+ and peek on long-press; `worthy`, `ask/[id]`, and `list/[id]` present as sheets.
- `src/` holds the shell's glue: the zoom-link bridge, the appearance store, and Worthy's host.

## Keeping the shells in step

A screen added to one shell should get the same thin wrapper in the other (the web keeps its
tab screens under `(product)/`). Product UI and behaviour
belong in `../shared/`, never in either shell.
