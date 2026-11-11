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

## What's built and what isn't

Keep this list current: when you finish or start something, move it here in the same change.
Last updated 2026-11-11.

### Working for real

- **Accounts:** sign-up and sign-in with email against Supabase, on the phone and the web. Google
  sign-in on the phone now finishes too (PR #20), but hasn't been checked on a device yet. Guests can
  look around, and an account is asked for, with the reason, only when they act.
- **Password reset:** "Forgot password?" emails a link that opens `/new-password` (web) or
  `snapworth://new-password` (phone) to choose a new one. The answer never says whether an email
  has an account; expired or used links say so. Needs the Redirect URLs in "Sign-in setup".
- **Deleting an account:** Profile → Delete account asks for the typed word DELETE (not a
  password: Google and Apple accounts have none), then the `delete-account` Edge Function removes
  the person's files in the `avatars` and `scan-photos` buckets and their Auth user, which every
  table cascades from (`account_deletion_test.sql` checks each one). This device's copies go too.
  Needs `npx supabase functions deploy delete-account`.
- **One sign-in:** chats, comments, Hanap and suki use the same Supabase client as sign-in, so what
  someone does belongs to the account they signed in with (PR #20).
- **Your own profile:** name, handle, photo, location and bio come from the account, and the listed,
  sold and chat counts from Supabase (PR #20). A new handle is saved to `public.profiles` too, so
  comments and chats show it; a taken one is turned away (needs the `profile_handles` migration
  deployed). A new photo is uploaded to Storage's public `avatars` bucket and set on
  `public.profiles`, so comments and chats show it too. The database only takes a photo the person
  uploaded to their own folder on this project's address, so locally the app must use the address
  the Supabase CLI prints. The "checked" count is the account's own saved scans.
- **Snap → AI estimate:** the phone's camera checks the photo and sends it to the
  `estimate-price` Edge Function (Gemini) for a real estimate.
- **On-device AI:** the photo check and label reading on every iPhone. With Apple Intelligence,
  also a first look at the item and Worthy's answers to light questions.
- **Feed comments:** stored in Supabase, moderated, threaded.
- **Admin review:** Profile → Moderation (shown only to an admin, see "Making someone an admin")
  lists what moderation holds (comments, feed posts, hanap) and what people reported (comments,
  and conversations, whose messages stay private). An admin approves, holds, removes or dismisses
  reports. Both the list and every decision go through `admin_review_queue()` and
  `admin_review_decide()`, which refuse anyone who isn't an admin, and each decision is logged in
  `moderation_log` (who and when), which the app can't read. Listings aren't in the queue yet: they
  need moderation columns first, then one select in the queue function and one branch in the
  decide function. Held and reported content shows no photos. Without a backend the screen shows
  sample cases. Needs the `admin_role` and `admin_review` migrations deployed.
- **Chats:** real messages over Supabase Realtime, offers, and agreeing a meetup on a map. Deployed
  to Supabase on 2026-10-30. The phone's Chats tab counts unread messages.
- **In-app banners:** while the app is open, a new message, offer or meetup proposal in a chat you
  aren't looking at shows a tappable banner that opens it, on the web and the phone. Not for your
  own messages, answers, blocked chats or the chat on screen; follows the Notifications switches.
- **Meetup reminders:** once a meetup is confirmed, the phone schedules local notifications for an
  hour before and, for a meetup at 11:00 or later, 8:00 that morning (no server or push needed).
  They follow the meetup: replaced if it changes, withdrawn if the chat closes, the person is
  blocked or you sign out. On the web and the phone, Chats also shows an Upcoming meetups card and
  a banner when each reminder's time comes while the app is open. The phone asks for notification
  permission from the Notifications screen. The meetup sheet writes only "Today, 2:00 PM" style
  words, so the time is worked out from when it was proposed; a time that can't be read gets no
  reminder. An exact start time on the message would be sturdier.
- **Sharing a tag:** an item's share button makes a picture of its tag and opens the share sheet.
  Needs an app build made after 2026-10-30; older builds share text.
- **Native pickers on iOS:** choices use the system's segmented controls and menus on iOS; Android
  and the web keep the app's own chips. Tap-to-act chips (quick replies, suggestions) stay chips.
- **Hanap:** buyers post what they're looking for, and see the Market listings that match
  (Market shows the count). Moderated like comments. The database table and the
  `moderate-content` change need deploying.
- **Suki prices:** a seller gives a regular buyer a standing discount from the chat. Both see it,
  and the buyer's offers start from it. The database table needs deploying.
- **Photo coach:** tips before a snap, and after it, the shots that matter for that kind of item.
  **Not complete:** only iPhones with Apple Intelligence know the kind of item; every other device
  gets general tips until the cloud AI exists.

- **Saving snaps (PR #24):** each successful estimate is saved to History, in Supabase's
  `scan_history` table (private to its owner), with a copy on the phone for offline. A scan saved
  offline is sent when the app is back online. Each account on a shared phone sees only its own.
  History shows your own scans once you have one; before that, the sample items as a preview.
- **Scan photos:** after a scan is saved, its photo is uploaded to Storage's private
  `scan-photos` bucket, so History shows it on every device, through links that last 12 hours.
  The phone's own copy shows until the upload has gone; a failed upload is tried again on the
  next load. Listing or posting a scan will need a read policy for its photo (see the
  `photo_storage` migration's comment).
- **The item screen:** `/item/<scan id>` shows that scan: its estimate and range, why the AI
  priced it so and what it assumed, its photo, date and where it lives. An id that isn't one of
  the account's scans gets a page saying so. The sample items still open the sample preview.
- **Flip tracker:** what an owner paid for an item, and the gain, in History and on the item. It's
  stored on the scan (`scan_history.paid_php`), private to the owner, and set offline it's sent
  later. The sample items' prices are a preview.
- **Collections:** sets of History items, with their total and flip, shareable as a picture.
  Stored in the account (`collections`, `collection_items`), private to the owner; without a
  backend they stay on the phone. Collections and prices a phone kept before move into the
  account that owns their things, once.
- **Market and listings:** listings live in Supabase (`listings`), with photo, category, condition,
  area, coordinates, description and AI worth range. Owners can list a scan from History (`ConfirmPriceView`
  reads the real scan through `useItemDetail` and never copies `paid_php` or pre-fills the AI
  estimate as the asking price), edit their listing, mark it sold, or delete it. A read policy on
  `storage.objects` lets anyone view the scan photo of a public listing. Market, filters, listing
  pages, seller profiles (`profiles.display_name`, `bio`, `location`), Search, Hanap matches and
  Guess the worth all draw from real listings (falling back to the local sample seed when offline
  or before any listings exist). Saved listings and price-drop alerts are stored per account in
  `saved_listings`.
- **Feed, votes and trends:** community price-check posts live in Supabase (`feed_posts`), linked
  to a saved scan (`scan_id`) or a marketplace listing (`listing_id`), and screened through
  `moderate-content`. A read policy on `storage.objects` lets anyone view the scan photo of an
  approved feed post. `CreatePostView` (`/ask/<id>`) reads the real scan or listing, and
  `ConfirmPriceView`'s "Also ask the feed" switch publishes a linked feed post alongside a new
  listing. Votes are stored per account in `votes` (one vote per person per post), with triggers
  keeping each post's `too_high_count`, `just_right_count` and `too_low_count` and any linked
  listing's `verdict` / `verdict_share` in sync. Feed, post discussion pages, Your votes
  (`VotesView`), Search and Trends (`TrendView`) all draw from real feed posts and listings.
- **Needs deploying:** `npx supabase db push` for the `scan_history`, `photo_storage`,
  `flips_and_collections`, `marketplace` and `feed_and_votes` migrations, and
  `npx supabase functions deploy moderate-content` for feed post screening.

### Kept on the device only

- **Guess the worth:** a daily game on the Feed. It's five of the Market's listings, the same five
  for everyone that day. You guess each one's worth, then see the AI's estimate and what voters
  think of the asking price. Your scores, streak and Sharp eye badges stay on the device; no
  account needed. It draws from the Market's real listings (or the sample listings when no backend
  is connected).

### Screens built, but showing sample data

These look finished but read from `shared/src/features/preview/sample-data.ts`, and what people do
on them isn't saved.

- **History, before the first scan:** the sample items, and their sample market detail (demand,
  condition, trend and recent sales) on the item screen. A real scan has no market detail yet.
- **Worthy's cards:** price, trend and collection answers.

### Not done yet

- **Sign-in:**
  - Google sign-in on the web is built (`/auth/callback`), but needs a Google OAuth client and
    Supabase's Google provider set up first; see "Sign-in setup".
  - Sign in with Apple is written but hidden: it needs the paid Apple Developer account. See
    "Sign-in setup" to turn it on.
- **Cloud AI** (a teammate owns this; see "Handoff" below):
  - Worthy's chat in the cloud.
  - Real data behind Worthy's cards.
  - Deploying the `estimate-price` update.
- **Notifications:**
  - Push needs the paid Apple Developer account. Until then `app.config.ts` sets the
    `expo-notifications` plugin to `enableRemoteNotifications: false`, so a prebuild doesn't add the
    `aps-environment` entitlement a free Personal Team can't sign. Remove that option to turn push on.
  - With the app closed, only meetup reminders and estimates reach the phone (local
    notifications). New messages and offers need push. The web has no reminders for a closed tab.
- **Map tiles and place search for launch:** a provider and plan for each. The defaults
  (OpenStreetMap's own tiles, and its Nominatim search behind the meetup map's search box) are
  for development only. Set `EXPO_PUBLIC_MAP_TILES_URL` and `EXPO_PUBLIC_PLACE_SEARCH_URL`.
- **Android:** not yet checked on a phone. The Snap bar may be hidden behind the tab bar.
- **A moderation provider:** Supabase has no `MODERATION_PROVIDER` secret set, so
  `moderate-content` holds every feed comment, feed post and hanap post: only its author sees it. Set
  `MODERATION_PROVIDER=rules` for the built-in word rules (fine while testing), or `openai` with an
  `OPENAI_API_KEY` (OpenAI's moderation is free) before launch. Set it in the dashboard under Edge
  Functions → Secrets, or with `npx supabase secrets set`.
- **Deployment:** EAS builds for the phones, and Vercel for the web.

The detailed task lists are in `agents/specs/`. Git keeps that folder local, so ask whoever has it,
or update this list instead.

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

### Meetups go wherever the two people choose

- People pin a meetup anywhere they like (in the Philippines): they drag the map under a fixed
  pin and name the spot (`MeetupPicker.tsx`). This was the product's call: a fixed list of
  places was too limiting.
- Busy public places are still suggested as shortcuts (`shared/src/types/meetup-spots.ts`,
  mirrored by the `meetup_spots` table), and the sheet nudges people to pick somewhere busy and
  public. A suggested place's name and pin always come from the server's list, so nobody can
  send "SM City Cebu" pointing somewhere quiet. Adding a suggestion means adding it to both lists
  (a unit test compares them).
- The map is an online map provider's street tiles (`map-tiles.ts`, set with
  `EXPO_PUBLIC_MAP_TILES_URL`), shown as they are. Don't draw our own map data or restyle the
  tiles: only what sits around and on the map (frame, price-tag pin, name sticker, compass, zoom
  buttons, notices) wears the app's design. If tiles can't load, the map says so. Directions opens
  the exact pin in the phone's own maps app.
- The suggested places' coordinates come from each place's Wikipedia entry, cross-checked with
  other listings. Source any new one the same way; don't guess coordinates.

### Why we ask for an account

Give this reason, in these words or close to them, wherever someone is asked: every price and vote
comes from a real person, so the community's verdicts stay fair. The last onboarding step says it:
"Looking around is free. Snapping, voting and selling need a free account, so every price here
comes from a real person."

### What people paid, and sharing a tag

- **Flip tracker:** an owner can note what they paid for an item ("What you paid" on the item
  screen). History shows the gain on each row and in total. Only the owner ever sees it: it's
  stored on the scan (`scan_history.paid_php`), private to the owner. Never copy it into a
  listing, a post or anything else others can read.
- **Shared tags:** an item's share button makes a picture of its tag (`ShareTagCard.tsx`) and
  shares it. The picture is always in the light palette (`PrintedTheme`). What was paid is only on
  it if the owner switches it on.

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

  | Job                                                    | Apple Intelligence iPhone  | Every other device                           |
  | ------------------------------------------------------ | -------------------------- | -------------------------------------------- |
  | Photo check (dark, blurry, no item), reading labels    | Phone (Vision, any iPhone) | Skipped; the cloud prices the photo as it is |
  | First look at the item ("Looks like: …")               | Phone                      | Skipped; the cloud estimate names the item   |
  | Worthy's light questions (how-to, photo tips, wording) | Phone                      | Cloud model                                  |
  | Prices, trends, collection value, listing drafts       | Cloud                      | Cloud                                        |

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
- **Platform files import themselves:** inside `Thing.ios.tsx`, `import … from './Thing'` resolves
  back to `Thing.ios.tsx` on iOS. Put what both versions share in a third file (see `ChipRow.tsx`
  and `checklist.ts`).
- **Gestures:** a draggable thing inside a swipeable scene uses `Gesture.Pan().blocksExternalGesture(pager)`.
- **Pictures of views on the web:** html2canvas, which draws the shared tag, loses anything React
  Native Web puts in its style sheet. So a view that must appear in the picture gets its colours
  and edges as plain inline styles (see `paintFor` in `ShareTagCard.tsx`). Tilts come out flat on
  the web; the phones keep them.

## Secrets and setup

- Supabase keys live in `/.env.local` at the repo root, which git ignores. `Frontend/mobile/.env.local`
  and `Frontend/web/.env.local` are symlinks to it.
- Only the publishable (anon) key goes in the app: `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never put an
  `sb_secret_…` or service-role key in the app or in `.env.local`. If one is ever shared, roll it in
  the Supabase dashboard.
- Without Supabase configured, sign-in starts a local session on the device. The app still runs.

### Making someone an admin

An admin is a row in `public.admins`. Only the database owner can write it: the app can't read or
change the table, and nothing an account controls (its metadata, its email address) grants the
role. In the dashboard's SQL editor, with the person's sign-up email:

```sql
insert into public.admins (user_id) select id from auth.users where email = 'them@example.com';
-- and to take it away again:
delete from public.admins where user_id = (select id from auth.users where email = 'them@example.com');
```

The app asks `is_admin()` and shows Profile → Moderation to a yes. Needs the `admin_role`
migration deployed.

### Sign-in setup

Dashboard settings the code can't make. `<web>` is the web app's address (for example
`https://snapworth.app`); `<ref>` is the Supabase project ref.

1. **Redirect URLs** (Supabase → Authentication → URL Configuration). Site URL: `<web>`. Redirect
   URLs: `<web>/new-password`, `<web>/auth/callback`, `http://localhost:8081/**` (the web dev
   server), `snapworth://**` (phone builds) and `exp://**` (Expo Go). Supabase sends a link
   anywhere else to the Site URL instead, so a missing entry looks like a link that does nothing.
2. **Email:** Supabase's built-in mailer sends only a few emails an hour. Set up custom SMTP
   (Authentication → Emails → SMTP Settings) before people rely on password reset.
3. **Google** (web and phone both go through Supabase's Google provider):
   - Google Cloud Console → APIs & Services → OAuth consent screen: app name, support email,
     authorized domains `<ref>.supabase.co` and `<web>`'s domain, scopes `openid`, `email`,
     `profile`. Publish it, or add testers while it's in testing.
   - Credentials → Create credentials → OAuth client ID → Web application. Authorized JavaScript
     origins: `<web>` and `http://localhost:8081`. Authorized redirect URI:
     `https://<ref>.supabase.co/auth/v1/callback`.
   - Supabase → Authentication → Sign In / Providers → Google: turn it on and paste the client
     ID and secret.
4. **Sign in with Apple** (iPhone only; needs the paid Apple Developer account, so it's off):
   - Apple Developer → Certificates, Identifiers & Profiles → Identifiers → `com.snapworth.app`:
     turn on Sign In with Apple.
   - Supabase → Sign In / Providers → Apple: turn it on and add `com.snapworth.app` to Client
     IDs. The secret key is only for Apple on the web, which isn't built.
   - In `Frontend/mobile`: `npx expo install expo-apple-authentication expo-crypto`, then pin both
     to exact versions in `package.json` (`npm run check:dependency-pins` must stay green).
   - `app.config.ts`: add `usesAppleSignIn: true` under `ios`, and `'expo-apple-authentication'`
     to `plugins`. This adds the entitlement that a free Personal Team can't sign.
   - `mobile/src/apple-sign-in.ts`: import both modules and replace `requestAppleCredential`'s
     `null` with the function in its comment.
   - Set `EXPO_PUBLIC_APPLE_SIGN_IN=1` in `.env.local`, run `npx expo prebuild --clean` and build
     with the paid team. The button then shows on iOS. App Review expects it whenever Google
     sign-in is offered, so do this before submitting to the App Store.

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
