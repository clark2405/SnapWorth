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
npm run ios           # builds and installs the SnapWorth dev build, then starts Metro
npm run android       # same for the Android emulator
npm run dev:mobile:go # starts Metro in Expo Go mode
```

The first build takes a few minutes; after that, `npm run dev:mobile` starts Metro and the
installed app reloads JavaScript changes. Rebuild only after adding a native dependency or
changing `app.config.ts`.

To open one screen directly while reviewing it, set a start route:

```sh
EXPO_PUBLIC_DEV_START_ROUTE=/item/nike-neon-windbreaker npm run dev:mobile
```

## Camera setup

The full-screen Snap camera uses the phone's rear camera through `expo-camera`. It requests camera
permission and offers Settings when permission is blocked. The shutter is enabled only
after the camera is ready; flash can be toggled before taking a photo. Camera access stops
when the screen loses focus or the app enters the background.

Taking a photo sends its JPEG to the authenticated `estimate-price` Edge Function and displays
Gemini's rough PHP estimate, range, and explanation alongside the actual photo. Retake cancels
the old request; Retry estimates the same photo again. This prototype does not save History
or publish posts. Image processing is performed remotely by Gemini through Supabase;
the provider notice was removed from the capture UI at the user's request.

Startup shows the existing login screen after the first-run introduction. That login is
still a local demo session. Estimation separately establishes a background Supabase anonymous
session, so Anonymous Sign-Ins must be enabled in the Supabase project. The two flows will be
unified when real email authentication is implemented.

The backend function must be deployed before phone estimates work; see `../../Backend/README.md`.

Rebuild and reinstall the Android APK after this native dependency/configuration change;
reloading JavaScript in an older APK is insufficient. Test on a physical phone: grant and
deny camera access, take a photo, retake, switch tabs, and background/return to the app.

## Navigation

- `app/(tabs)/` — the native tab bar (Feed, Market, Search, Chats, History). On iOS 26 it is the
  system Liquid Glass bar and minimises on scroll.
- `app/capture.tsx` — the full-screen camera opened by the Snap control.
- Everything else pushes over the tabs on the root stack. Cards zoom into their detail screen
  on iOS 18+ and peek on long-press; `worthy`, `ask/[id]`, and `list/[id]` present as sheets.
- `src/` holds the shell's glue: the zoom-link bridge, the appearance store, and Worthy's host.

## Keeping the shells in step

A screen added to one shell should get the same thin wrapper in the other (the web keeps its
tab screens under `(product)/`). Product UI and behaviour
belong in `../shared/`, never in either shell.
