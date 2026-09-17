# SnapWorth motion language

This reference makes the motion rules in [`../SKILL.md`](../SKILL.md) implementable across web and future mobile shells. It is an original SnapWorth system derived from the task-led sequencing and performance discipline documented in [`offbrand-research.md`](offbrand-research.md); it does not reproduce OFF+BRAND source code or distinctive transitions.

All external research descriptions in the evidence reference are paraphrased. Content was rephrased for compliance with licensing restrictions.

## 1. Motion has two jobs

### Functional motion

Functional motion explains:

- what accepted input;
- what changed state;
- where content came from or went;
- which object retained identity;
- what is pending, confirmed, failed, or reversible.

It is approved when removing it makes the transition harder to follow, while the static/reduced path remains fully usable.

### Ambient/artistic motion

Ambient/artistic motion establishes tone, depth, pacing, or tactile finish. It is approved only when:

- the composition already works without it;
- it occupies one bounded focal region;
- it is finite and user- or state-triggered outside estimation;
- it never competes with reading, typing, voting, filtering, buying, or error recovery;
- it adds no critical information;
- reduced motion removes it without losing meaning.

Outside the capture/estimate experience, artistic motion ends within 300 ms and does not loop autonomously. This keeps the current product requirement that extended motion is reserved for estimation while replacing the older all-or-nothing ban on artistic response.

## 2. Tiers and budgets

| Tier | Name | Duration | Concurrent limit | Examples |
|---|---|---:|---:|---|
| 0 | Immediate semantic state | 0 ms | unrestricted | text input, selected state, accessible value |
| 1 | Functional micro-response | 100–180 ms | 2 local responses | press, chip toggle, focus companion, inline check |
| 2 | Functional transition | 180–260 ms | 1 focal + 1 local | sheet, skeleton morph, tally shift, focal handoff |
| 3 | Artistic accent | 220–300 ms | 1 focal | clip reveal, crop settle, tiny depth response |
| 4 | Signature/extended | reveal 420 ms; wait until bounded outcome | 1 total | estimation wait, estimate reveal |

Values must become named recipe tokens before implementation. Do not paste these numbers directly into components.

### Global limits

- One Tier 3 or Tier 4 motion per viewport at a time.
- A Tier 2 focal transition may coexist with one Tier 1 response only.
- Stagger does not increase the parent tier's total duration beyond its cap.
- No animation blocks pointer, keyboard, or touch input after semantic state is ready.
- No transition adds artificial delay to a network result.
- Repeating estimation motion stops when the document/app is hidden.

## 3. Timing and easing

Use easing by meaning:

| Recipe | Curve/behavior | Meaning |
|---|---|---|
| Direct response | `cubic-bezier(0.2, 0, 0.2, 1)` | input feels attached to output |
| Enter/resolve | `cubic-bezier(0, 0, 0.2, 1)` | result arrives and rests |
| Exit/dismiss | `cubic-bezier(0.4, 0, 1, 1)` | object leaves without calling attention back |
| Restrained settle | critically damped spring or tokenized equivalent, no visible second bounce | manipulated object regains rest |
| Linear trace | linear within a bounded segment, eased at segment handoff | analysis remains active without fake progress |

Rules:

- Use one easing family in a coordinated sequence.
- Do not mix spring and cubic-bezier motion on siblings in the same beat.
- Overshoot stays visually tiny and settles once.
- Prices, error messages, destructive confirmations, and moderation outcomes do not overshoot.
- Exit is generally shorter than entrance.
- Reduced motion uses immediate change or a short opacity cross-fade; it never substitutes a different flourish.

## 4. Sequencing and orchestration

A coordinated transition has named beats, not independent child animations.

### Standard order

1. **Acknowledge** user intent immediately.
2. **Stabilize** layout geometry and persistent identity.
3. **Transition** one focal region.
4. **Resolve** authoritative text/value/state.
5. **Offer** the next valid action.

### Overlap

Use limited overlap to avoid mechanical stop/start timing:

- The next beat may begin as the previous beat enters its final third.
- Required labels and semantic context appear before or with a value, never after it.
- Primary action emphasis waits until the result it acts on is understandable.
- Error recovery does not wait for an exit flourish.

### Stagger

- Stagger only a small ordered group such as the first visible destination choices, first result row, or three vote choices.
- Use a short tokenized interval and cap total added delay.
- Do not stagger paginated cards, message history, long comments, filter chips on every update, or screen-reader focus order.
- Reduced motion removes stagger.

## 5. Motion grammar

### 5.1 Reveal

**Use for:** newly valid content, a resolved result, a sheet/dialog, the first small visible group.

**Standard behavior:** opacity plus a small position settle or a contained surface reveal.

**Forbidden:** unchanged content on rerender, every card during scroll, validation text that needs immediate reading, or any reveal that delays the only retry action.

**Reduced:** immediate or opacity-only.

### 5.2 Mask/clip

**Use for:** removing camera chrome from a captured photo, settling an image into its reserved frame, introducing a decorative plane inside a bounded region.

**Standard behavior:** reveal along an existing alignment edge; the mask belongs to the frame, not the whole page.

**Forbidden:** clipping text, focus rings, status labels, prices, errors, touch targets, or content at 200% text size. Do not use torn-paper, peeling-photo, or other source-distinctive shapes borrowed from a reference project.

**Reduced:** render final unclipped geometry.

### 5.3 Stagger

**Use for:** order and hierarchy in groups of two to four elements.

**Standard behavior:** parent transition starts once; children follow in semantic order with a tokenized short interval.

**Forbidden:** entire feeds, marketplace pages, message threads, or repeated filter updates.

**Reduced:** simultaneous appearance.

### 5.4 Shared-element continuity

**Use for:** selected capture/photo → item detail, History photo → item detail, Feed/Listing card photo → detail.

**Standard behavior:** preserve identity, initial crop, and alignment; transition into destination geometry, then release control to normal layout.

**Forbidden:** estimate → asking price; one item photo → another; unauthorized/not-found transitions; continuity that changes semantic reading order or traps focus.

**Fallback:** geometry-preserving cross-fade with the destination present before the source disappears.

**Reduced:** destination renders immediately; focus moves according to route semantics.

### 5.5 Overshoot/rest

**Use for:** direct manipulation of a button, chip, or draggable/sheet boundary where a tiny settle adds tactility.

**Standard behavior:** pressed compression or restrained one-step settle; no repeated bounce.

**Forbidden:** monetary values, estimate badge, errors, warnings, destructive actions, loading indicators, moderation status, or background cards.

**Reduced:** color/border/state change only.

### 5.6 Parallax/depth

**Use for:** tiny separation between photo/content and a decorative/context plane when pointer or scroll position already exists.

**Standard behavior:** bounded displacement inside a clipped region. Depth never moves body copy or controls.

**Forbidden:** wayfinding, required content, mobile device tilt, long-form reading, feed scroll hijacking, disabled/reduced-motion state, low-power fallback, or multiple independent layers.

**Reduced/coarse pointer:** static final planes.

### 5.7 Image treatment

**Use for:** crop settle on focus, capture frame handoff, optional card/detail continuity, loading-to-photo cross-fade.

**Standard behavior:** preserve item identity and condition; reserve final geometry; keep displacement/scale slight.

**Forbidden:** perpetual zoom, heavy blur, hue/contrast treatment that changes item condition, crop that hides damage or identifying details, or motion while a user is trying to inspect detail.

**Reduced:** direct final image with loading/failure state intact.

### 5.8 Hover, focus, and touch

**Hover may:** slightly settle crop, strengthen boundary, expose secondary metadata in already reserved space, or preview navigability.

**Focus must:** provide a visible tokenized ring and the same content/action access as hover. Focus is never only an animated glow.

**Touch must:** acknowledge press immediately and keep all actions discoverable without a hover phase.

**Forbidden:** hover-only actions, moving targets, cursor-following controls, focus indicators clipped by scale/mask, or delayed touch acknowledgment.

### 5.9 Loading-to-content morph

**Use for:** list skeleton → matching card, reserved photo placeholder → photo, estimate placeholder → result surface.

**Standard behavior:** match aspect ratio, bounds, and major text blocks; cross-fade or settle content inside stable geometry.

**Forbidden:** fabricated text/images, indefinite shimmer, morphing an error into success without status text, or changing grid span after load without reserved space.

**Reduced:** immediate replacement or opacity-only.

### 5.10 Data/tally transition

**Use for:** vote bars/counts, active filter count, unread count, status changes with a clear before/after.

**Standard behavior:** update authoritative numeric text immediately or at the resolved beat; animate bar geometry from the confirmed baseline to the new state. Pending state is visually and textually distinct.

**Forbidden:** slot-machine cycling, fake intermediate totals, color-only change, count-up that assistive technology announces repeatedly, or stale response animation.

**Reduced:** immediate final geometry and one live-region announcement.

## 6. Signature capture and estimate choreography

### Beat A — selection acknowledged

- The chooser/viewfinder responds immediately.
- The photo occupies reserved destination geometry as soon as a preview is available.
- Compression/upload status is textual; visual treatment cannot imply durability yet.

### Beat B — durable handoff

- Only after item and compressed photo persistence succeeds, show `Photo saved`.
- A quiet icon/border response may confirm durability.
- This state persists through estimate failure and is never reversed by provider errors.

### Beat C — analysis

- The same photo remains dominant.
- Before two seconds, stable status text may indicate work without a large progress treatment.
- At two seconds unresolved, show the estimate-wait recipe: a contained trace/edge sweep plus `Estimating value…`.
- The trace is indeterminate and never maps position to percentage.
- A single cycle is calm; subsequent cycles have a rest interval rather than continuous high-frequency motion.
- Pause when hidden; stop on result, failure, offline, abort, route change, or a newer attempt.

### Beat D — resolution breath

- Stop the wait cue and return the photo to rest.
- Do not add network delay. If the result is already available, this handoff is part of the 420 ms reveal budget.

### Beat E — honest estimate reveal

- The estimate surface enters from an alignment anchor already present in the composition.
- Dashed boundary and `AI ESTIMATE` establish provisional meaning before or with the value.
- The exact caption is present by the first meaningful value frame.
- The value may use a digit mask or visual count-up, but intermediate values are `aria-hidden`/inaccessible; the final value is announced once.
- No confetti, celebratory bounce, profit implication, green-success semantics, or seller-price language.

### Beat F — decision handoff

- Once the badge settles, reveal destination choices in a small ordered group.
- Keep one filled screen primary action; other destinations use outline/text treatment.
- Do not auto-advance, auto-publish, or prefill an asking price.

### Failure/offline/retry

- Failure replaces the analysis region without moving/removing the photo.
- Copy states that the photo remains saved.
- Retry animates only the new estimate attempt, not capture/upload.
- Offline-after-persistence uses a static durable/retryable state and does not promise background completion.
- Stale attempts produce no visual transition.

## 7. Feed recipes

### Feed entrance

- Render shell and first card geometry immediately.
- Morph skeletons into cards in place.
- If an entrance accent is used, apply it only to the lead visible lockup, not every card.

### Card focus

- Hover/focus may strengthen the card boundary and settle the photo crop.
- Touch uses pressed feedback.
- Price, title, state, and navigation stay visible at rest.

### Vote

1. Press/keyboard activation acknowledges selected choice.
2. Choice enters textual pending state.
3. Bars move from confirmed values to projected/returned values using the data-shift recipe.
4. Server confirmation removes pending state and announces final counts once.
5. Failure returns bars and selection exactly to the confirmed snapshot, then exposes retry.

Rapid vote changes follow latest-intent rules; do not queue visual replays for obsolete choices.

### Post detail

Optional photo continuity ends before the vote tally becomes dominant. Comments do not cascade in with long staggers; new approved comments use a local short reveal without moving the reader's current focus.

## 8. Marketplace recipes

### Filter application

1. Chip/sheet action acknowledges immediately.
2. Active count and Clear update.
3. Existing results remain as `previous` data or transition to geometry-matched skeletons according to application state.
4. New result count and first visible group resolve in place.
5. Focus remains on the triggering filter or moves to a named result heading only on explicit submit behavior.

Do not scroll to top automatically on every chip toggle unless the interaction contract and focus behavior require it.

### Listing browse

- Use stable price and title anchors despite art-directed crop/span variation.
- Hover/focus may add one slight image/surface response.
- Sold/withdrawn state resolves statically and disables contact before any flourish.

### Listing detail

- Card photo may continue into detail.
- Asking-price treatment stays solid throughout.
- Optional estimate context appears separately; there is no morph between monetary semantics.

## 9. Web/mobile input mapping

| Intent | Pointer/web | Keyboard/web | Touch/mobile |
|---|---|---|---|
| Preview navigability | restrained hover response | visible focus + same metadata | no preview required; clear resting affordance |
| Activate | click + press response | Enter/Space + press response | tap + press response |
| Open detail | optional photo continuity | route transition + focus heading | optional shared element + native back behavior |
| Adjust filters | hover/focus chip state | roving/tab focus as appropriate | tap chips/sheet |
| Inspect image | stable hover or explicit open | explicit labeled control | tap/pinch only in dedicated viewer |
| Dismiss sheet | click scrim/close | Escape + focus return | swipe/close + focus/accessibility return |

Hover never gates information or action. Device tilt is not an equivalent and is not used.

## 10. Interruption, cancellation, and reversal

### Semantic state wins

Animation is a projection of application state, never the source of truth. On interruption:

- snap/settle to the newest valid semantic state;
- cancel obsolete callbacks and announcements;
- preserve user input and authoritative confirmed data;
- do not run queued animations merely to complete a visual story.

### Latest intent wins

Use for rapid filter changes, destination-sheet dismissal, vote replacement, and route changes. The newest valid action cancels or retargets the current transition from its present visual value.

### Route unmount/background

- Cancel timers and frame callbacks.
- Pause repeating estimation cues.
- Do not cancel durable server work by assuming the visual route owns it.
- On return, reconcile authoritative state and enter the correct static/transition point; do not replay capture.

### Reversal

Sheets and card/detail transitions may reverse from their current progress if the platform implementation is stable. Data outcomes, estimate reveal, moderation decisions, and sent messages do not visually reverse authoritative state; they transition to a new explicit state.

### Error precedence

An actionable error interrupts artistic motion immediately. Retry, preserved input, and explanatory text become available without waiting for an exit animation.

## 11. Reduced-motion parity matrix

| Standard behavior | Reduced behavior | Semantic parity requirement |
|---|---|---|
| position/scale reveal | immediate or opacity-only | same heading/content/action |
| clip/mask | final unclipped geometry | same image and crop meaning |
| shared element | destination appears immediately | same identity, route, and focus |
| stagger | simultaneous | same order in document/accessibility tree |
| overshoot | border/surface state | same pressed/selected state |
| parallax/depth | static planes | no lost hierarchy or control |
| edge sweep wait | static indicator + status text | same unresolved estimation state |
| count-up/digit mask | final value immediately | same amount, label, caption, announcement |
| tally animation | final bar/count immediately | same confirmed/pending/error text |
| skeleton morph | immediate replace/cross-fade | same loading and result geometry |

Test reduced motion as a route state before standard motion is approved.

## 12. Accessibility rules

- Required text never moves while the user is expected to read it.
- Focus rings stay outside masks and visible at all animation frames.
- Live regions announce only semantic milestones: saved, estimating if needed, estimate ready, failed, vote confirmed/failed, message delivered/failed.
- Intermediate animation values and decorative layers are hidden from the accessibility tree.
- Motion does not auto-focus, auto-scroll, or auto-advance a choice.
- Flashing, rapid luminance shifts, and large continuous motion are prohibited.
- At 200% text scaling, disable/collapse overlap and shared geometry before clipping or reordering content.

## 13. Performance implementation guidance

- Prefer opacity and transform. Reserve layout animation for a documented continuity requirement.
- Keep animated regions clipped and small; avoid full-screen repaints.
- Use route-local assets and lazy-load below-fold media.
- Pause work when hidden and clean up on unmount.
- A static fallback is required before enabling an artistic recipe.
- Do not add WebGL, Three.js, GSAP, Rive, video, or a second animation runtime solely to implement these recipes. Use the project's approved lightweight runtime.
- Measure input latency, dropped frames, layout shift, memory, and first usable content; do not judge smoothness only by eye on a high-end desktop.
- Feed and Marketplace remain usable within three seconds; entrance motion cannot extend that deadline.
- Estimation returns success or explicit failure within ten seconds, and progress appears at two seconds without a layout jump.

## 14. Motion review checklist

1. What state change, hierarchy, or continuity does this motion explain?
2. Which tier and named recipe owns it?
3. Does the static composition still work?
4. Is only one focal region moving?
5. Can the interaction be used before visual completion?
6. What happens on rapid repeat, reverse, route change, background, failure, and stale response?
7. Does reduced motion preserve text, value, action, focus, and announcement?
8. Are hover, focus, and touch equivalent in capability?
9. Does the motion preserve estimate versus asking-price semantics at every frame?
10. Does it remain inside performance budgets on lower-capability hardware?
11. Is it original to SnapWorth's photo/value subject rather than copied from a reference?

If any answer is missing, the motion recipe is unfinished.
