---
name: offbrand-design
description: SnapWorth's visual design system and UI decision rules, derived from research into the OFF+BRAND. studio portfolio. Use when creating or reviewing any screen, component, style, token, colour, typography, spacing, motion, or layout in the Frontend; when scaffolding UI; when naming or structuring presentation components; or when checking a design against SnapWorth's accessibility and performance requirements.
metadata:
  version: "2.0.0"
  derived-from: "https://www.itsoffbrand.com — studio homepage, 10 case studies, and independent award/editorial sources; expanded research pass 2026-09-17"
  applies-to: "Frontend/web, Frontend/mobile, and Frontend/shared"
---

# SnapWorth Design System — the Off+Brand method

This skill translates the working method observed in [OFF+BRAND.'s portfolio](https://www.itsoffbrand.com) into an original design language for SnapWorth. It does **not** license copying their assets, layouts, source code, marks, interactions, or distinctive trade dress.

Evidence and source limits are recorded in [`references/offbrand-research.md`](references/offbrand-research.md). Detailed motion timing and behavior are in [`references/motion-language.md`](references/motion-language.md). Per-screen questions and states remain in [`references/screen-briefs.md`](references/screen-briefs.md).

All external-source descriptions in this skill are paraphrased. Content was rephrased for compliance with licensing restrictions.

---

## 0. Before design: state the question and the tension

Every screen begins with one question. A screen is finished when a stranger can answer that question at a glance and complete its primary task without relying on animation, hover, or prior familiarity.

The route questions are already written in [`references/screen-briefs.md`](references/screen-briefs.md). If a route is added, add its question, dominant element, primary action, and operational states before drawing the happy path.

SnapWorth's product-level question is:

> How do you make an automatic price feel confident enough to act on, while staying honest that it is only a guess?

The design tension is **confidence against honesty**:

- Confidence comes from decisive hierarchy, a photo-led composition, crisp transitions, and an estimate reveal that feels intentional.
- Honesty comes from persistent labeling, the dashed provisional treatment, durable-photo messaging, explicit uncertainty, and a seller price that can only come from seller input.

Motion may intensify the answer. It may never change the answer.

---

## 1. Evidence boundary: method, not imitation

The studio's own case studies support these recurring behaviors:

- [Vizcom](https://www.itsoffbrand.com/our-work/vizcom) uses a hero as a short workflow story: explain the product, show transformation, then invite action.
- [Steven.com](https://www.itsoffbrand.com/our-work/steven-com) combines an expressive exploratory layer with a clear structured layer and adapts the experience across breakpoints.
- [Lando Norris](https://www.itsoffbrand.com/our-work/lando-norris) derives sharp transitions and momentum from the subject while treating speed as a product requirement.
- [Trevor Noah](https://www.itsoffbrand.com/our-work/trevor-noah) keeps imagery largely flat and introduces restrained depth so personality does not obscure content.
- [Aether 1](https://www.itsoffbrand.com/our-work/aether1) sequences an experience into chapters, uses generous negative space, and provides a reduced-motion route while targeting smooth mobile performance.
- [The Online School](https://www.itsoffbrand.com/our-work/the-online-school) inserts playful brand moments into a dense information framework rather than removing useful information.
- [Microsoft Windows](https://www.itsoffbrand.com/our-work/microsoft-windows) treats expressive modules and everyday content modules as one reusable ecosystem.
- [Bella](https://www.itsoffbrand.com/our-work/bella) animates products to make their form and function more tangible, not merely to decorate a page.
- [Webflow.com](https://www.itsoffbrand.com/our-work/webflow) centers the product interface and uses early prototyping to coordinate design, motion, and 3D under time pressure.
- [Tillman Fiber](https://www.itsoffbrand.com/our-work/tillman-fiber) uses one recognizable identity across a broad audience and provides light and dark modes.

Independent sources reinforce the emphasis on motion craft, but they do not prove usability or accessibility by themselves. Awwwards scored the animation/transition work highly for [Aether 1](https://www.awwwards.com/sites/aether-1) and [Lando Norris](https://www.awwwards.com/sites/lando-norris). A [Communication Arts technical interview](https://www.commarts.com/webpicks/aether-1-earbuds) describes baked animation, reduced simulation cost, and custom forward/backward scene-state control to preserve continuity. These are evidence for orchestration and performance discipline—not instructions to reproduce WebGL spectacle in SnapWorth.

Specific rules below about grids, masks, shared elements, crop ratios, stagger limits, and timing are **SnapWorth design inferences**. They are original implementation guidance derived from those broader patterns; they are not factual claims about OFF+BRAND's source code.

---

## 2. Non-negotiable product invariants

Craft never overrides product truth. Every composition and transition must preserve all of these:

1. One dominant element per visible screen, at least 1.6× the visual weight of the next element.
2. One screen-level filled primary action. Secondary actions are outline or text.
3. `EstimateBadge` and `AskingPriceBadge` are separate components, not variants of one component.
4. Every estimate always includes `AI ESTIMATE`, the dashed provisional treatment, and `Estimate only — not a listing price.`
5. An estimate never initializes, morphs into, or is announced as an asking price.
6. Every item representation includes its photo and meaningful alternative text.
7. Every route has its applicable loading, empty, offline, and failure states before the happy path is complete.
8. Every visual value comes from `Frontend/shared/src/design/tokens.ts`; repeated composition and motion values become tokens or named recipes.
9. Text scales to 200%; no text container has a fixed height; `allowFontScaling` is never disabled.
10. Contrast remains at least 4.5:1 for normal text and 3:1 for large text and interactive boundaries.
11. No critical information, action, or reading order depends on animation, color, hover, or depth.
12. Performance budgets in §12 are release constraints, not polish targets.

---

## 3. Art-directed composition

SnapWorth should feel edited, not templated. Art direction comes from controlled contrast inside a strong system—not from adding decorative effects to generic SaaS cards.

### 3.1 Editorial scale shifts

Use a deliberate three-level scale:

- **Hero:** the one answer to the route question—the estimate, asking price, viewfinder, vote tally, or active conversation.
- **Editorial support:** the photo, title, or section statement that frames the answer.
- **Utility:** metadata, filters, timestamps, and secondary actions.

A large element must earn its scale by carrying the task. Do not use oversized headings merely to make a page look editorial. Monetary values use Space Grotesk and tabular figures. Metadata stays quiet but remains readable.

### 3.2 Asymmetry held by a grid

Asymmetry is permitted only when alignment remains legible:

- Establish shared left/right anchors before offsetting a photo or text block.
- Let one element break the grid at a time; adjacent elements return to it.
- Keep semantic and keyboard order unchanged even if expanded layouts offset elements visually.
- Balance a large image with negative space or a compact metadata rail, not with another equally loud object.
- At compact widths, collapse expressive offsets before reducing touch targets or clipping text.

Encode column counts, gutters, maximum widths, and sanctioned offsets as layout tokens. Never improvise breakpoint-specific numbers inside a screen.

### 3.3 Negative space as pacing

Whitespace separates beats in the user's task:

- Tight spacing joins label + value + caption into one meaning unit.
- Medium spacing joins photo + identity + state.
- Large spacing marks a handoff, such as estimate → destination choice.
- Expanded desktop layouts spend extra width on breathing room and context, not more controls.

Empty space is not permission to hide useful information. Dense routes remain complete; hierarchy and grouping make them feel lighter.

### 3.4 Image cropping and photo truth

The item photo is the visual anchor across Capture, History, Feed, Marketplace, and detail:

- Reserve aspect-ratio space before load to prevent reflow.
- Prefer a consistent editorial crop per component family; preserve a user-visible focal point through an explicit object-position value when available.
- Never crop out the item to create a more dramatic composition.
- A detail view provides a truthful fuller view even when a card uses a tighter crop.
- Do not distort, tilt, blur, recolor, or mask the item in a way that changes its perceived condition.
- Shared-element continuity should preserve the same crop initially, then settle to the destination crop.

### 3.5 Layered planes

Use at most three perceptual planes:

1. **Canvas:** route background and broad negative space.
2. **Content:** photo, estimate/listing treatment, text, and controls.
3. **Context:** a restrained rail, overlay label, filter sheet, or transient status.

Every plane needs a role. Layering may establish hierarchy or continuity; it may not conceal controls, reduce contrast, or create false depth around an estimate. Avoid stacks of floating rounded cards. Prefer edge-to-edge photos, dividers, grouped wells, and intentional overlaps that return to clear reading order.

### 3.6 Tactile surfaces

Tactility comes from material cues already in the system:

- Solid versus dashed borders communicate settled versus provisional value.
- Warm canvas, bright surface, inset sunken fields, and one accent create depth without heavy shadows.
- A very subtle static grain or highlight may live inside a named decorative token/asset if it survives contrast, compression, and performance review. It must never touch text legibility or imply item condition.
- Shadows remain restricted to sheets. Cards use surface and border separation.
- Press states should feel compressed or weighted; they should not bounce like toys.

### 3.7 Visual rhythm

Build a repeatable rhythm rather than identical repeated cards:

- Alternate **image beat → value beat → social/context beat** in Feed.
- Alternate **browse beat → filter/result summary → listing beat** in Marketplace.
- Use one expressive interruption per viewport: a larger lead item, a section statement, or a grouped tally—not all three.
- Repeat alignment anchors, crop families, and spacing intervals so asymmetry feels intentional.
- On long lists, novelty decreases as frequency increases. The first visible group can carry the strongest art direction; subsequent groups prioritize scanning.

A composition is unsuccessful if removing its animation reveals an ordinary stack of interchangeable cards.

---

## 4. UX choreography

Choreography is the planned transfer of attention and state. It begins in the information architecture; animation only makes it legible.

### 4.1 Entrance: orient before impressing

A route entrance follows this order:

1. Preserve shell and navigation continuity.
2. Place the dominant element or its geometry immediately.
3. Reveal the route question's supporting context.
4. Enable or reveal the primary action when it is valid.

Do not animate every child. A route should settle in one coordinated beat. Deep-linked routes must remain understandable without a preceding transition.

### 4.2 Focal handoff

Only one focal point leads at a time. Transfer focus in task order:

- Capture: viewfinder/photo → durable saved state → analysis → estimate → destinations.
- Feed: photo + estimate → vote choices → confirmed tally.
- Marketplace: filters or listing grid → selected listing photo + asking price → contact/owner action.
- Chat: thread context → newest message/pending state → composer.

The outgoing focal point quiets before or as the next one strengthens. Do not leave a pulsing loading state competing with a revealed result.

### 4.3 Progressive disclosure

Show information when it changes the next decision:

- Keep advanced filters in a sheet/rail, but keep active filters and Clear visible.
- Keep estimate confidence context near the estimate, not hidden in a generic tooltip.
- Reveal destination choices only after an estimate or explicit failure state has resolved the analysis beat.
- On cards, show enough information to choose; move long description and conversation context to detail.

Disclosure cannot hide required labels, error recovery, or the estimate caption.

### 4.4 Action-to-result continuity

A result should emerge from the user's action spatially or structurally:

- A selected photo remains the same photo through compression, persistence, analysis, History, and detail.
- A card photo may expand into detail; it must not disappear and reappear as unrelated media.
- A vote option becomes the pending option, then hands off to the changed bar and count.
- A sent message leaves the composer as a pending bubble while the draft remains recoverable on failure.
- A skeleton occupies the final content geometry and cross-fades/morphs into that content without a page jump.

Never use continuity to imply a semantic conversion. In particular, an `EstimateBadge` must not transform into an `AskingPriceBadge`.

### 4.5 Spatial navigation cues

Direction can clarify hierarchy:

- Card → detail moves forward through scale/continuity.
- Detail → list restores the originating position when possible.
- Sheets enter from the edge they belong to and return there on dismissal.
- Horizontal chip rows move horizontally; route content should not.

Direction must match keyboard focus and history behavior. Reduced motion replaces spatial travel with an immediate state or cross-fade while preserving focus placement.

### 4.6 Narrative sequencing around the task

Sequences use four beats: **orient → act → resolve → continue**.

- Orient: show photo/context and current state.
- Act: expose one clear action.
- Resolve: visibly connect the action to success, pending, held, or failure.
- Continue: make the next valid action clear without automatically advancing past a decision.

Decorative animation pasted on top of an unordered screen is not choreography.

---

## 5. Motion system

The former blanket rule of only three sanctioned motions is replaced by a tiered system. This permits crafted artistic accents while preserving the requirement that prolonged motion belongs only to estimation.

| Tier | Purpose | Typical duration | Where allowed |
|---|---|---:|---|
| 0 — Immediate | Selection, text entry, accessibility state | 0 ms | Everywhere |
| 1 — Functional micro-response | Press, hover/focus pairing, chip toggle, inline confirmation | 100–180 ms | Interactive controls |
| 2 — Functional transition | Sheet, route focal handoff, skeleton-to-content, vote/data change | 180–260 ms | State changes |
| 3 — Artistic accent | Brief mask, crop settle, finite depth response, editorial entrance | 220–300 ms | One focal region; never required |
| 4 — Signature/extended | Estimation wait and estimate reveal | reveal 420 ms; wait bounded by 10 s outcome | Capture/item sequence only |

Rules:

- Outside estimation, ambient/artistic motion is finite, event-triggered, and complete within 300 ms. No autonomous decorative loop runs on Feed, Marketplace, Chat, forms, or admin screens.
- Estimation may use a restrained repeating wait cue because it communicates unresolved work. It stops immediately on success, failure, offline, navigation, or cancellation.
- A viewport has one Tier 3 or Tier 4 focal motion at a time.
- No transition delays input. Visual completion and interaction availability are separate.
- Every animated value has a final static state, cancellation behavior, and reduced-motion equivalent.
- Implement the detailed grammar, sequencing, easing, and interruption rules in [`references/motion-language.md`](references/motion-language.md).

### 5.1 What each grammar means

- **Reveal:** introduces a newly valid state; forbidden for unchanged content on every render.
- **Mask/clip:** connects an image or surface to its frame; forbidden on required text, focus rings, errors, or price labels.
- **Stagger:** explains ordered groups; limited to the first small visible group, never an entire paginated list.
- **Shared-element continuity:** preserves identity across card/detail or capture/item; forbidden between estimate and asking price.
- **Overshoot/rest:** confirms direct manipulation with restrained settling; forbidden on prices, errors, destructive actions, and loading indicators.
- **Parallax/depth:** establishes foreground/background hierarchy in a tiny range; forbidden for wayfinding, data meaning, or any essential content.
- **Image treatment:** reinforces focus without changing item truth; no perpetual zoom, condition-altering filters, or crop that hides the item.
- **Hover/focus/touch response:** hover may enrich; focus and touch must provide equivalent clarity and action access.
- **Loading-to-content morph:** preserves geometry; forbidden when it would fabricate content or prevent a clear error transition.
- **Data/tally transition:** makes before/after state trackable; the final numeric text updates authoritatively and is announced once.

---

## 6. SnapWorth signature: capture → durable analysis → honest reveal

This is SnapWorth's cinematic moment. It is original to the product and must not imitate a portfolio composition.

### 6.1 The invariant story

The sequence communicates, in order:

1. **This is your photo.** The selected image becomes the stable visual anchor.
2. **It is saved.** Persistence is acknowledged before inference appears to begin.
3. **SnapWorth is analyzing.** Progress appears over or adjacent to the same photo after the two-second threshold.
4. **This is an estimate.** The result arrives with provisional styling and full language intact.
5. **You decide what happens next.** Destination actions appear only after the result state is legible.

### 6.2 Standard-motion choreography

- **Capture settle (Tier 2/3):** the selected image expands from chooser/viewfinder geometry into the item frame using the same crop. A short clip reveal may remove camera chrome. Status text says the photo is being saved.
- **Durable handoff (Tier 1):** once the row and compressed photo are durable, a quiet check/text state reads `Photo saved`. Do not use the accent as confetti. This state remains truthful if estimation later fails.
- **Analysis wait (Tier 4):** keep the photo visible. After two seconds unresolved, introduce a restrained edge sweep or segmented trace contained by the photo frame plus the text `Estimating value…`. The cue may repeat, but must not display fake percentage completion. Background texture/depth may drift minimally only inside the photo frame and must pause when the tab is hidden.
- **Resolution breath:** stop the wait cue and hold the stable photo briefly before the result enters. This is a compositional handoff, not an artificial network delay.
- **Estimate reveal (420 ms):** the estimate surface resolves from the photo's lower alignment anchor. `AI ESTIMATE`, the dashed border, final value, and caption form one unit. The label and caption are present no later than the first meaningful frame of the value; there is never an unlabeled price flash. A digit-mask or count-up may be visual only; assistive technology receives the final value once.
- **Destination reveal (Tier 2):** after the estimate is settled, reveal Private, Feed, and Marketplace destinations as secondary/outline choices around one currently designated filled primary action. Do not auto-select a public destination.

### 6.3 Failure and offline choreography

- On failure, the analysis cue resolves into a static error attached to the same photo. State explicitly that the photo is saved and offer retry.
- On offline-after-persistence, replace analysis motion with a static queued/retryable state. Do not imply guaranteed browser background work.
- Retry restarts only the analysis cue. It does not replay capture, upload, or create a second item.
- A stale attempt cannot trigger a reveal.

### 6.4 Reduced-motion choreography

- No scale, clip travel, parallax, count-up, edge sweep, or spatial shared-element motion.
- The selected photo appears in its settled frame immediately.
- `Photo saved`, estimation status, failure/offline state, and final `EstimateBadge` use immediate state changes or one short opacity cross-fade.
- The same status text, final amount, caption, actions, focus target, and live-region announcement remain available.

---

## 7. Crafted dense routes

### 7.1 Feed: an editorial conversation, not a card warehouse

The question is whether the community thinks the estimate is right. Compose each visible beat around that judgment:

- Photo and `EstimateBadge` form the lead lockup; title and timestamp are supporting context.
- Prefer grouped surfaces, edge-to-edge photo crops, and clear dividers over a grid of identical floating cards.
- On expanded widths, alternate a lead post with a compact context column while preserving source order. Subsequent posts use a quieter repeatable rhythm.
- A focused/hovered card may settle its crop and reveal secondary metadata within reserved space. Touch uses a press state; keyboard focus gets the same visible boundary and metadata.
- Opening detail uses optional photo continuity, then hands focus to the vote tally and comments.
- Vote selection responds immediately; bars and counts transition from confirmed → pending projection → confirmed result. Failure returns exactly to confirmed truth and exposes retry.
- Own-post voting is statically unavailable with explanatory text; do not animate a rejection after offering a false affordance.

### 7.2 Marketplace: expressive browsing with commercial clarity

The question is whether something is worth buying and whether the seller's price is fair:

- The asking price is the loudest card text. Optional estimate context remains a separate, smaller dashed reference.
- Use crop and span variation sparingly to create a browse rhythm, but keep card minimum width, price location, and action location predictable.
- Filters remain structurally stable. On desktop they may live in a rail; on compact they may open a sheet. Active chips and Clear are always visible when applicable.
- Applying a filter keeps the result region anchored, transitions the count and first visible group, and restores focus to a useful target. It does not replay a page entrance.
- Skeletons reproduce the final crop/span pattern. Filtered-empty states name a filter to relax and preserve filter controls.
- Listing card → detail may use photo continuity. The `AskingPriceBadge` remains solid throughout; estimate context never visually replaces it.
- Hover may add a slight crop settle or surface lift, but title, price, status, and navigation remain visible and operable without hover.

### 7.3 Density limits

Per card:

- Minimum 16 pt internal padding and 12 pt between card groups, represented by tokens.
- No more than three type sizes or two weights.
- One dominant photo/value relationship.
- Secondary metadata uses `text.secondary` or `text.muted`, never illegibly faint text.
- No more than one simultaneous motion response inside the card.

---

## 8. Tokens

`Frontend/shared/src/design/tokens.ts` is the single source of truth. `tailwind.config.js` imports from it and never redeclares values. No hex code, raw visual number, duration, easing, crop ratio, depth offset, or stagger interval appears in a component or route.

### 8.1 Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg.canvas` | `#FAFAF7` | `#0B0B0F` | App background |
| `bg.surface` | `#FFFFFF` | `#15151C` | Cards, sheets |
| `bg.sunken` | `#F1F1EC` | `#0B0B0F` | Inset wells, input fields |
| `border.subtle` | `#E4E4DC` | `#24242C` | Card and divider lines |
| `border.strong` | `#C9C9BF` | `#3A3A46` | Focus rings, active borders |
| `text.primary` | `#0B0B0F` | `#F5F5F0` | Headings, values |
| `text.secondary` | `#4A4A57` | `#A8A8B5` | Supporting copy |
| `text.muted` | `#6E6E7C` | `#8A8A99` | Metadata, timestamps |
| `accent.base` | `#D7FF3E` | `#D7FF3E` | Primary action fill |
| `accent.pressed` | `#B4E01F` | `#B4E01F` | Pressed state |
| `accent.on` | `#0B0B0F` | `#0B0B0F` | Text/icon on accent |
| `estimate.surface` | `#F3F8DE` | `#1B2110` | Estimate container only |
| `estimate.border` | `#BFD97F` | `#43521C` | Estimate container only |
| `vote.high` | `#D6452B` | `#FF7A5A` | Too High |
| `vote.low` | `#2F6FE0` | `#6FA3FF` | Too Low |
| `vote.right` | `#1E8E56` | `#48C98A` | Just Right |
| `danger` | `#C4292E` | `#FF6B6F` | Errors, destructive |
| `warning` | `#9A6400` | `#FFC155` | Held / queued content |

Rules:

- `accent.base` is reserved for the screen-level primary action and controlled estimate emphasis.
- `estimate.*` appears only inside the estimate treatment.
- Light and dark ship together.
- Verify all supported token pairs; color selection alone is not a conformance claim.

### 8.2 Typography

Two free families available through `@expo-google-fonts`:

- **Space Grotesk:** display and all monetary values.
- **Inter:** UI, body copy, labels, and metadata.

| Token | Family / weight | Size / line | Use |
|---|---|---|---|
| `price.hero` | Space Grotesk 700 | 48 / 52 | Estimate on `/item/[id]` |
| `price.lg` | Space Grotesk 700 | 32 / 36 | Asking price, listing detail |
| `price.md` | Space Grotesk 500 | 22 / 26 | Price on cards |
| `heading.lg` | Space Grotesk 500 | 22 / 28 | Screen titles |
| `heading.md` | Space Grotesk 500 | 17 / 24 | Card titles, section heads |
| `body.lg` | Inter 400 | 16 / 24 | Comments, chat, prose |
| `body.md` | Inter 400 | 15 / 22 | Default UI text |
| `label.md` | Inter 500 | 13 / 18 | Buttons, chips, tabs |
| `caption` | Inter 400 | 12 / 16 | Metadata, timestamps |
| `overline` | Inter 600 | 11 / 14, +8% tracking, uppercase | Price semantics |

Rules:

- Monetary values use tabular figures.
- Never pass `allowFontScaling={false}`.
- Use `maxFontSizeMultiplier` only where documented: 1.6 for `price.hero`, 2.0 elsewhere.
- Never fix the height of text containers.

### 8.3 Spacing, radius, and elevation

Spacing uses the 4 pt scale: `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

Radius: `sm 6` · `md 12` · `lg 20` · `full 999`.

Elevation comes from surface and border. `shadow.sheet` is the only shadow token. Minimum touch target is 44 × 44 pt regardless of visible icon size.

### 8.4 Motion tokens

Baseline tokens remain:

| Token | Duration | Easing | Use |
|---|---:|---|---|
| `motion.fast` | 140 ms | `cubic-bezier(0.2, 0, 0.2, 1)` | Press, chip, focus-adjacent response |
| `motion.base` | 200 ms | `cubic-bezier(0.2, 0, 0.2, 1)` | Sheets, state handoff |
| `motion.exit` | 160 ms | `cubic-bezier(0.4, 0, 1, 1)` | Dismissal |
| `motion.reveal` | 420 ms | `cubic-bezier(0, 0, 0.2, 1)` | Estimate reveal only |

Before implementation, add named recipe tokens for stagger, shared-element, data shift, artistic accent, and reduced cross-fade as specified in [`references/motion-language.md`](references/motion-language.md). Components consume recipe names rather than assembling private durations and easing curves.

---

## 9. Estimate treatment: the rule that cannot bend

Build two components, not a variant:

- `components/item/EstimateBadge.tsx`
- `components/item/AskingPriceBadge.tsx`

`EstimateBadge` always renders:

1. `AI ESTIMATE` in the overline style.
2. The value in `price.hero` or `price.md` on `estimate.surface` with a 1 pt dashed `estimate.border`.
3. `Estimate only — not a listing price.` directly beneath the value.

The caption is not optional and accepts no hide/replace prop. The dashed treatment is private to this component.

`AskingPriceBadge` always renders `ASKING PRICE` and the confirmed seller-entered value on a solid settled surface. It has no estimate caption and cannot accept an AI estimate type.

On `/list/[id]`, the estimate is a non-editable dashed reference distinct from the empty asking-price field. Publish remains disabled until a positive seller-entered number is valid.

Motion constraints:

- The estimate label/caption never arrive after an exposed value.
- Asking price never shares the estimate reveal recipe.
- A shared-element transition never crosses the estimate/asking semantic boundary.
- Screen-reader output contains final monetary values, not animated intermediate values.

---

## 10. Component rules

- **`VoteBar`:** every choice has icon, label, shape, and color. The active choice can be selected again to withdraw. Pending animation projects the desired result; failure restores confirmed truth. Accessibility hints explain withdrawal.
- **`PostCard` / `ListingCard`:** item photo is mandatory, aspect ratio is reserved, title truncates at two lines, and price is the loudest text. Cards may use art-directed crop/span recipes, never text-only variants.
- **`FilterBar`:** active count and Clear remain visible whenever filters are active. Filter motion preserves focus and result-region position. Empty copy names a filter to relax.
- **`ProgressIndicator`:** lists use shape-matched skeletons; estimation uses the durable photo and truthful indeterminate status. Never show a spinner on a blank screen or a fabricated percentage.
- **`EmptyState` / `ErrorState`:** every list has both. Retryable errors name the failed operation and offer retry. Transitions never discard recoverable input.
- **`ChatBubble`:** direction uses alignment, surface, and accessible sender text. Pending/delivered/failed state is textual. Failed text remains available.
- **Buttons:** one screen-level filled accent primary. Secondary outline, tertiary text. Destructive is danger outline except inside confirmation.
- **Icon controls:** minimum target and accessible label are mandatory.
- **`PhotoFrame`:** owns crop recipe, loading geometry, fallback, alt text, and optional continuity identity. It never adds condition-altering effects.

---

## 11. Web, keyboard, and future mobile equivalence

### 11.1 Desktop/web

- Expanded width creates composition: wider photo/value relationships, contextual rails, and deliberate negative space—not more simultaneous actions.
- Hover is enhancement only. It may preview a crop settle, depth response, or metadata already available elsewhere.
- Keyboard focus receives a visible strong ring and the same content/action availability as hover.
- Route transitions restore or move focus according to navigation intent; animation never steals focus.
- Pointer-following depth is tiny, clipped to a decorative/photo region, and disabled on coarse pointers or reduced motion.

### 11.2 Mobile/touch

- Touch uses immediate pressed feedback rather than hover-dependent disclosure.
- Shared-element continuity may connect list and detail when platform support is stable; otherwise use geometry-preserving cross-fades.
- Do not use device tilt/gyroscope for parallax. It adds permission/privacy and motion risk without task value.
- Sheets, filters, and destination choices remain reachable with one hand where practical, but semantic order matches web.
- Native back gestures and browser history return to a stable origin without replaying an entrance sequence.

### 11.3 Input parity test

For every hover behavior ask:

1. What does touch do?
2. What does keyboard focus do?
3. Is the information available with neither hover nor motion?

If any answer is missing, the behavior is not approved.

---

## 12. Performance budgets

| Budget | Design consequence |
|---|---|
| Estimate outcome within 10 s | Photo and durable state remain visible; wait cue is lightweight and interruptible. |
| Progress after 2 s unresolved | Introduce truthful estimation status without shifting layout. |
| Feed/Marketplace first usable page within 3 s | Fixed geometry, bounded first page, route-local animation, lazy media, no entrance animation that blocks use. |
| Chat delivery within 2 s | Optimistic pending bubble, text preserved on failure. |
| Photo compressed before upload | Design for compressed media and avoid effects that require full-resolution assets. |

Motion performance rules:

- Prefer opacity and transform; animate layout only when continuity cannot be expressed otherwise.
- Limit simultaneous moving layers. One focal transition plus one local response is the maximum visible combination.
- Pause repeating estimation cues when the route is backgrounded or hidden.
- Do not ship WebGL, Three.js, custom smooth scrolling, video-as-UI, or animation libraries solely for decoration.
- Test on lower-capability mobile hardware and current browsers. A 60 fps target is desirable; dropped input response, scrolling, or text rendering is a defect regardless of average frame rate.
- Skeletons, reduced motion, and static fallbacks are designed first, not added after the cinematic path.

---

## 13. Accessibility and semantic parity

- Reduced motion removes transforms, spatial travel, parallax, masks, count-up, overshoot, and autonomous/repeating artistic motion. It preserves content, actions, order, focus, and status text.
- Animation never carries the only indication of saving, estimating, success, failure, held status, vote choice, or price meaning.
- Live regions announce authoritative state once; intermediate visual animation values remain hidden from assistive technology.
- Focus indicators are never clipped by masks or overflow.
- Text remains readable while adjacent visuals animate; do not move body copy during reading.
- Hover and pointer responses have keyboard and touch equivalents.
- Motion does not automatically scroll, advance a decision, or move focus without user intent.
- At 200% scaling, expressive overlaps collapse before content clips or reading order changes.
- Reduced motion is tested as a complete product path, not a CSS switch.

---

## 14. Craft review rubric

Score each category `0` (missing), `1` (present but generic/inconsistent), or `2` (clear, intentional, and robust). Any invariant or accessibility failure blocks approval regardless of total. A crafted screen targets at least 16/20.

| Category | Review question |
|---|---|
| Question and hierarchy | Can a stranger identify the route question, dominant element, and primary action immediately? |
| Composition | Do scale, grid, asymmetry, crop, planes, and negative space create an edited composition without harming order? |
| Rhythm | Does the screen vary and repeat intentionally rather than becoming either monotonous cards or visual noise? |
| Choreography | Does attention move in task order—orient, act, resolve, continue—with one focal handoff at a time? |
| Continuity | Do photo, action, loading geometry, and result preserve identity across state/route changes? |
| Motion grammar | Is each motion from an approved tier/recipe, bounded, interruptible, and justified? |
| Honest semantics | Are estimate, asking price, durability, moderation, and failure states impossible to misread? |
| Interaction finish | Are hover, focus, touch, pending, success, error, and cancellation states equally resolved? |
| Accessibility | Is there reduced-motion parity, keyboard/touch parity, readable scaling, non-color cues, and stable focus? |
| Performance | Does craft stay within route budgets and remain smooth without blocking input or content? |

Review in this order:

1. Turn motion off. Does the composition still work?
2. Use keyboard only. Is every action and state clear?
3. Enable reduced motion. Is semantic output equivalent?
4. Throttle network. Do durable, loading, empty, and error states remain composed?
5. Compare compact and expanded. Is it one system rather than two products?
6. Inspect the estimate/listing boundary. Can any frame imply that AI chose the seller's price?
7. Look for imitation. Could any distinctive arrangement be mistaken for copied OFF+BRAND trade dress? If yes, redesign it.

---

## 15. What deliberately does not carry over

OFF+BRAND often uses WebGL, 3D, cinematic scroll, reactive cursors, custom scene controllers, and rich launch-site storytelling. Those techniques are supported by their briefs and specialist teams; they are not SnapWorth defaults.

Do not copy or import:

- OFF+BRAND assets, layouts, marks, code, camera paths, transition compositions, or branded motifs;
- smooth-scroll hijacking, scroll-jacking, infinite narrative loops, or pointer effects that change navigation;
- WebGL/Three.js/GSAP/Rive solely to resemble an award site;
- 3D spectacle where a photo, typographic hierarchy, or lightweight transform communicates the task;
- ambient motion that competes with valuation, buying, voting, messaging, or error recovery.

What carries over is the method: name the question, find the tension, art-direct the composition, choreograph the task, integrate words and motion, prototype early, and hold the result to comprehension, accessibility, and performance floors.

---

## 16. References

- [`references/offbrand-research.md`](references/offbrand-research.md) — source-by-source evidence, independent corroboration, and explicit inference boundary.
- [`references/motion-language.md`](references/motion-language.md) — motion tiers, grammar, recipes, orchestration, interruption, reduced motion, and performance checks.
- [`references/screen-briefs.md`](references/screen-briefs.md) — route questions, dominant elements, actions, and required operational states.
