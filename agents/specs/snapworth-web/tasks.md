# Implementation Plan: SnapWorth Web

## Overview

Implement SnapWorth Web as a TypeScript Expo/React Native workspace with the browser product delivered first from `Frontend/web/`, reusable product code in `Frontend/shared/`, one deferred placeholder in `Frontend/mobile/`, and one shared Supabase backend in `Backend/`. Each task is sized as a bounded prompt for a `spec-task-execution` agent, builds on earlier waves, and ends by wiring completed code into the next usable slice. UI tasks repeat the mandatory design-skill prerequisite. Tests marked `*` are optional execution tasks but remain part of the dependency graph and planned quality strategy.

## Tasks

- [x] 1. Establish the web-first workspace and enforce architecture boundaries
  - Correct the current planning-placeholder layout before feature implementation and create the tooling that every later task uses.
  - _Requirements: 1.1-1.8, 19.6, 20.1-20.5_
  - _Design: Architecture / Repository and package topology; Layer boundaries and dependency direction; Deployment topology_

  - [x] 1.1 Replace planning-placeholder frontend folders with the canonical workspace topology
    - Inventory the placeholder contents before moving code; create `Frontend/web/`, `Frontend/shared/`, and only a deferred `Frontend/mobile/README.md`, while preserving the single `Backend/` tree.
    - Configure npm workspaces and package scripts at `Frontend/package.json`; do not create a second web implementation or platform-specific backend.
    - Install implementation dependencies only with exact versions (`--save-exact`), reject `^`, `~`, `latest`, and unbounded workspace dependency ranges, and update the lockfile without creating a commit.
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 19.6, 20.1-20.5_
    - _Design: Architecture / Repository and package topology; Deployment topology_

  - [x] 1.2 Configure strict TypeScript, Expo web, NativeWind, linting, and test runners
    - Add shared strict TypeScript bases, Expo/Metro/Babel configuration, Jest or Expo Jest, React Native Testing Library, `fast-check`, Playwright, ESLint, and formatting scripts with exact pinned package versions.
    - Add import-boundary rules for routes, views, components, services, ports, and infrastructure; add checks for raw visual literals, forbidden estimate-to-asking assignments, browser secrets, production mock adapters, and forbidden payment/escrow/shipping/identity/IoT dependencies.
    - Expose non-watch scripts for typecheck, lint, unit tests, property tests, browser tests, and production web build.
    - _Requirements: 1.2-1.5, 4.5, 10.6, 18.6-18.9, 19.6, 20.1-20.5_
    - _Design: Architecture / Layer boundaries; Components and Interfaces / Design tokens; Testing Strategy / Static architecture and type tests_

  - [x] 1.3 Scaffold the Expo Router web route manifest and deferred mobile placeholder
    - Before editing any route UI, read `agents/skills/offbrand-design/SKILL.md` and the applicable route entries in `references/screen-briefs.md`.
    - Create thin route files for every required URL under `Frontend/web/app/`, with route groups that do not change URLs, and placeholders that import route-neutral shared view contracts rather than services or Supabase.
    - Keep `Frontend/mobile/` non-executable and document that one future Expo shell will reuse `Frontend/shared/` after web completion.
    - _Requirements: 1.3, 1.5-1.8_
    - _Design: Architecture / Route ownership and navigation; Repository and package topology_

  - [ ]* 1.4 Add architecture, route-manifest, dependency-pin, and exclusion tests
    - Verify every required URL exists, route files do not import forbidden layers, package versions are exact, mobile remains deferred, and excluded product capabilities have no routes, services, dependencies, or backend tables.
    - Run the targeted lint, typecheck, and route-manifest tests in one-shot mode.
    - _Requirements: 1.3, 1.6-1.8, 19.6, 20.1-20.5_
    - _Design: Testing Strategy / Static architecture and type tests; Requirements coverage by test mode_

- [ ] 2. Build shared domain foundations, design tokens, primitives, and deterministic seeded contracts
  - Establish inward-owned types and UI foundations before feature providers or infrastructure implementations.
  - _Requirements: 5.1-5.8, 15.2-15.15, 16.1-16.8, 19.1-19.8_
  - _Design: Components and Interfaces; Data Models / Domain types; Operational states, motion, and accessibility_

  - [x] 2.1 Implement branded domain types, results, errors, clocks, IDs, and service ports
    - Create branded IDs, UTC date and minor-unit money types, `Result`, `AppError`, `AsyncState`, entity/state unions, pagination cursors, clocks, ID generators, network ports, and the service interfaces from the design.
    - Encode valid state transitions and price semantics so AI estimates and asking prices cannot be assigned interchangeably.
    - _Requirements: 4.7-4.11, 5.1, 6.1-6.8, 7.1-7.7, 8.1-8.8, 9.1-9.8, 10.1-10.8, 11.1-11.10, 12.1-12.9, 14.1-14.6, 16.5-16.7_
    - _Design: Components and Interfaces / Application-facing service ports; Data Models / Domain types; Error Handling / Error algebra_

  - [x] 2.2 Implement SnapWorth tokens, NativeWind preset, themes, fonts, and motion preference
    - Before editing UI foundations, read `agents/skills/offbrand-design/SKILL.md` and its token, accessibility, motion, and performance rules.
    - Create the immutable token source, generated NativeWind preset, light/dark semantic theme resolution, font loading contracts, focus/touch-target tokens, and reduced-motion hook without raw component literals.
    - _Requirements: 1.4, 15.2-15.14, 16.1-16.4_
    - _Design: Components and Interfaces / Design tokens and NativeWind; Operational states, motion, and accessibility_

  - [~] 2.3 Implement shared UI primitives and honest-price components
    - Before editing UI components, read `agents/skills/offbrand-design/SKILL.md` and the applicable entries in `references/screen-briefs.md`.
    - Implement accessible buttons, text inputs, `PhotoFrame`, `EstimateBadge`, `AskingPriceBadge`, `ProgressIndicator`, skeletons, `EmptyState`, `ErrorState`, `OfflineBanner`, cards, `VoteBar`, `FilterBar`, and `ChatBubble` as stateless token-driven components.
    - Keep `EstimateBadge` and `AskingPriceBadge` as separate exports; enforce one filled primary action, 44-by-44 minimum targets, accessible icon labels, non-color cues, scalable text, and meaningful photo alternatives.
    - _Requirements: 5.1-5.8, 8.6-8.7, 11.6-11.10, 15.4-15.15, 16.1-16.8_
    - _Design: Components and Interfaces / Core UI contracts; Estimate and asking-price contracts; Item and collection components_

  - [~] 2.4 Implement seeded runtime configuration and contract-test fakes
    - Build deterministic repositories, pricing/moderation adapters, seeded auth/session roles, clocks, IDs, pagination, scenario failures, and `createDependencies` validation behind the shared ports.
    - Make seed-controlled flows support all non-administrator routes and normalized storage, estimation, Feed, Marketplace, Chat, moderation, offline, timeout, and failed-send states without paid calls.
    - _Requirements: 18.10, 19.1-19.8_
    - _Design: Components and Interfaces / Seeded mode and Supabase mode; Deployment topology_

  - [ ]* 2.5 Write Property 7 test in a dedicated property file
    - Before testing UI output, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 7: EstimateBadge anatomy is invariant**
    - Use `fast-check` with at least 100 runs and the exact design-property tag.
    - **Validates: Requirements 5.2, 5.3, 5.4**

  - [ ]* 2.6 Write Property 8 test in a dedicated property file
    - Before testing UI output, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 8: AskingPriceBadge anatomy is invariant**
    - Use `fast-check` with at least 100 runs and the exact design-property tag.
    - **Validates: Requirements 5.5, 5.6, 10.7**

  - [ ]* 2.7 Write Property 9 test in a dedicated property file
    - Before testing UI output, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 9: Provisional styling is exclusive to estimates**
    - Generate monetary component trees and combine runtime assertions with compile-time misuse fixtures.
    - **Validates: Requirements 5.7**

  - [ ]* 2.8 Write Property 10 test in a dedicated property file
    - Before testing UI output, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 10: Every item representation includes an accessible photo**
    - Generate Stored Item, Feed Post, and Listing representations for at least 100 runs.
    - **Validates: Requirements 5.8, 15.15**

  - [ ]* 2.9 Write Property 30 test in a dedicated property file
    - Before testing UI semantics, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 30: Interactive semantics do not rely on visual color alone**
    - Generate Product Route states and assert primary-action, accessible-name, and redundant-cue invariants.
    - **Validates: Requirements 15.5, 15.6, 15.7**

  - [ ]* 2.10 Write Property 31 test in a dedicated property file
    - Before testing design tokens, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 31: Token contrast meets the applicable threshold**
    - Generate all declared semantic pairings and record computed ratios against 4.5:1 and 3:1 classifications.
    - **Validates: Requirements 15.8, 15.9**

  - [ ]* 2.11 Write Property 32 test in a dedicated property file
    - Before testing themes, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 32: Themes resolve every semantic token**
    - Generate component-consumable token names and verify complete light/dark resolution without raw fallback values.
    - **Validates: Requirements 15.14**

  - [ ]* 2.12 Write Property 33 test in a dedicated property file
    - Before testing motion behavior, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 33: Reduced motion preserves semantic output**
    - Generate sanctioned transitions and compare semantic/accessibility output while excluding transforms and count-up in reduced mode.
    - **Validates: Requirements 16.3, 16.4**

  - [ ]* 2.13 Write Property 34 test in a dedicated property file
    - Before testing error UI, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 34: Retryable errors remain actionable**
    - Generate normalized retryable errors and prior/recoverable state for at least 100 runs.
    - **Validates: Requirements 16.6**

  - [ ]* 2.14 Write Property 37 test in a dedicated property file
    - **Property 37: Seeded providers are deterministic and normalized**
    - Generate seeds and normalized requests; verify repeatability and absence of vendor-specific fields for at least 100 runs.
    - **Validates: Requirements 19.3, 19.4, 19.5**

  - [ ]* 2.15 Add targeted primitive, accessibility, theme, and seeded-contract unit tests
    - Before testing UI components, read `agents/skills/offbrand-design/SKILL.md`.
    - Cover keyboard activation, focus visibility, live regions, touch targets, font scaling, loading/empty/error states, deterministic scenarios, and error-copy normalization with concrete examples.
    - _Requirements: 5.1-5.8, 15.2-15.15, 16.1-16.8, 19.1-19.8_
    - _Design: Testing Strategy / Example-based unit/component tests; Component/accessibility tests_

- [ ] 3. Implement authentication, onboarding, route guards, and the responsive web shell
  - Deliver the first navigable seeded web slice without bypassing shared service boundaries.
  - _Requirements: 2.1-2.10, 3.1-3.6, 15.1, 15.4-15.14, 19.1_
  - _Design: Architecture / Route ownership and navigation; Responsive web shell; Cross-cutting application state_

  - [~] 3.1 Implement auth/session application state and service orchestration
    - Add session observation, signup, login, reset, signout, onboarding completion, role selectors, cache/subscription cleanup, and normalized errors against injected `AuthService` and profile ports.
    - Support deterministic anonymous, user, owner, and administrator sessions in seeded mode.
    - _Requirements: 2.1-2.5, 2.9-2.10, 3.1-3.3, 19.1_
    - _Design: Components and Interfaces / Application-facing service ports; Architecture / Route ownership and navigation_

  - [~] 3.2 Implement auth and onboarding shared views
    - Before editing UI, read `agents/skills/offbrand-design/SKILL.md` and the auth/onboarding screen briefs.
    - Build route-neutral login, signup, reset-password, and no-more-than-three-step skippable onboarding views with one dominant element, one filled primary action, accessible forms, and complete submitting/offline/error/success states.
    - _Requirements: 2.1-2.5, 3.1-3.3, 15.4-15.14, 16.5-16.7_
    - _Design: Operational states, motion, and accessibility; Architecture / Route ownership and navigation_

  - [~] 3.3 Wire root session gate, route guards, navigation, and responsive shell
    - Before editing UI, read `agents/skills/offbrand-design/SKILL.md` and every shell-relevant screen brief.
    - Implement resolving/anonymous/authenticated root states, onboarding redirect, product/admin guards, not-found-or-denied behavior, compact bottom navigation, medium/expanded rails, theme switching, safe areas, focus restoration, and browser deep links.
    - Preserve route content/action access from 320 through 1920 CSS pixels and at 200% text scaling without horizontal page scrolling.
    - _Requirements: 1.3, 1.7-1.8, 2.6-2.10, 3.3-3.5, 15.1, 15.4-15.14_
    - _Design: Architecture / Route ownership and navigation; Responsive web shell_

  - [ ]* 3.4 Write Property 1 test in a dedicated property file
    - **Property 1: Route guards resolve deterministically**
    - Generate required routes, sessions, onboarding states, and roles with at least 100 runs.
    - **Validates: Requirements 2.6, 2.7, 2.9, 19.1**

  - [ ]* 3.5 Write Property 2 test in a dedicated property file
    - **Property 2: Recoverable input survives offline transitions**
    - Generate photo, asking-price, comment, and message drafts against the shared state transition model.
    - **Validates: Requirements 3.6, 16.7**

  - [ ]* 3.6 Add auth, onboarding, guard, keyboard, and accessibility tests
    - Before testing UI, read `agents/skills/offbrand-design/SKILL.md`.
    - Cover valid and invalid auth outcomes, reset initiation, signout cleanup, onboarding completion/skip, no protected-content flash, admin denial, focus order, labels, live errors, and reduced motion.
    - _Requirements: 2.1-2.10, 3.1-3.3, 15.6-15.14, 16.3-16.7_
    - _Design: Testing Strategy / Example-based unit/component tests; Component/accessibility tests_

  - [ ]* 3.7 Add seeded browser tests for route access and responsive shell behavior
    - Before testing UI, read `agents/skills/offbrand-design/SKILL.md` and shell screen briefs.
    - Use Playwright at compact, medium, and expanded widths plus 200% text scaling to verify route redirects, deep links, no horizontal page overflow, keyboard navigation, one primary action, and light/dark rendering.
    - _Requirements: 1.7-1.8, 2.6-2.10, 3.4-3.5, 15.1, 15.4-15.14_
    - _Design: Testing Strategy / Web end-to-end tests; Visual/responsive tests_

- [~] 4. Checkpoint - Ensure foundation tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.1-5.8, 15.1-16.8, 19.1-20.5_
  - _Design: Testing Strategy_

- [ ] 5. Implement capture, durable persistence, estimation, item detail, and History
  - Complete the must-have product loop against seeded ports before live Supabase wiring.
  - _Requirements: 3.4-3.6, 4.1-4.11, 5.2-5.9, 6.1-6.8, 17.1-17.2, 17.6-17.7, 19.2, 19.8_
  - _Design: Capture, persistence, and estimation sequence; Data Models / Domain types; Error Handling / Recovery behavior_

  - [~] 5.1 Implement bounded browser image validation and compression
    - Validate JPEG, PNG, and WebP inputs up to 20 MiB; normalize orientation, strip unnecessary metadata, cap the long edge at 2048 pixels, and target a WebP/JPEG upload no larger than 2 MiB without uploading rejected inputs.
    - Return typed errors with applicable limits while preserving access to the selected photo.
    - _Requirements: 4.1, 17.6, 17.7_
    - _Design: Capture, persistence, and estimation sequence; Performance and Media Budgets_

  - [~] 5.2 Implement item/history repositories and state transitions in seeded mode
    - Add storing/finalization, owner-scoped photo references, estimating/estimated/failed/queued states, cursor History, owned item retrieval, deletion/tombstone behavior, and cleanup compensation contracts.
    - Keep incomplete storing rows out of History and make retries/idempotent cleanup safe.
    - _Requirements: 4.2-4.3, 4.6-4.11, 6.1-6.4, 18.1-18.4, 19.2_
    - _Design: Data Models / PostgreSQL schema; Storage model; Deletion and retention_

  - [~] 5.3 Implement capture and estimate orchestration
    - Enforce validate/compress → create item → upload photo → finalize/History estimating → automatic estimate ordering, item-scoped idempotency, attempt increments, stale-response rejection, ten-second explicit outcome, retry-in-place, and offline recovery.
    - Normalize seeded pricing responses into branded `AiEstimate` values and never expose a skip-estimate control.
    - _Requirements: 4.1-4.11, 17.1-17.2, 19.2-19.5, 19.8_
    - _Design: Capture, persistence, and estimation sequence; Error Handling / Transaction and compensation boundaries_

  - [~] 5.4 Implement capture, item-detail, History, and destination views and routes
    - Before editing UI, read `agents/skills/offbrand-design/SKILL.md` and the capture, item, and History screen briefs.
    - Implement one-action camera/gallery access with gallery fallback, recoverable selection, photo-first estimation wait, delayed progress, honest estimate/failure presentation, retry, History skeleton/empty/grid/delete states, and exact item navigation.
    - Offer Private, Feed, and Marketplace as distinct post-estimate destinations; keep listing price empty and preserve estimate semantics.
    - _Requirements: 3.4-3.6, 4.5-4.11, 5.2-5.9, 6.1-6.8, 15.1-16.8, 17.2_
    - _Design: Capture, persistence, and estimation sequence; Operational states, motion, and accessibility_

  - [ ]* 5.5 Write Property 3 test in a dedicated property file
    - **Property 3: Uploads contain validated compressor output**
    - Generate MIME types, dimensions, byte sizes, orientations, and compressor outcomes without unbounded buffers.
    - **Validates: Requirements 4.1, 17.6, 17.7**

  - [ ]* 5.6 Write Property 4 test in a dedicated property file
    - **Property 4: Durable storage precedes automatic estimation**
    - Generate capture event traces and verify ordering, identity, and estimating History state for at least 100 runs.
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.6**

  - [ ]* 5.7 Write Property 5 test in a dedicated property file
    - **Property 5: Successful estimation is associated atomically**
    - Generate current and stale attempts and normalized estimates.
    - **Validates: Requirements 4.7, 4.8**

  - [ ]* 5.8 Write Property 6 test in a dedicated property file
    - **Property 6: Estimate failure preserves the durable item and retries in place**
    - Generate retryable pricing failures and attempt sequences with at least 100 runs.
    - **Validates: Requirements 4.9, 4.10, 4.11**

  - [ ]* 5.9 Write Property 11 test in a dedicated property file
    - **Property 11: Private destination has no public side effect**
    - Generate estimated items and initial Feed/Listing sets.
    - **Validates: Requirements 6.6**

  - [ ]* 5.10 Write Property 12 test in a dedicated property file
    - **Property 12: Public destination setup preserves price meaning**
    - Generate estimates and assert no asking-price construction or prepopulation.
    - **Validates: Requirements 6.7, 6.8, 10.2**

  - [ ]* 5.11 Write Property 35 test in a dedicated property file
    - Before testing estimation UI, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 35: Estimation progress appears at the threshold with the photo retained**
    - Use a fake clock around the two-second boundary for at least 100 generated request durations.
    - **Validates: Requirements 17.2**

  - [ ]* 5.12 Write Property 40 test in a dedicated property file
    - **Property 40: History selection preserves item identity**
    - Generate History pages and selections and verify the exact branded route ID.
    - **Validates: Requirements 6.3**

  - [ ]* 5.13 Add targeted capture, retry, History, and destination unit/contract tests
    - Before testing capture, item, or History UI, read `agents/skills/offbrand-design/SKILL.md` and the applicable screen briefs.
    - Cover camera denial/gallery fallback, invalid files, compression floor failure, upload/finalize compensation, explicit timeout, stale response, estimate-failure reassurance, deletion confirmation, empty History, and no asking-price prefill.
    - _Requirements: 3.4-3.6, 4.1-4.11, 5.9, 6.1-6.8, 17.1-17.2, 17.6-17.7, 19.8_
    - _Design: Testing Strategy / Example-based tests; Shared contract tests_

  - [ ]* 5.14 Add seeded browser tests for the complete capture-to-History loop
    - Before testing UI, read `agents/skills/offbrand-design/SKILL.md` and capture/item/History screen briefs.
    - Verify success, progress threshold, retryable estimate failure, offline recovery, reload from History, private destination, Feed handoff, empty listing price, keyboard operation, reduced motion, and responsive layouts.
    - _Requirements: 3.4-6.8, 15.1-16.8, 17.2, 19.2, 19.8_
    - _Design: Testing Strategy / Web end-to-end tests; Visual/responsive tests_

- [ ] 6. Implement Feed publication, voting, comments, reports, and fail-closed moderation
  - Build the should-have social slice against seeded repositories and normalized moderation before live backend work.
  - _Requirements: 7.1-7.7, 8.1-8.8, 9.1-9.8, 19.2-19.5, 19.8_
  - _Design: Feed, votes, comments, and moderation; Error Handling / Recovery behavior_

  - [~] 6.1 Implement Feed, comment, report, and moderation domain services with seeded repositories
    - Add idempotent Feed publication, approved/held/withdrawn visibility, stable cursor pages, detail queries, fail-closed comment moderation, author-held receipts, soft deletion, and target-preserving reports.
    - Keep public results restricted to approved non-deleted content and render public text as plain text.
    - _Requirements: 7.1-7.7, 9.1-9.8, 18.9-18.10, 19.2-19.5, 19.8_
    - _Design: Feed, votes, comments, and moderation; Data Models / PostgreSQL schema_

  - [~] 6.2 Implement transactional vote behavior and optimistic provider state
    - Model one active vote per `(post,user)`, choice replacement, active-choice withdrawal, own-post rejection, authoritative aggregate counts, pending projection, and exact rollback/retry on failure.
    - _Requirements: 8.1-8.8, 19.2, 19.8_
    - _Design: Feed, votes, comments, and moderation; Cross-cutting application state_

  - [~] 6.3 Implement Feed/post views and route wiring
    - Before editing UI, read `agents/skills/offbrand-design/SKILL.md` and the Feed/Post screen briefs.
    - Build paginated Feed and detail views with photo-dominant cards, EstimateBadge, skeleton/empty/error states, accessible VoteBar, pending/rollback feedback, moderated comment drafts, held notices, delete/report controls, and one screen-level filled action.
    - _Requirements: 7.4-7.7, 8.4-8.8, 9.2-9.8, 15.1-16.8_
    - _Design: Components and Interfaces / Item and collection components; Operational states, motion, and accessibility_

  - [ ]* 6.4 Write Property 13 test in a dedicated property file
    - **Property 13: Feed publication preserves association and visibility rules**
    - Generate eligible items and moderation/publication/deletion outcomes.
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [ ]* 6.5 Write Property 15 test in a dedicated property file
    - **Property 15: Unpublishing removes public visibility idempotently**
    - Generate posts and repeated withdrawal counts for at least 100 runs.
    - **Validates: Requirements 7.6**

  - [ ]* 6.6 Write Property 16 test in a dedicated property file
    - **Property 16: Vote operations match the one-vote reference model**
    - Use model-based commands for users, choices, replacements, and withdrawals.
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [ ]* 6.7 Write Property 17 test in a dedicated property file
    - **Property 17: Owners cannot change their own post tally**
    - Generate owner/post/vote combinations and assert unchanged authoritative state.
    - **Validates: Requirements 8.5**

  - [ ]* 6.8 Write Property 18 test in a dedicated property file
    - Before testing VoteBar UI, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 18: Vote rendering and rollback preserve confirmed truth**
    - Generate confirmed snapshots, desired choices, and failed requests.
    - **Validates: Requirements 8.6, 8.8**

  - [ ]* 6.9 Write Property 20 test in a dedicated property file
    - **Property 20: Comment deletion and reporting preserve thread policy**
    - Generate approved comments, owners, visible targets, and valid reasons.
    - **Validates: Requirements 9.7, 9.8**

  - [ ]* 6.10 Add Feed, vote, comment, moderation, accessibility, and browser tests
    - Before testing UI, read `agents/skills/offbrand-design/SKILL.md` and Feed/Post screen briefs.
    - Cover Feed empty/load/failure, held visibility, own-post vote rejection, pending/rollback, active-choice withdrawal, comment approval/hold/provider outage, plain-text rendering, deletion, reporting, keyboard use, light/dark, and responsive pagination.
    - _Requirements: 7.1-9.8, 15.1-16.8, 17.3, 19.2-19.5, 19.8_
    - _Design: Testing Strategy / Unit, component, browser, and accessibility tests_

- [~] 7. Checkpoint - Ensure core-loop and Feed tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 3.4-9.8, 15.1-17.7, 19.2-19.8_
  - _Design: Testing Strategy_

- [ ] 8. Implement manual asking-price confirmation and Marketplace browsing
  - Complete seller-controlled listing publication and filtered Marketplace behavior without converting AI estimates into seller prices.
  - _Requirements: 10.1-10.8, 11.1-11.10, 13.1-13.4, 17.4, 19.2-19.5_
  - _Design: Manual asking-price and listing flow; Marketplace and filtering_

  - [~] 8.1 Implement locale-aware asking-price parsing and listing publication services
    - Parse supported locale decimal strings into positive integer USD cents from `0.01` through `999,999,999.99`; reject empty, ambiguous, nonnumeric, non-positive, fractional-cent, and overflow input.
    - Construct asking prices only from authenticated user input, enforce one active/held listing per item, and submit publication through normalized fail-closed moderation.
    - _Requirements: 10.1-10.8, 18.9-18.10, 19.2-19.5_
    - _Design: Estimate and asking-price contracts; Manual asking-price and listing flow_

  - [~] 8.2 Implement Marketplace query, filter, pagination, and listing-detail services
    - Add AND-semantics category, inclusive price, optional coarse-region, active/approved status, stable cursor ordering, filtered-empty metadata, clear-all behavior, and owner/status action selectors.
    - Keep location disabled by default and reject invalid ranges before repository queries.
    - _Requirements: 11.1-11.10, 17.4, 19.2_
    - _Design: Marketplace and filtering; Data Models / Domain types_

  - [~] 8.3 Implement listing-form, Marketplace, and listing-detail views and routes
    - Before editing UI, read `agents/skills/offbrand-design/SKILL.md` and listing/Marketplace screen briefs.
    - Render the AI Estimate only as a non-editable EstimateBadge reference, initialize an empty asking-price field, disable publication until valid explicit confirmation, and render confirmed prices through AskingPriceBadge.
    - Build responsive Marketplace/listing states with photo-first cards, filters/clear control, named filter-relaxation empty state, skeletons, status-aware contact, owner actions, and one filled primary action.
    - _Requirements: 10.1-10.8, 11.2-11.10, 15.1-16.8_
    - _Design: Manual asking-price and listing flow; Marketplace and filtering; Operational states_

  - [ ]* 8.4 Write Property 21 test in a dedicated property file
    - **Property 21: Asking-price parsing preserves valid cents and rejects invalid publication**
    - Generate safe cents, supported locales, and invalid input classes for at least 100 runs.
    - **Validates: Requirements 10.3, 10.4, 10.5**

  - [ ]* 8.5 Write Property 22 test in a dedicated property file
    - **Property 22: Marketplace results equal the filter model**
    - Compare generated listing collections and filter combinations with a simple reference model.
    - **Validates: Requirements 11.1, 11.3, 11.4, 11.5**

  - [ ]* 8.6 Write Property 23 test in a dedicated property file
    - Before testing filter-control UI, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 23: Filter controls derive from active filter state**
    - Generate all filter-state combinations and filtered-empty results.
    - **Validates: Requirements 11.6, 11.7**

  - [ ]* 8.7 Write Property 14 test in a dedicated property file
    - **Property 14: Cursor pagination is stable and complete**
    - Generate finite visible Feed/Listing sets, ties, and page sizes; traverse every returned cursor.
    - **Validates: Requirements 7.4, 11.2**

  - [ ]* 8.8 Write Property 24 test in a dedicated property file
    - Before testing listing action UI, read `agents/skills/offbrand-design/SKILL.md`.
    - **Property 24: Listing actions reflect status and ownership**
    - Generate listing states and viewer identities.
    - **Validates: Requirements 11.9, 11.10**

  - [ ]* 8.9 Write Property 19 test in a dedicated property file
    - **Property 19: Public-content moderation fails closed**
    - Generate Feed Post, Comment, and Listing submissions plus approval, review, transport, and provider outcomes.
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 10.8**

  - [ ]* 8.10 Add money, listing, filtering, component, and accessibility tests
    - Before testing UI, read `agents/skills/offbrand-design/SKILL.md` and listing/Marketplace screen briefs.
    - Cover exact boundary prices, locale ambiguities, empty field, estimate non-editability, held listing, location flag, endpoint-inclusive filters, clear control, owner/sold/withdrawn actions, keyboard filters, photos, badges, and responsive states.
    - _Requirements: 10.1-11.10, 15.1-16.8, 19.2-19.5_
    - _Design: Testing Strategy / Unit, component, and accessibility tests_

  - [ ]* 8.11 Add seeded Marketplace browser and controlled-network budget tests
    - Before testing UI, read `agents/skills/offbrand-design/SKILL.md` and Marketplace screen briefs.
    - Verify capture-to-listing with manual price, moderation hold/approval, category/price filters, URL filter state, filtered-empty guidance, details, responsive layouts, and first usable Marketplace page within three seconds.
    - _Requirements: 6.8, 10.1-11.10, 15.1-16.8, 17.4, 19.2_
    - _Design: Testing Strategy / Web end-to-end tests; Performance tests_

- [ ] 9. Implement deferred Chat, cross-posting, and Admin Review seams
  - Keep lower-priority routes honest and contract-complete without expanding the approved delivery priority.
  - _Requirements: 12.1-12.9, 13.1-13.4, 14.1-14.6, 17.5, 19.2_
  - _Design: Deferred Chat, cross-post, and Admin seams_

  - [~] 9.1 Implement Chat contracts, seeded repository, delivery state, and authorization model
    - Add open-or-reuse uniqueness, descending conversation order, participant authorization, pending/delivered/failed message state, client-message idempotency, retry draft retention, symmetric blocks, scoped subscription interfaces, and reconnect de-duplication.
    - _Requirements: 12.1-12.9, 17.5, 18.3, 19.2_
    - _Design: Components and Interfaces / Deferred interfaces; Realtime model_

  - [~] 9.2 Implement Chat route-neutral views and feature-flagged routes
    - Before editing UI, read `agents/skills/offbrand-design/SKILL.md` and Chat screen briefs.
    - Build accessible conversation list/thread, pending/delivered/failed states, exact retry text preservation, blocked state, empty Marketplace path, and an honest unavailable state when the seam is disabled.
    - _Requirements: 12.2-12.9, 15.1-16.8, 17.5_
    - _Design: Deferred Chat, cross-post, and Admin seams; Operational states_

  - [~] 9.3 Implement Admin Review contracts, seeded queue, and feature-flagged review view
    - Before editing Admin UI, read `agents/skills/offbrand-design/SKILL.md` and the Admin Review screen brief.
    - Add priority/time/ID ordering, administrator-only selectors, approve/remove outcomes, optimistic version checks, duplicate-decision prevention, queue states, and honest disabled-seam behavior.
    - _Requirements: 2.8, 14.1-14.6, 15.1-16.8_
    - _Design: Deferred Chat, cross-post, and Admin seams; Data Models / RLS and authorization matrix_

  - [~] 9.4 Implement feature-flagged cross-post domain orchestration
    - Reuse item/photo identity, require fresh manual Asking Price for Feed-to-Marketplace, preserve Listing seller value only as Asking Price context for Marketplace-to-Feed, and retain separate monetary fields.
    - _Requirements: 13.1-13.4_
    - _Design: Manual asking-price and listing flow; Deferred Chat, cross-post, and Admin seams_

  - [ ]* 9.5 Write Property 25 test in a dedicated property file
    - **Property 25: Listing contact reuses one correctly ordered conversation**
    - Generate listings, participants, repeated contacts, and activity ties.
    - **Validates: Requirements 12.1, 12.2**

  - [ ]* 9.6 Write Property 26 test in a dedicated property file
    - **Property 26: Message failures and blocks preserve safe conversation state**
    - Generate message bodies, client IDs, failures, retries, and blocks in both directions.
    - **Validates: Requirements 12.5, 12.7, 12.8**

  - [ ]* 9.7 Write Property 27 test in a dedicated property file
    - **Property 27: Cross-posting preserves item and monetary semantics**
    - Generate eligible Feed Posts/Listings and both cross-post directions while the flag is enabled.
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4**

  - [ ]* 9.8 Write Property 28 test in a dedicated property file
    - **Property 28: Admin queue ordering is deterministic**
    - Generate unresolved cases with priority/time ties.
    - **Validates: Requirements 14.2**

  - [ ]* 9.9 Write Property 29 test in a dedicated property file
    - **Property 29: Admin resolution is single-winner and policy preserving**
    - Generate concurrent decisions sharing an expected version.
    - **Validates: Requirements 14.3, 14.4, 14.5**

  - [ ]* 9.10 Add deferred-seam unit, accessibility, and browser tests
    - Before testing UI, read `agents/skills/offbrand-design/SKILL.md` and Chat/Admin screen briefs.
    - Cover unauthorized conversation denial without disclosure, list/thread empty states, pending confirmation/failure, retry, block, disabled seam, admin-role guard, ordered queue, decision conflict, and cross-post price semantics.
    - _Requirements: 2.8, 12.1-14.6, 15.1-16.8, 17.5, 18.3_
    - _Design: Testing Strategy / Unit, browser, and accessibility tests_

- [ ] 10. Implement the shared Supabase backend, security policies, Edge Functions, and live adapters
  - Replace seeded infrastructure at the composition root without changing shared route or domain contracts.
  - _Requirements: 2.1-2.5, 4.2-4.11, 7.1-14.6, 17.1, 17.3-17.5, 18.1-18.10, 19.4-19.8_
  - _Design: Data Models; Edge Function contracts; Security and Privacy_

  - [~] 10.1 Create ordered migrations for profiles, private items, estimate attempts, and retention queues
    - Add constrained enums/checks, indexes, timestamps, current-attempt protection, soft deletion, cleanup queue, protected administrator metadata helper, and default-deny RLS enablement.
    - Keep exact retention durations configurable without changing route contracts.
    - _Requirements: 2.8, 4.2-4.11, 6.1-6.4, 14.1, 18.1-18.4_
    - _Design: Data Models / PostgreSQL schema; Deletion and retention_

  - [~] 10.2 Create ordered migrations for Feed, votes, comments, listings, Chat, blocks, moderation, and reports
    - Add unique keys, positive-price constraints, stable indexes, idempotency columns, moderation/status checks, conversation/message uniqueness, and server-only rate-limit storage.
    - _Requirements: 7.1-14.6, 18.7_
    - _Design: Data Models / PostgreSQL schema; Realtime model_

  - [~] 10.3 Implement private-item, Storage, item-finalization, estimate-attempt, and deletion authorization
    - Create the private `item-photos` bucket path policies, owner-only row policies, signed-delivery seams, trusted finalization RPC, stale-attempt guard, item deletion/withdrawal transaction, and idempotent object cleanup worker/queue.
    - Use fixed `search_path`, explicit grants, and `auth.uid()` validation in privileged functions.
    - _Requirements: 4.2-4.11, 6.1-6.4, 18.1-18.4_
    - _Design: Data Models / Storage model; RLS and authorization matrix; Deletion and retention_

  - [~] 10.4 Implement public projections and transactional Feed, vote, comment, listing, filter, and report operations
    - Expose only approved public fields/photo delivery, implement `set_vote`, publication/withdrawal, comment/report, active Listing/filter pagination, and fail-closed visibility without direct cross-owner private-item access.
    - _Requirements: 7.1-11.10, 13.1-13.4, 18.1-18.4, 18.10_
    - _Design: Feed, votes, comments, and moderation; Marketplace and filtering; RLS matrix_

  - [~] 10.5 Implement participant-scoped Chat, Realtime authorization, and administrator moderation operations
    - Add conversation open/reuse, participant-only reads/subscriptions, blocked-send checks, idempotent message inserts, admin queue projection, protected-role authorization, and versioned single-winner resolution.
    - _Requirements: 2.8, 12.1-12.9, 14.1-14.6, 17.5, 18.3_
    - _Design: Data Models / RLS matrix; Realtime model; Deferred Chat and Admin seams_

  - [~] 10.6 Implement shared Edge Function authentication, CORS, errors, secrets, deadlines, and rate limits
    - Add JWT verification, ownership/role helpers, configured-origin CORS, stable redacted errors, request IDs, idempotency helpers, per-user/per-target limits, safe logs, and provider interfaces in `Backend/supabase/functions/_shared/`.
    - Keep provider/service-role secrets out of client code and responses.
    - _Requirements: 17.1, 18.5-18.10_
    - _Design: Edge Function contracts; Security and Privacy_

  - [~] 10.7 Implement the authenticated `estimate-price` Edge Function
    - Verify finalized item ownership and photo existence, enforce attempt/idempotency/rate limits, create a server-readable photo reference, apply a hard deadline, normalize provider output/errors, and persist only the current attempt.
    - _Requirements: 4.4, 4.7-4.11, 17.1, 18.6-18.9, 19.4_
    - _Design: Edge Function contracts / estimate-price; Capture sequence_

  - [~] 10.8 Implement the authenticated `moderate-content` Edge Function
    - Verify authorship and canonical target content, enforce idempotency/rate limits, normalize provider verdicts, permit only `pending → approved | held`, and reject development permit-all markers in production.
    - _Requirements: 7.1-7.3, 9.1-9.6, 10.8, 18.6-18.10, 19.5_
    - _Design: Edge Function contracts / moderate-content; Feed, votes, comments, and moderation_

  - [~] 10.9 Implement Supabase client repositories against the shared ports
    - Add Auth, item/history, Storage, Feed, vote, comment/report, listing/Marketplace, Chat/Realtime, and Admin implementations that normalize rows/errors and never leak vendor payloads above the boundary.
    - Reconcile Realtime reconnects by cursor and de-duplicate messages by server/client IDs.
    - _Requirements: 2.1-2.5, 4.2-14.6, 18.1-18.4, 19.4-19.7_
    - _Design: Components and Interfaces / Seeded and Supabase modes; Realtime model_

  - [~] 10.10 Implement live pricing/moderation adapters and production-safe composition
    - Wire authenticated Edge Function clients through provider-neutral adapters; validate browser-visible configuration, production mode, adapter selection, feature flags, and startup failure behavior.
    - Ensure routes and feature providers receive the same contracts in seeded and Supabase modes with no route-level mode branches.
    - _Requirements: 18.5-18.10, 19.4-19.8_
    - _Design: Deployment topology; Seeded mode and Supabase mode; Security and Privacy_

  - [ ]* 10.11 Write Property 36 test in a dedicated property file
    - **Property 36: Production configuration fails closed**
    - Generate runtime configurations and publication markers for at least 100 runs without contacting external services.
    - **Validates: Requirements 18.10**

  - [ ]* 10.12 Write Property 38 test in a dedicated property file
    - **Property 38: Repository implementations are substitutable**
    - Generate contract scenarios and compare seeded with Supabase-adapter behavior through fake/local transports, avoiding 100 external calls.
    - **Validates: Requirements 19.7**

  - [ ]* 10.13 Write Property 39 test in a dedicated property file
    - **Property 39: Equivalent provider failures produce equivalent feature states**
    - Generate normalized failure classes and compare seeded/live-adapter application states.
    - **Validates: Requirements 19.8**

  - [ ]* 10.14 Add pgTAP RLS, SQL constraint, RPC, Storage-policy, and concurrency tests
    - Test owner, authorized-other, and unauthorized roles for every private/public resource; include path guessing, held visibility, own-post vote, forged prices, conversation access, admin spoofing, idempotency replay, stale attempts, and concurrent admin decisions.
    - _Requirements: 4.2-4.11, 6.1-14.6, 18.1-18.4, 18.7, 18.10_
    - _Design: Testing Strategy / Backend integration/security tests; Security and Privacy_

  - [ ]* 10.15 Add Edge Function authentication, rate-limit, deadline, normalization, and fail-closed tests
    - Use fake providers and representative integration cases for authorized/unauthorized calls, ownership, secrets/log redaction, ten-second explicit outcomes, invalid provider output, replay, moderation outage, and production permit-all rejection.
    - _Requirements: 4.7-4.11, 7.1-7.3, 9.1-9.6, 10.8, 17.1, 18.6-18.10_
    - _Design: Testing Strategy / Backend integration/security tests; Edge Function contracts_

  - [ ]* 10.16 Add Supabase adapter, Realtime, and repository contract integration tests
    - Run the shared contract suite against local Supabase for representative scenarios; cover normalized errors, signed photo access, cursor pages, reconnect delta, message de-duplication, and route-contract parity with seeded mode.
    - _Requirements: 12.1-12.8, 18.1-18.4, 19.4-19.8_
    - _Design: Testing Strategy / Shared contract tests; Backend integration/security tests_

- [ ] 11. Integrate all slices and execute final quality gates
  - Wire the complete web-first product, then validate behavior, accessibility, responsiveness, security, performance, and production output without implementing native apps.
  - _Requirements: 1.1-20.5_
  - _Design: Testing Strategy; Performance and Media Budgets; Exit criteria for design implementation_

  - [ ]* 11.1 Add complete seeded web-flow integration coverage
    - Before testing UI, read `agents/skills/offbrand-design/SKILL.md` and every applicable screen brief.
    - Cover auth/onboarding, capture/storage/estimate/History, Feed/vote/comment, manual listing/Marketplace, route refresh/deep links, all applicable operational states, and honest disabled Chat/Admin seams with deterministic scenarios.
    - _Requirements: 1.1-16.8, 19.1-19.8, 20.1-20.5_
    - _Design: Testing Strategy / Web end-to-end tests_

  - [ ]* 11.2 Add local Supabase end-to-end integration coverage
    - Exercise representative authenticated storage/estimate, Feed moderation, vote/comment, listing/filter, participant Chat, and administrator review flows against the shared local backend; verify seeded and live modes preserve route contracts.
    - _Requirements: 2.1-14.6, 18.1-19.8_
    - _Design: Testing Strategy / Backend integration and web end-to-end tests_

  - [ ]* 11.3 Add final accessibility, responsive, theme, and visual-regression checks
    - Before testing UI, read `agents/skills/offbrand-design/SKILL.md` and all screen briefs.
    - Test compact/medium/expanded widths, 320-1920 CSS pixel boundaries, 200% text, keyboard-only navigation, focus traps/restoration, semantic landmarks, live announcements, touch targets, light/dark snapshots, reduced motion, one dominant element, and one filled primary action.
    - _Requirements: 15.1-16.8_
    - _Design: Testing Strategy / Component/accessibility tests; Visual/responsive tests_

  - [ ]* 11.4 Add final security, privacy, exclusion, and browser-bundle checks
    - Scan production assets for provider/service-role secrets and forbidden configuration; verify Secure Transport configuration, default-deny resources, production mock rejection, log redaction, and absence of payment, escrow, shipping, identity-verification, or IoT capabilities.
    - _Requirements: 18.1-18.10, 20.1-20.5_
    - _Design: Security and Privacy; Testing Strategy / Static architecture and type tests_

  - [ ]* 11.5 Run the complete one-shot typecheck, lint, unit, property, contract, and backend test matrix
    - Confirm every property test carries the exact `Feature: snapworth-web, Property N: ...` tag, runs at least 100 successful cases, and has one test per design property.
    - Fix failures in the owning implementation task; do not weaken assertions, skip hooks, start watch processes, or create commits.
    - _Requirements: 1.1-20.5_
    - _Design: Testing Strategy / Property-test convention; Exit criteria_

  - [ ]* 11.6 Run the production web build, route smoke tests, and controlled performance budgets
    - Verify the Expo web production build, route manifest, supported-browser smoke coverage, no plugin dependency, estimate explicit outcome within ten seconds, two-second progress, Feed/Marketplace first usable page within three seconds, Chat delivery within two seconds, and compression before upload.
    - Keep native iOS/Android delivery deferred and report any unmet manual keyboard/screen-reader/design review as an explicit release blocker.
    - _Requirements: 1.6-1.8, 15.1-17.7_
    - _Design: Performance and Media Budgets; Testing Strategy / Performance tests; Exit criteria_

- [~] 12. Final checkpoint - Ensure all tests and builds pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.1-20.5_
  - _Design: Testing Strategy / Exit criteria for design implementation_

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; implementation tasks are never optional.
- Every correctness property has exactly one dedicated property-test task and should be implemented in its own test file to prevent parallel-write conflicts.
- Every UI implementation or UI-focused test task explicitly requires reading `agents/skills/offbrand-design/SKILL.md` first; agents must also use the applicable screen brief.
- All new package dependencies must be installed at exact pinned versions and captured in the lockfile. Do not use caret, tilde, `latest`, or unbounded ranges.
- Use non-watch commands only. Do not start development servers, watchers, or interactive applications from task execution.
- Do not create commits unless the user separately requests one.
- Execute dependency waves in order. Tasks in the same wave operate on distinct implementation/test files and may run in parallel; a later wave starts only after all earlier waves complete.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13", "2.14", "2.15"] },
    { "id": 5, "tasks": ["3.1"] },
    { "id": 6, "tasks": ["3.2"] },
    { "id": 7, "tasks": ["3.3"] },
    { "id": 8, "tasks": ["3.4", "3.5", "3.6", "3.7"] },
    { "id": 9, "tasks": ["5.1", "5.2"] },
    { "id": 10, "tasks": ["5.3"] },
    { "id": 11, "tasks": ["5.4"] },
    { "id": 12, "tasks": ["5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11", "5.12", "5.13", "5.14"] },
    { "id": 13, "tasks": ["6.1"] },
    { "id": 14, "tasks": ["6.2"] },
    { "id": 15, "tasks": ["6.3"] },
    { "id": 16, "tasks": ["6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10"] },
    { "id": 17, "tasks": ["8.1", "8.2"] },
    { "id": 18, "tasks": ["8.3"] },
    { "id": 19, "tasks": ["8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "8.10", "8.11"] },
    { "id": 20, "tasks": ["9.1", "9.3", "9.4"] },
    { "id": 21, "tasks": ["9.2"] },
    { "id": 22, "tasks": ["9.5", "9.6", "9.7", "9.8", "9.9", "9.10"] },
    { "id": 23, "tasks": ["10.1", "10.6"] },
    { "id": 24, "tasks": ["10.2", "10.7"] },
    { "id": 25, "tasks": ["10.3"] },
    { "id": 26, "tasks": ["10.4"] },
    { "id": 27, "tasks": ["10.5", "10.8"] },
    { "id": 28, "tasks": ["10.9"] },
    { "id": 29, "tasks": ["10.10"] },
    { "id": 30, "tasks": ["10.11", "10.12", "10.13", "10.14", "10.15", "10.16"] },
    { "id": 31, "tasks": ["11.1", "11.2", "11.3", "11.4"] },
    { "id": 32, "tasks": ["11.5"] },
    { "id": 33, "tasks": ["11.6"] }
  ]
}
```
