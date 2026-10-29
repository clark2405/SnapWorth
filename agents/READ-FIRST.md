# Read this first

Read this file before you change anything in SnapWorth, then read `AGENTS.md`. It records the product
rules and design decisions the code is built on. Most of them aren't obvious from any single file,
and they've already been broken once by accident. If you need to break one, raise it with the team
first and update this file afterwards.

## Who is reading

You're a person or an AI agent about to change SnapWorth. The app is an Expo Router monorepo:

- `Frontend/web/` is the website and desktop shell.
- `Frontend/mobile/` is the iOS and Android app.
- `Frontend/shared/` holds the product code both apps use.
- `Backend/` is Supabase, shared by both apps.

Route files in `web/app` and `mobile/app` are thin wrappers. A screen's behaviour lives in
`shared/src/features/`, and its building blocks in `shared/src/components/`. Every route exists in
both apps.

## Product rules

### Anyone can look around; an account is asked for only when they act

- Guests can browse the Feed, the Market, posts and listings.
- They're asked for an account the moment they try to do something: vote, comment, save, message,
  make an offer, set a price alert, snap, sell or talk to Worthy.
- Worthy still floats on screen for guests, but tapping it opens the account sheet instead of
  the panel (`onRequestOpen` on `Companion`, wired in both app shells). The `/worthy` chat screen
  shows `AccountGateView` to a guest. Worthy helps with your own snaps, listings and chats, so it
  needs an account.
- Each of those actions opens the account sheet with its own reason, from `useAccountGate()` and
  `accountIntentCopy` in `shared/src/features/session/session.tsx`. Add a new action to that list,
  with a reason, instead of writing a new prompt.
- Screens that only make sense with an account (Chats, History, Snap, Profile) show
  `AccountGateView` instead of a login wall.
- Don't put a login wall in front of the tabs. One was added to `mobile/app/(tabs)/_layout.tsx` for
  the camera prototype and hid guest browsing completely. It has been removed.

### Why we ask for an account

Give this reason, in these words or close to them, wherever someone is asked: every price and vote
comes from a real person, so the community's verdicts stay fair. The last onboarding step says it:
"Looking around is free. Snapping, voting and selling need a free account, so every price here
comes from a real person."

### Launching the app

- **Phone app:** a signed-out launch always opens the introduction (`mobile/app/index.tsx`). A
  signed-in launch opens the Feed.
- **Web:** the introduction plays once per browser, then later visits open the Feed.
- **From the introduction:** Skip and "Look around first" open the Feed as a guest. Sign in and
  Create free account go to the account screens.

### What AI runs where

- **The cloud decides; the phone only helps.** Pricing (`estimate-price`), moderation
  (`moderate-content`) and anything other people see run on the server. A phone's answer can be
  faked and most phones can't run a model, so on-device AI never decides a price, a vote or what
  gets published.
- **On the phone** (`mobile/modules/snap-sense`, wrapped by `mobile/src/snap-sense.ts`):
  - On any iPhone, Vision checks a snapped photo before it's sent: brightness, sharpness and the
    main subject. It also reads printed text and barcodes. A dark, blurred or empty photo is held
    back with what to fix, because each user gets only 10 estimates a day.
  - On an iOS 27 iPhone with Apple Intelligence, Foundation Models reads the photo for a first
    impression ("Looks like: …") while the cloud prices it.
  - On iOS 26 and later with Apple Intelligence, Worthy's chat runs on the phone
    (`WorthyChat.swift`). The model works out what's being asked and answers the light questions
    in its own words: how the app works, photo tips, wording a message. Price, trend, collection
    and listing questions get the app's data cards instead. `settleAnswer` in
    `shared/src/features/companion/worthy-replies.ts` replaces any reply that names an amount of
    money with the price card. Worthy's instructions describe the app, so update them when a flow
    they mention changes.
- **The local model is only for devices with Apple Intelligence.** That means an iPhone that
  supports it, with it turned on: iOS 26 for Worthy's chat, iOS 27 for reading photos. Every
  other device uses the cloud model for the same jobs, including Android, the web and iPhones
  without Apple Intelligence. Never ship a feature that only works locally, and never make a flow
  depend on the local model.

  | Job | Apple Intelligence iPhone | Every other device |
  |---|---|---|
  | Photo check (dark, blurry, no item), reading labels | Phone (Vision, any iPhone) | Skipped; the cloud prices the photo as it is |
  | First look at the item ("Looks like: …") | Phone | Skipped; the cloud estimate names the item |
  | Worthy's light questions (how-to, photo tips, wording) | Phone | Cloud model |
  | Prices, trends, collection value, listing drafts | Cloud | Cloud |

#### Handoff: the cloud AI belongs to another team member

A teammate owns the cloud AI work, including the choice of cloud model. The on-device side and
the connection points are built, so the cloud work only needs to fill in the parts below. Other
contributors (people or agents) shouldn't build these parts; leave them to the owner.

**What's done:**
- On-device photo check, label reading and first look (`mobile/modules/snap-sense`).
- On-device Worthy chat for Apple Intelligence iPhones.
- `estimate-price` accepts the phone's `PhotoClues`, cut to size and marked as untrusted. That
  change is merged in code but **not deployed** to Supabase yet. Until it's deployed, the clues
  are ignored and nothing breaks.

**What the cloud work needs to fill in:**

1. **Worthy's chat in the cloud**, for every device without Apple Intelligence. Until it exists
   they get canned sample replies (`replyForIntent` in
   `shared/src/features/companion/CompanionChatView.tsx`).
   - Pass it as the `answer` prop on `CompanionChatView`, the way the phone's answerer is
     passed in `mobile/app/worthy.tsx`.
   - It must return `WorthyAnswer` (`intent` plus `reply`), so `settleAnswer` keeps money out of
     chat replies on every device.
   - Follow `estimate-price` for sign-in checks, request limits, and treating input as untrusted.
2. **Real data behind Worthy's cards.** Price, trend, collection and listing answers show sample
   data (`previewCompanionReplies`, `previewListingInsight` and the rest in
   `shared/src/features/preview/sample-data.ts`). A price question about a PS5 shows the
   windbreaker's range.
3. **Deploying `estimate-price`** with the clues change.

**Keep these when you change it:**
- Prices only come from the cloud.
- The on-device model never states an amount of money.
- Brands from it count only when printed in the photo (`confirmedBrand`).
- Every on-device feature has a cloud or no-AI path.
- **The on-device model names things well but guesses brands.** Show or send a brand only when
  the same name is printed in the photo (`confirmedBrand`). Never ask it for a price.
- What the phone read travels to the cloud as `PhotoClues`, which are untrusted hints. The edge
  function cuts them to size and tells Gemini to use one only where the photo agrees with it.

## Design language

`shared/src/design/tokens.ts` decides every colour, font and size. Older guidance disagrees with it.
`agents/skills/offbrand-design/SKILL.md` and the Liquid Glass frames describe an ink canvas, a lime
accent, Space Grotesk and Inter. Where they disagree, the tokens and this file win; use the older
material only for layout and content ideas.

- **Places have colours:** Feed is price-gun red, Market marigold, History cobalt, Chats jeepney
  green. A tab opens on a block of its colour that ends in a scalloped edge (`ScallopEdge`), with
  the paper below printed with the price gun's pesos and eyelets (`PrintLayer` / `AmbientBackdrop`).
- **Anything you can hold is cut paper:** cards, photos, chips and tags get a 2pt ink outline and a
  hard shadow offset down and to the right. Use `held(colors)`; don't draw soft shadows on them.
- **The pieces:** the kraft price tag (`TagShape`), market stickers (`Sticker`), the price-gun stamp
  (`Stamp`), and Worthy, the tag-shaped mascot (`LogoMark`, `Worthy`).
- **Holographic foil means AI.** Anything the AI worked out wears the foil (`tokens.holo`):
  - the "✦ AI" foil sticker (`AiFoil`) on the estimate's kraft tag;
  - a foil dot (`EstimateMark` / `AiFoilDot`) where the number appears without its tag.

  Keep foil for the AI only. The seller's asking price stays plain and the community's verdict
  stays a market sticker, so the three can be told apart at a glance. Only the headline estimate
  shimmers (`shimmer`), never a list of them, and the shimmer rests with reduced motion.
- **Type:** Plus Jakarta Sans for reading and controls, Bricolage Grotesque for titles and every
  price, DM Mono for anything printed on a tag. Go through `SWText` variants.
- **No raw colours in components:** `npm run validate` rejects any hex, `rgb()` or `hsl()` outside
  the token modules. Add a token instead.

### Illustration

The onboarding drawings (`shared/src/features/onboarding/onboarding-art.tsx`) set the style for
any new artwork:

- Flat editorial illustration with natural proportions and one shade tone per material. Shirts carry
  patterns (stripes, dots, triangles), and the people have no outlines.
- **People never have faces.** Draw a head in profile (forehead, nose, chin) or from behind. Ovals
  with eyes looked uncanny and were rejected.
- Arms bend at the elbow and hands hold things (a phone, a placard on a stick). Keep necks short.
- Colours come from `tokens.illustration`, which stays the same in every appearance, plus the
  theme's brand colours.
- A soft blob of the sheet's own colour, lightened, sits behind a scene. Doodles are flat shapes
  with no outlines: sparkles, ₱ coins, pluses, rings and dashed trails.

## Motion

- **One spring for everything that moves:** firm, then soft, with no overshoot (stiffness 80,
  critically damped). Small doodles may pop with a slight overshoot; nothing else bounces.
- **A swiped scene follows one shared value:** the swipe position drives everything on the UI
  thread, so the finger scrubs the whole scene. See `OnboardingView` and `OnboardingScene`.
- **A step's moment plays once,** the first time the step is reached. Coming back finds the step as
  it was left. Never reset something already on screen just to replay it.
- **Words fade and lift as they change:** they don't blur, because React Native can't blur a view
  on iOS.
- **Respect reduced motion:** short cross-fades, no tumbling, no idle bobbing.
- **Backdrop stickers morph rather than cross-fade.** Every sticker shape is drawn by the same
  112 points around its centre (`shared/src/components/sticker-form.ts`), so a scallop, a tag and
  a coin can turn into one another. The outline and colour blend while the sticker travels. A
  shape's small print, such as the eyelet or the ₱, leaves in the first half and arrives in the
  second. A new shape has to be described the same way.
- **The backdrop changes only once someone settles on a tab** (`tokens.motion.duration.backdropSettle`),
  so switching tabs quickly doesn't thrash it.

## Platform gotchas we've already paid for

- **iOS:** sibling views with 3D transforms are depth-sorted, so a flat sibling, such as a hard
  shadow, can cut through a card that turns in 3D or lies flat at the same depth. Give every 3D view
  its own wrapper `View` with `collapsable={false}`.
- **Two-sided cards and tags, on both platforms:** the faces are flattened into the card before it
  turns. A back face built with `rotateY(180deg)` plus `backfaceVisibility: 'hidden'` is therefore
  hidden before the card turns over, and you see straight through it to the shadow. Draw the back
  face mirrored with `scaleX: -1`, and choose which face to show from the rotation angle.
- **iOS tab switching:** the system cross-fades whole tab screens, and that can't be changed. Each
  native tab draws its own backdrop. On web, one shared backdrop sits behind all the tabs
  (`BackdropHostContext`).
- **Metro:** restart with `--clear` after adding a `.web.tsx` file, or it keeps serving the old one.
- **Gestures:** a draggable thing inside a swipeable scene uses `Gesture.Pan().blocksExternalGesture(pager)`.

## Secrets and setup

- Supabase keys live in `/.env.local` at the repo root, which git ignores. `Frontend/mobile/.env.local`
  and `Frontend/web/.env.local` are symlinks to it.
- Only the publishable (anon) key goes in the app: `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never put an
  `sb_secret_…` or service-role key in the app or in `.env.local`. If one is ever shared, roll it in
  the Supabase dashboard.
- Without Supabase configured, sign-in starts a local session on the device. The app still runs.

## Before you call a change done

Run these from `Frontend/`:

1. `npm run validate` runs the lint, type checks, source rules (including the colour rule) and the
   unit tests.
2. `npm run format:check`.
3. For web changes, start `npx expo start --web --port 8090` in `Frontend/web`, then run
   `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8090 npx playwright test --workers=1`. Run the tests one at
   a time, because they time out under parallel load on the dev server.
4. Look at the change on the iOS simulator and in a browser at phone width. Several of the bugs
   above only showed on one platform.
