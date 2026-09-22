# SnapWorth

**Snap a photo of something you own and find out what it's worth.** Then decide whether to keep it private, ask the community if the price looks right, or sell it.

SnapWorth is a mobile-first valuation and peer-to-peer marketplace app, built as the team project for Software Development 3. It runs on iOS, Android, and the web from a single Expo codebase, backed by Supabase.

> **Status:** early development. The web workspace, shared domain types, and design system are in place. Screens are placeholders, and the backend is not built yet. See [Project status](#project-status).

---

## How it works

The product is built around one core loop:

1. **Snap:** take a photo of an item, or pick one from your gallery.
2. **Estimate:** the AI pricing service automatically returns an estimated value. Every photo gets an estimate, and there is no way to skip this step.
3. **Save:** the photo and estimate go straight into your private history.

Everything after that is optional, and the choices can be combined:

| Choice | What happens |
|---|---|
| **Keep private** | The default. The item stays in your history as a personal valuation record. |
| **Post to feed** | The community votes *Too High*, *Too Low*, or *Just Right* and can comment with pricing advice. |
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

| Layer | Technology |
|---|---|
| Frontend framework | [Expo](https://docs.expo.dev) (React Native) + react-native-web, written in TypeScript (strict) |
| Navigation | [Expo Router](https://docs.expo.dev/router/introduction/): file-based routes shared by mobile screens and web URLs |
| Styling | [NativeWind](https://www.nativewind.dev) (Tailwind CSS) |
| Backend | [Supabase](https://supabase.com/docs): Auth, PostgreSQL with row-level security, Storage, Realtime |
| AI price estimation | Provider to be selected, accessed through `PricingAdapter` |
| AI content moderation | Provider to be selected, accessed through `ModerationAdapter` |
| Testing | Jest, React Native Testing Library, fast-check (property tests), Playwright |
| Deployment | EAS (Android build), Expo Go (iOS testing), Vercel (web) |

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
│   ├── web/                  Expo Router website: route files, app config, Tailwind
│   │   └── app/              (auth)/ and (product)/ route groups
│   ├── shared/               Code shared by the website and the mobile app
│   │   └── src/
│   │       ├── types/        Domain types: ids, money, entities, errors, workflow states
│   │       ├── design/       Design tokens, theme, fonts, motion, NativeWind preset
│   │       ├── ports/        Service and platform interfaces
│   │       ├── features/     Feature views (currently placeholders)
│   │       ├── components/   Reusable UI components (planned)
│   │       ├── services/     Domain services (planned)
│   │       └── adapters/     Supabase, pricing, and moderation adapters (planned)
│   ├── mobile/               Expo Router app for iOS and Android
│   └── scripts/              Workspace topology, dependency-pin, and architecture checks
├── Backend/                  Supabase: migrations, seed data, Edge Functions, tests (planned)
├── agents/                   Guidance for AI coding agents
│   ├── AGENTS.md             Start here
│   ├── skills/               offbrand-design UI and motion skill
│   └── specs/snapworth-web/  Requirements, design, and task plan
└── package.json              Root shortcuts to the Frontend scripts
```

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) (current LTS or newer) and npm 11
- For the mobile app: Xcode (iOS Simulator), Android Studio (Android emulator), or [Expo Go](https://expo.dev/go) on a phone

### Install and run

```sh
git clone https://github.com/clark2405/SnapWorth.git
cd SnapWorth/Frontend
npm install
cd ..
npm run dev
```

`npm run dev` starts the Expo web dev server. Open the URL it prints, usually http://localhost:8081.

To run the mobile app instead, use `npm run ios` (iOS Simulator) or `npm run android` (Android emulator). The first run installs Expo Go on the simulator.

> Run `npm install` inside `Frontend/`. The npm workspace lives there, and the root `package.json` only forwards commands to it.

### Scripts

From the repository root:

| Command | What it does |
|---|---|
| `npm run dev` | Start the web development server |
| `npm run ios` / `npm run android` | Start the mobile app in the iOS Simulator or Android emulator |
| `npm run build` | Export a production web build to `Frontend/web/dist/` |
| `npm test` | Run unit tests |
| `npm run validate` | Run every check: topology, dependency pins, static checks, typecheck, lint, unit and property tests |

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

| ID | Milestone | Target |
|---|---|---|
| M1 | Planning and design documents approved | Week 2 (28 Aug) |
| M2 | Development environment ready | Week 5 (18 Sep) |
| M3 | Core loop: photo → AI estimate → history, working end to end | Week 9 (16 Oct) |
| M4 | Feed, voting, comments, and moderation live | Week 12 (6 Nov) |
| M5 | Marketplace and chat live; feature freeze | Week 14 (20 Nov) |
| M6 | User acceptance testing passed | Week 16 (4 Dec) |
| M7 | Deployed, defended, and turned over | Week 17 (12 Dec) |

**Done so far**

- [x] Web-first npm workspace with strict TypeScript, ESLint, Prettier, Jest, and Playwright
- [x] Architecture and dependency-pin checks
- [x] Expo Router routes for every screen (placeholder views)
- [x] Shared domain types and design system (tokens, theme, motion), with tests

**Next**

- [ ] Shared UI components and domain services
- [ ] Authentication, onboarding, and the responsive web shell
- [ ] Capture → estimate → history core loop
- [ ] Supabase schema, row-level security policies, and Edge Functions
- [ ] AI pricing and moderation provider selection (week 6 spike)

The detailed task plan is in [agents/specs/snapworth-web/tasks.md](agents/specs/snapworth-web/tasks.md).

---

## Documentation

| Document | Covers |
|---|---|
| Software Requirements Specification (SRS) v01.00 | What the system must do |
| Software Design Document (SDD) v01.00 | Architecture, data model, components, screens |
| Software Project Management Plan (SPMP) v01.00 | Scope, schedule, budget, risks, team roles |
| [agents/specs/snapworth-web/](agents/specs/snapworth-web/) | Implementation requirements, design, and tasks for the web build |
| [Frontend/README.md](Frontend/README.md) | Workspace details and package management |

---

## Team

| Member | Role | Responsible for |
|---|---|---|
| Ivan Clement P. Cañete | Team Leader: Full Stack / Project Manager | Schedule, architecture decisions, environment, deployment |
| Aldrich A. Segura | Full Stack | Supabase schema, RLS policies, services, AI adapters |
| Clark Jaca | Frontend | Screens, components, navigation, testing |

---

## AI assistance disclosure

In line with the project's academic integrity requirements, AI coding assistants were used during development: GPT 5.6 Sol (via Kiro) and Claude (via Claude Code). Commits they contributed to include a `Co-Authored-By` trailer.
