# SnapWorth

**Snap a photo of something you own and find out what it's worth.** Then decide whether to keep it private, ask the community if the price looks right, or sell it.

SnapWorth is a mobile-first valuation and peer-to-peer marketplace app, built as the team project for Software Development 3. It runs on iOS, Android, and the web from a single Expo codebase, backed by Supabase.

> **Status:** in development. Every screen is built for the web, iOS, and Android. Most run on sample data until their backend is ready. On Supabase today: the photo → AI estimate step, feed comments, and their moderation. Still to come: saving snaps to History, votes, listings, and chat. See [Project status](#project-status).

---

## How it works

The product is built around one core loop:

1. **Snap:** take a photo of an item, or pick one from your gallery.
2. **Estimate:** the AI pricing service automatically returns an estimated value. Every photo gets an estimate, and there is no way to skip this step.
3. **Save:** the photo and estimate go straight into your private history.

Everything after that is optional, and the choices can be combined:

| Choice            | What happens                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Keep private**  | The default. The item stays in your history as a personal valuation record.                                                       |
| **Post to feed**  | The community votes _Too High_, _Too Low_, or _Just Right_ and can comment with pricing advice.                                   |
| **List for sale** | You confirm an asking price yourself. The AI estimate is never published as a price automatically. Buyers can then chat with you. |

A feed post can be added to the marketplace later, and a listing can be reposted to the feed to ask whether the price is fair.

### Features

- Account sign-up, login, and password reset
- Photo capture or gallery upload, with automatic history
- Automatic AI price estimation, with a progress indicator and retry on failure
- Public feed with accuracy voting (one vote per user per post, no voting on your own post)
- Comment threads, with AI moderation of comments and posts before they appear publicly
- Marketplace browsing with category, price range, and location filters
- Real-time one-to-one buyer and seller chat
- Admin review queue for flagged content

**Out of scope:** payments, escrow, shipping, and identity verification. Buyers and sellers arrange payment and handoff privately through chat.

---

## Tech stack

| Layer                 | Technology                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend framework    | [Expo](https://docs.expo.dev) (React Native) + react-native-web, written in TypeScript (strict)                                                                                     |
| Navigation            | [Expo Router](https://docs.expo.dev/router/introduction/): file-based routes shared by mobile screens and web URLs                                                                  |
| Styling               | Design tokens in `shared/src/design` and React Native styles, with a [NativeWind](https://www.nativewind.dev) preset on the web                                                     |
| Animation             | Reanimated and Gesture Handler, with react-native-svg for the drawn pieces                                                                                                          |
| Backend               | [Supabase](https://supabase.com/docs): Auth, PostgreSQL with row-level security, Edge Functions (Storage and Realtime planned)                                                      |
| AI price estimation   | Google Gemini, called by the `estimate-price` Edge Function                                                                                                                         |
| AI content moderation | OpenAI moderation, or local rules for development, chosen by `MODERATION_PROVIDER` in the `moderate-content` Edge Function                                                          |
| On-device AI (iOS)    | Apple Vision checks a photo before upload. Apple Intelligence (Foundation Models) gives a first look at the item and answers Worthy's light questions (`mobile/modules/snap-sense`) |
| Testing               | Jest, React Native Testing Library, fast-check (property tests), Playwright                                                                                                         |
| Deployment            | EAS builds (iOS and Android) and Vercel (web), planned                                                                                                                              |

--------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Frontend framework | [Expo](https://docs.expo.dev) (React Native) + react-native-web, written in TypeScript (strict) |
| Navigation | [Expo Router](https://docs.expo.dev/router/introduction/): file-based routes shared by mobile screens and web URLs |
| Styling | [NativeWind](https://www.nativewind.dev) (Tailwind CSS) |
| Backend | [Supabase](https://supabase.com/docs): Auth, PostgreSQL with row-level security, Storage, Realtime |
| AI price estimation | Provider to be selected, accessed through `PricingAdapter` |
| AI content moderation | Provider to be selected, accessed through `ModerationAdapter` |
| Testing | Jest, React Native Testing Library, fast-check (property tests), Playwright |
| Deployment | EAS builds (iOS and Android), Vercel (web) |

---

## Architecture

The system is split into layers. Each layer may call only the layer directly beneath it.

```
Presentation      Expo Router screens (hold no business rules)
      ↓
Components        Stateless, token-driven UI (ItemCard, PriceBadge, VoteBar, ...)
      ↓
Application       State providers and hooks (AuthProvider, ItemProvider, ModerationGate, ...)
      ↓
Services          Domain rules (ItemService, EstimateService, ListingService, VoteService, ...)
      ↓                                  ↓
Data access       Supabase + RLS         AI adapters → external pricing & moderation providers
```

Three design choices matter most:

- **Every photo produces a stored estimate.** `ItemService` saves the item before asking for an estimate, so a failed estimate never loses the photo.
- **AI providers are swappable.** Only the adapters know which provider is in use, so changing providers touches just those files.
- **Access control lives in the database.** Supabase row-level security keeps private history and chats private, no matter what the client sends.

---

## Repository structure

```
SnapWorth/
├── Frontend/                 npm workspace (run npm commands from here)
│   ├── web/                  Expo Router website: route files, app config
│   │   └── app/              (auth)/ and (product)/ route groups
│   ├── mobile/               Expo Router app for iOS and Android
│   │   ├── app/              Route files
│   │   ├── modules/snap-sense/  iOS native module: photo check, Apple Intelligence
│   │   └── plugins/          Expo config plugins (the iOS 27 scene life cycle)
│   ├── shared/               Code shared by the website and the mobile app
│   │   └── src/
│   │       ├── types/        Domain types: ids, money, entities, errors, workflow states
│   │       ├── design/       Design tokens, theme, fonts, motion, layout
│   │       ├── components/   Reusable UI: the price tag, stickers, Worthy, backdrop, sheets
│   │       ├── features/     Screens' views, one folder per feature
│   │       ├── services/     Domain services (comments so far)
│   │       ├── adapters/     Supabase adapters (auth, comments, pricing) and local stand-ins
│   │       ├── composition/  Wires services to the app
│   │       └── ports/        Service and platform interfaces
│   └── scripts/              Workspace topology, dependency-pin, and source checks
├── Backend/                  Supabase: migrations, seed data, Edge Functions, tests
├── agents/
│   └── READ-FIRST.md         Read before changing anything: product rules, design, gotchas
└── package.json              Root shortcuts to the Frontend scripts
```

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) (current LTS or newer) and npm 11
- For the mobile app: Xcode (iOS Simulator) or Android Studio (Android emulator)

### Install and run

```sh
git clone https://github.com/clark2405/SnapWorth.git
cd SnapWorth/Frontend
npm install
cd ..
npm run dev
```

`npm run dev` starts the Expo web dev server. Open the URL it prints, usually http://localhost:8081.

To run the mobile app instead, use `npm run ios` (iOS Simulator) or `npm run android` (Android emulator). The first run builds and installs the SnapWorth development build, which takes a few minutes.

> Run `npm install` inside `Frontend/`. The npm workspace lives there, and the root `package.json` only forwards commands to it.

### Scripts

From the repository root:

| Command                           | What it does                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Start the web development server                                                                    |
| `npm run ios` / `npm run android` | Start the mobile app in the iOS Simulator or Android emulator                                       |
| `npm run build`                   | Export a production web build to `Frontend/web/dist/`                                               |
| `npm test`                        | Run unit tests                                                                                      |
| `npm run validate`                | Run every check: topology, dependency pins, static checks, typecheck, lint, unit and property tests |

Additional scripts in `Frontend/`: `typecheck`, `lint`, `format`, `test:property`, `test:browser`, `check:architecture`.

### Adding dependencies

Dependencies are pinned to exact versions (`.npmrc` sets `save-exact`), and `npm run check:dependency-pins` rejects `^`, `~`, and `latest` ranges.

```sh
cd Frontend
npm install --save-exact <package> --workspace=@snapworth/web   # or @snapworth/shared
```

---

## Project status

The term runs 17 August to 12 December 2026. Features are delivered in scope tiers: **must have** by week 9, **should have** by week 14, and **could have** only if time allows.

| ID  | Milestone                                                    | Target           |
| --- | ------------------------------------------------------------ | ---------------- |
| M1  | Planning and design documents approved                       | Week 2 (28 Aug)  |
| M2  | Development environment ready                                | Week 5 (18 Sep)  |
| M3  | Core loop: photo → AI estimate → history, working end to end | Week 9 (16 Oct)  |
| M4  | Feed, voting, comments, and moderation live                  | Week 12 (6 Nov)  |
| M5  | Marketplace and chat live; feature freeze                    | Week 14 (20 Nov) |
| M6  | User acceptance testing passed                               | Week 16 (4 Dec)  |
| M7  | Deployed, defended, and turned over                          | Week 17 (12 Dec) |

**Done so far**

- [x] Web-first npm workspace with strict TypeScript, ESLint, Prettier, Jest, and Playwright, checked in CI
- [x] Architecture, dependency-pin, and source checks (including no raw colours outside the tokens)
- [x] Every screen built for the web, iOS, and Android, in the SnapWorth design language: place colours, the kraft price tag, stickers, and Worthy
- [x] A desktop web layout: a sidebar, multi-column grids, and split views
- [x] An animated onboarding tour, and guest browsing: anyone can look around, and an account is asked for, with the reason, only when they act
- [x] Phone sign-in and sign-up with Supabase (email and Google). Without a project configured, it runs on a local session
- [x] Snap → AI estimate on the phone: the camera sends the photo to the `estimate-price` Edge Function (Gemini)
- [x] On-device AI on iOS:
  - a photo check before upload (too dark, blurry, or no item) and reading of labels and barcodes
  - with Apple Intelligence, a first look at the item and Worthy's answers to light questions
- [x] Feed comments and replies end to end: Supabase schema with row-level security, fail-closed moderation Edge Function, comment service, and the threaded UI (see [Backend/README.md](Backend/README.md))
- [x] iOS 27 support: the app adopts the scene life cycle so it opens on iOS 27

**Next**

- [ ] Save each snap and its estimate to History (Supabase schema, Storage, and services)
- [ ] Votes, listings, chat, and the admin queue on Supabase, replacing their sample data
- [ ] Web sign-in against Supabase (the web still starts a local session)
- [ ] Worthy's chat in the cloud, for devices without Apple Intelligence, and real data behind Worthy's price, trend, and collection answers
- [ ] Deploy the `estimate-price` update that uses the phone's photo clues
- [ ] EAS and Vercel deployment

The detailed task plan lives in `agents/specs/snapworth-web/`, which git keeps local (see `.gitignore`).

---

## Documentation

| Document                                          | Covers                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Software Requirements Specification (SRS) v01.00  | What the system must do                                                                       |
| Software Design Document (SDD) v01.00             | Architecture, data model, components, screens                                                 |
| Software Project Management Plan (SPMP) v01.00    | Scope, schedule, budget, risks, team roles                                                    |
| [agents/READ-FIRST.md](agents/READ-FIRST.md)      | Product rules, design language, AI split, and platform gotchas: read before changing anything |
| `agents/specs/snapworth-web/` (local, not in git) | Implementation requirements, design, and tasks for the web build                              |
| [Frontend/README.md](Frontend/README.md)          | Workspace details and package management                                                      |

---

## Team

| Member                 | Role                                      | Responsible for                                                                                                                        |
| ---------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Ivan Clement P. Cañete | Team Leader: Full Stack / Project Manager | Schedule, architecture decisions, environment, deployment                                                                              |
| Aldrich A. Segura      | Full Stack                                | Supabase schema, RLS policies, services, AI adapters                                                                                   |
| Clark Jaca             | Frontend & Mobile                         | Screens, components, navigation, design system and motion, the iOS app's native code (including on-device Apple Intelligence), testing |

---

## AI assistance disclosure

In line with the project's academic integrity requirements, AI coding assistants were used during development: GPT 5.6 Sol (via Kiro) and Claude (via Claude Code). Commits they contributed to include a `Co-Authored-By` trailer.
