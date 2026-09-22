# SnapWorth Mobile

The Expo Router app for iOS and Android. It shares every screen, component, token, and product
rule with the website through `../shared/`; the files under `app/` are thin route wrappers that
mirror `../web/app/`. All clients use the single backend in `../../Backend/`.

## Run it

From the repository root:

```sh
npm run ios       # iOS Simulator (installs Expo Go on first run)
npm run android   # Android emulator
```

On a physical phone, run `npm run dev:mobile` and scan the QR code with Expo Go.

## Keeping the shells in step

A route added to `../web/app/` should get the same thin wrapper here. Product UI and behaviour
belong in `../shared/`, never in either shell.
