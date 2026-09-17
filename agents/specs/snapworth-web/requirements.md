# Requirements Document

## Introduction

SnapWorth Web is the first delivery target for SnapWorth, a mobile-first valuation and peer-to-peer marketplace product. This specification covers a fully usable responsive website and desktop experience, not a marketing landing page. Android and iOS implementation is deferred until the website is complete. The frontend uses a web shell in `Frontend/web/`, one deferred Expo mobile shell for both Android and iOS in `Frontend/mobile/`, and reusable product code in `Frontend/shared/`. All clients use the single shared backend in `Backend/`.

The unavoidable product loop is: an authenticated user captures or selects an item photo; SnapWorth stores the item and photo before requesting an AI estimate; SnapWorth requests the estimate automatically; SnapWorth records the result in history; and SnapWorth presents the result as an advisory estimate rather than a confirmed asking price. After estimation, the user may keep the item private, publish the item to the Feed, or create a Marketplace listing with a manually confirmed asking price.

### Delivery Priority

- **Must-have:** authentication, capture or gallery upload, photo compression, immediate private item storage, automatic estimation, advisory estimate presentation, and account history.
- **Should-have:** Feed publishing, voting, comments, moderation, manual asking-price confirmation, Marketplace publishing, browsing, and filtering.
- **Could-have:** Chat, cross-posting, location filtering, and Admin Review.
- **Deferred:** native iOS and Android delivery until completion of the website requirements.
- **Out of scope:** payments, escrow, shipping and logistics, buyer or seller identity verification, and hardware or Internet of Things integration.

### Required Website Routes

`/`, `/login`, `/signup`, `/reset-password`, `/onboarding`, `/capture`, `/item/[id]`, `/history`, `/feed`, `/post/[id]`, `/list/[id]`, `/marketplace`, `/listing/[id]`, `/chat`, `/chat/[id]`, and `/admin/review`.

### Design and Implementation Prerequisite

Before the design phase and every later implementation phase, the responsible agent MUST read `/Users/clarkjaca/CodingProjects/SnapWorth/SnapWorth/agents/skills/offbrand-design/SKILL.md` and apply the derived method, original SnapWorth tokens, component constraints, accessibility rules, motion rules, and screen briefs. The project MUST NOT copy OFF+BRAND assets or trade dress.

## Glossary

- **SnapWorth_Web**: The responsive website version of SnapWorth delivered from the shared client codebase.
- **Shared_Frontend**: The Expo and React Native application that uses Expo Router for routing and NativeWind for styling across web and future native targets.
- **Website_User**: A person accessing SnapWorth Web through a supported browser.
- **Authenticated_User**: A Website User with a valid Supabase Auth session.
- **Administrator**: An Authenticated User assigned the administrator role.
- **Public_Auth_Route**: `/login`, `/signup`, or `/reset-password`.
- **Product_Route**: Any Required Website Route other than `/` and the Public Auth Routes.
- **Route_Guard**: The Shared Client behavior that permits or redirects route access according to session and role state.
- **Main_Screen**: The `/capture` route that provides the primary entry point to the SnapWorth product loop.
- **Onboarding**: The skippable first-run introduction at `/onboarding` that explains the photo-to-estimate loop.
- **Capture_Flow**: The sequence that accepts a camera capture or gallery photo, compresses the photo, stores the item and photo, and requests estimation.
- **Item_Service**: The domain service that owns item capture, history storage, history retrieval, and item deletion behavior.
- **Stored_Item**: An item record and associated privately stored photo that exist before an estimate request begins.
- **AI_Pricing_Service**: A provider-neutral service that returns an advisory valuation for a Stored Item through a server-side adapter.
- **AI_Estimate**: A provider-generated advisory monetary value that is not an Asking Price.
- **EstimateBadge**: The dedicated component that presents an AI Estimate with the `AI ESTIMATE` overline, provisional styling, and the caption `Estimate only — not a listing price.`
- **AskingPriceBadge**: The dedicated component that presents a user-confirmed Asking Price with the `ASKING PRICE` overline and settled styling.
- **History**: The Authenticated User's collection of Stored Items and associated estimation states.
- **Private_Destination**: The post-estimate choice that retains a Stored Item only in History.
- **Feed**: The public stream of published item posts.
- **Feed_Post**: A public item representation containing the item photo, AI Estimate context, vote tally, and comment thread.
- **Vote**: One Authenticated User's active `Too High`, `Too Low`, or `Just Right` assessment of a Feed Post.
- **Comment**: Text submitted by an Authenticated User to a Feed Post discussion.
- **Moderation_Service**: The provider-neutral service that classifies submitted public content before display.
- **Held_Content**: Submitted public content that remains hidden while moderation is unresolved or requires administrator review.
- **Marketplace**: The browsable collection of active Listings.
- **Listing**: A Marketplace record created from a Stored Item with a manually supplied Asking Price.
- **Asking_Price**: A positive monetary value explicitly entered and confirmed by the owner of a Stored Item.
- **Cross_Post**: An owner action that publishes an eligible Feed Post as a Listing or an eligible Listing as a Feed Post without changing the Asking Price or AI Estimate meaning.
- **Conversation**: A buyer-seller message thread associated with a Listing.
- **Chat**: The conversation list and message-thread capability backed by Supabase Realtime.
- **Admin_Review**: The administrator-only queue and decision interface for Held Content.
- **Supabase_Platform**: Supabase Auth, PostgreSQL, Storage, Realtime, and Edge Functions used by SnapWorth.
- **Edge_Function**: Server-side Supabase code that holds provider credentials, applies rate limits, and calls external AI providers.
- **Provider_Adapter**: A provider-neutral interface with mock and Edge Function implementations for pricing or moderation.
- **Seeded_Data**: Deterministic local or development data that supports complete website flows without live AI providers.
- **Operational_State**: A loading, empty, success, offline, or failed state relevant to a screen or action.
- **Primary_Action**: The single visually emphasized action that advances the purpose of a screen.
- **Dominant_Element**: The single visual element with the strongest hierarchy on a screen.
- **Reduced_Motion_Mode**: The operating-system preference that replaces transform and count-up motion with immediate values or opacity transitions.
- **Normal_Conditions**: An available network connection, a supported current browser, payloads within documented limits, and dependent services responding within their service limits.
- **Supported_Current_Browser**: A current stable release or immediately preceding major release of Chrome, Edge, Firefox, or Safari with JavaScript enabled and no plugin requirement.
- **Data_Layer**: Supabase PostgreSQL policies and Storage policies that authorize access independently of Shared Client behavior.
- **Private_User_Data**: Stored Items, private photos, History entries, and Conversations whose access is restricted to authorized users.
- **Secure_Transport**: HTTPS for request-response traffic and WSS for realtime traffic.

## Requirements

### Requirement 1: Web-First Shared Product Delivery [Must-have]

**User Story:** As a product owner, I want the complete website delivered first from the shared client architecture, so that SnapWorth can validate the product before native mobile delivery without creating a separate web codebase.

#### Acceptance Criteria

1. THE SnapWorth_Web SHALL provide a fully usable product website rather than a marketing-only landing page.
2. THE Shared_Frontend SHALL use Expo and React Native as the application runtime architecture.
3. THE Shared_Frontend SHALL use Expo Router to map the Required Website Routes to browser URLs.
4. THE Shared_Frontend SHALL use NativeWind for component and screen styling.
5. THE Shared_Frontend SHALL preserve source compatibility for future iOS and Android targets without requiring a separate website implementation.
6. THE SnapWorth_Web SHALL defer native iOS and Android product delivery until the website requirements are complete.
7. THE SnapWorth_Web SHALL provide all Required Website Routes listed in this document.
8. WHEN a Supported Current Browser requests SnapWorth Web, THE SnapWorth_Web SHALL operate without a browser plugin.

### Requirement 2: Authentication and Route Access [Must-have]

**User Story:** As a Website User, I want secure account access, so that personal items and product capabilities remain associated with my account.

#### Acceptance Criteria

1. WHEN a Website User submits valid signup credentials, THE SnapWorth_Web SHALL create an account through Supabase Auth.
2. WHEN a Website User submits valid login credentials, THE SnapWorth_Web SHALL establish an authenticated session through Supabase Auth.
3. IF a Website User submits invalid authentication credentials, THEN THE SnapWorth_Web SHALL display a specific authentication error without establishing a session.
4. WHEN a Website User requests a password reset for a registered email address, THE SnapWorth_Web SHALL initiate the Supabase Auth password-reset flow.
5. WHEN an Authenticated User signs out, THE SnapWorth_Web SHALL terminate the active session.
6. IF an unauthenticated Website User requests a Product Route, THEN THE Route_Guard SHALL redirect the Website User to `/login`.
7. WHEN an Authenticated User requests a non-administrator Product Route, THE Route_Guard SHALL permit access.
8. IF a non-administrator Authenticated User requests `/admin/review`, THEN THE Route_Guard SHALL redirect the Authenticated User to the Main Screen.
9. WHEN the `/` route resolves an authenticated session, THE Route_Guard SHALL redirect the Authenticated User to the appropriate first-run Onboarding or Main Screen.
10. WHEN the `/` route resolves no authenticated session, THE Route_Guard SHALL redirect the Website User to `/login`.

### Requirement 3: Onboarding and Main-Screen Capture Access [Must-have]

**User Story:** As a first-time Authenticated User, I want a concise introduction and immediate access to photo capture, so that I can understand and start the core product loop.

#### Acceptance Criteria

1. WHEN an Authenticated User opens Onboarding for the first time, THE SnapWorth_Web SHALL explain the photo-to-estimate loop in no more than three steps.
2. WHILE Onboarding is displayed, THE SnapWorth_Web SHALL provide a control that skips the remaining steps.
3. WHEN an Authenticated User completes or skips Onboarding, THE SnapWorth_Web SHALL navigate to the Main Screen.
4. WHEN an Authenticated User opens the Main Screen, THE SnapWorth_Web SHALL make camera capture or gallery upload reachable through one user action.
5. IF browser camera access is unavailable or denied, THEN THE SnapWorth_Web SHALL keep gallery upload available.
6. IF the network is unavailable before upload, THEN THE SnapWorth_Web SHALL identify the network dependency without discarding the selected photo.

### Requirement 4: Durable Capture and Automatic Estimation [Must-have]

**User Story:** As an Authenticated User, I want every selected item photo saved before automatic estimation, so that provider failure cannot cause the loss of my item.

#### Acceptance Criteria

1. WHEN an Authenticated User selects a valid item photo, THE Capture_Flow SHALL compress the photo before upload.
2. WHEN photo compression completes, THE Item_Service SHALL create the Stored Item before requesting an AI Estimate.
3. WHEN photo compression completes, THE Item_Service SHALL store the compressed photo before requesting an AI Estimate.
4. WHEN the Stored Item exists, THE Capture_Flow SHALL request an AI Estimate automatically.
5. THE Capture_Flow SHALL omit any control that skips the automatic estimate request.
6. WHEN the AI estimate request begins, THE Capture_Flow SHALL add the Stored Item to History with an estimating state.
7. WHEN the AI_Pricing_Service returns an AI Estimate, THE Capture_Flow SHALL associate the AI Estimate with the Stored Item.
8. WHEN the AI_Pricing_Service returns an AI Estimate, THE Capture_Flow SHALL update the History entry to an estimated state.
9. IF the AI_Pricing_Service fails or times out, THEN THE Capture_Flow SHALL retain the Stored Item and compressed photo in History.
10. IF the AI_Pricing_Service fails or times out, THEN THE Capture_Flow SHALL offer an estimate retry for the existing Stored Item.
11. IF the network becomes unavailable after storage and before estimation completes, THEN THE Capture_Flow SHALL retain the Stored Item in a retryable estimation state.

### Requirement 5: Honest Estimate Presentation [Must-have]

**User Story:** As an Authenticated User, I want AI values distinguished from seller prices, so that I can act on an estimate without mistaking the estimate for a confirmed price.

#### Acceptance Criteria

1. THE Shared_Frontend SHALL implement EstimateBadge and AskingPriceBadge as separate components rather than variants of one component.
2. WHEN the SnapWorth_Web displays an AI Estimate, THE EstimateBadge SHALL display the `AI ESTIMATE` overline.
3. WHEN the SnapWorth_Web displays an AI Estimate, THE EstimateBadge SHALL display the caption `Estimate only — not a listing price.`
4. WHEN the SnapWorth_Web displays an AI Estimate, THE EstimateBadge SHALL use the provisional dashed-border treatment defined by the SnapWorth design system.
5. WHEN the SnapWorth_Web displays an Asking Price, THE AskingPriceBadge SHALL display the `ASKING PRICE` overline.
6. WHEN the SnapWorth_Web displays an Asking Price, THE AskingPriceBadge SHALL use the settled solid-border treatment defined by the SnapWorth design system.
7. THE SnapWorth_Web SHALL reserve the provisional dashed-border treatment for AI Estimates.
8. THE SnapWorth_Web SHALL display the item photo wherever a Stored Item, Feed Post, or Listing is represented.
9. WHEN an estimate fails, THE `/item/[id]` route SHALL state that the item photo remains saved.

### Requirement 6: History and Post-Estimate Destinations [Must-have]

**User Story:** As an Authenticated User, I want to revisit estimated items and choose each item's destination, so that I control whether an item remains private or becomes public.

#### Acceptance Criteria

1. WHEN an Authenticated User opens `/history`, THE SnapWorth_Web SHALL display History entries owned by the Authenticated User.
2. WHEN History contains no entries, THE SnapWorth_Web SHALL display an empty state with a path to the Main Screen.
3. WHEN an Authenticated User opens a History entry, THE SnapWorth_Web SHALL navigate to `/item/[id]` for the selected Stored Item.
4. WHEN an Authenticated User deletes a Stored Item after confirmation, THE Item_Service SHALL remove the Authenticated User's History entry according to the retention policy.
5. WHEN an AI Estimate is available, THE `/item/[id]` route SHALL offer Private Destination, Feed publication, and Marketplace listing as distinct destinations.
6. WHEN an Authenticated User selects Private Destination, THE SnapWorth_Web SHALL retain the Stored Item without creating a Feed Post or Listing.
7. WHEN an Authenticated User selects Feed publication, THE SnapWorth_Web SHALL begin the Feed publication flow without changing the AI Estimate into an Asking Price.
8. WHEN an Authenticated User selects Marketplace listing, THE SnapWorth_Web SHALL navigate to `/list/[id]` without prepopulating the Asking Price from the AI Estimate.

### Requirement 7: Public Feed [Should-have]

**User Story:** As an Authenticated User, I want to publish and browse item estimates, so that the community can assess estimated values.

#### Acceptance Criteria

1. WHEN an Authenticated User publishes an eligible Stored Item to the Feed, THE SnapWorth_Web SHALL create a Feed Post associated with the Stored Item.
2. WHEN the Moderation_Service approves a Feed Post, THE Feed SHALL make the Feed Post visible to Authenticated Users.
3. WHILE a Feed Post is Held Content, THE Feed SHALL withhold the Feed Post from public display.
4. WHEN an Authenticated User opens `/feed`, THE SnapWorth_Web SHALL display a paginated first page of visible Feed Posts.
5. WHEN an Authenticated User opens `/post/[id]`, THE SnapWorth_Web SHALL display the selected Feed Post with vote totals and comments.
6. WHEN an owner unpublishes a Feed Post, THE Feed SHALL remove the Feed Post from public results.
7. IF the Feed has no visible posts, THEN THE SnapWorth_Web SHALL display a Feed empty state with a path to capture an item.

### Requirement 8: Feed Voting [Should-have]

**User Story:** As an Authenticated User, I want to rate public estimates, so that aggregate community opinion communicates whether an estimate appears high, low, or right.

#### Acceptance Criteria

1. WHEN an Authenticated User votes on another user's Feed Post, THE Feed SHALL record one active Vote for the Authenticated User and Feed Post.
2. WHEN an Authenticated User selects a different Vote on the same Feed Post, THE Feed SHALL replace the previous active Vote.
3. WHEN an Authenticated User selects the active Vote again, THE Feed SHALL withdraw the active Vote.
4. WHEN a Vote changes, THE Feed SHALL update the `Too High`, `Too Low`, and `Just Right` aggregate counts.
5. IF an Authenticated User attempts to vote on the Authenticated User's own Feed Post, THEN THE Feed SHALL reject the Vote.
6. WHEN the SnapWorth_Web displays voting choices, THE SnapWorth_Web SHALL distinguish every choice with text and an icon in addition to color.
7. WHILE a Vote request is pending, THE SnapWorth_Web SHALL display the pending selection state.
8. IF a Vote request fails, THEN THE SnapWorth_Web SHALL restore the last confirmed Vote state and display a retryable error.

### Requirement 9: Comments and Moderation [Should-have]

**User Story:** As an Authenticated User, I want moderated discussions on Feed Posts, so that community feedback remains visible only after content screening.

#### Acceptance Criteria

1. WHEN an Authenticated User submits a non-empty Comment, THE Moderation_Service SHALL screen the Comment before public display.
2. WHEN the Moderation_Service approves a Comment, THE Feed SHALL display the Comment in the associated Feed Post thread.
3. WHEN the Moderation_Service requires review, THE Feed SHALL classify the Comment as Held Content.
4. IF the Moderation_Service is unavailable, THEN THE Feed SHALL classify the submitted Comment as Held Content.
5. WHILE a Comment is Held Content, THE Feed SHALL withhold the Comment from other Authenticated Users.
6. WHEN a Comment is held, THE SnapWorth_Web SHALL notify the submitting Authenticated User that moderation is pending.
7. WHEN an owner deletes the owner's Comment, THE Feed SHALL remove the Comment from the public thread.
8. WHEN an Authenticated User reports visible public content, THE Feed SHALL create a moderation report associated with the content.

### Requirement 10: Manual Asking-Price Confirmation [Should-have]

**User Story:** As an item owner, I want to enter my own asking price, so that an AI Estimate cannot become a Marketplace price without my decision.

#### Acceptance Criteria

1. WHEN an Authenticated User opens `/list/[id]`, THE SnapWorth_Web SHALL display the AI Estimate as a non-editable EstimateBadge reference.
2. WHEN an Authenticated User opens `/list/[id]`, THE SnapWorth_Web SHALL initialize the Asking Price field as empty.
3. WHILE the Asking Price field is empty, THE SnapWorth_Web SHALL disable Listing publication.
4. IF the Authenticated User enters a non-numeric or non-positive Asking Price, THEN THE SnapWorth_Web SHALL display a validation error without publishing a Listing.
5. WHEN the Authenticated User enters and confirms a positive Asking Price, THE SnapWorth_Web SHALL store the entered value as the Asking Price.
6. THE SnapWorth_Web SHALL omit any operation that copies an AI Estimate into an Asking Price.
7. WHEN the SnapWorth_Web displays the confirmed Asking Price, THE AskingPriceBadge SHALL render the confirmed value.
8. WHEN the Authenticated User publishes the Listing, THE Moderation_Service SHALL screen the Listing before public display.

### Requirement 11: Marketplace Browsing and Listing Detail [Should-have]

**User Story:** As an Authenticated User, I want to browse and filter active listings, so that I can find relevant items and assess seller prices.

#### Acceptance Criteria

1. WHEN an approved Listing is active, THE Marketplace SHALL include the Listing in browse results.
2. WHEN an Authenticated User opens `/marketplace`, THE SnapWorth_Web SHALL display a paginated first page of active Listings.
3. WHEN an Authenticated User applies a category filter, THE Marketplace SHALL return active Listings in the selected category.
4. WHEN an Authenticated User applies a price-range filter, THE Marketplace SHALL return active Listings within the selected inclusive price range.
5. WHERE location filtering is enabled, THE Marketplace SHALL return active Listings within the selected location constraint.
6. WHEN one or more filters are active, THE SnapWorth_Web SHALL display an always-available clear-filters control.
7. IF active filters produce no results, THEN THE SnapWorth_Web SHALL identify at least one active filter that the Authenticated User can relax.
8. WHEN an Authenticated User opens `/listing/[id]`, THE SnapWorth_Web SHALL display the Listing photo and AskingPriceBadge.
9. WHILE a Listing is sold or withdrawn, THE SnapWorth_Web SHALL display the Listing status and disable buyer contact initiation.
10. WHILE an Authenticated User views the Authenticated User's own Listing, THE SnapWorth_Web SHALL replace buyer contact initiation with owner actions.

### Requirement 12: Chat and Conversations [Could-have]

**User Story:** As an interested buyer or seller, I want listing-linked conversations, so that I can discuss a Marketplace item without leaving SnapWorth.

#### Acceptance Criteria

1. WHEN an Authenticated User initiates contact from another user's active Listing, THE Chat SHALL open or reuse a Conversation associated with the Listing and participants.
2. WHEN an Authenticated User opens `/chat`, THE SnapWorth_Web SHALL display Conversations in descending order of latest message activity.
3. WHEN an Authenticated User opens `/chat/[id]`, THE SnapWorth_Web SHALL display messages for an authorized Conversation.
4. IF an Authenticated User requests an unauthorized Conversation, THEN THE Chat SHALL deny access without exposing Conversation content.
5. WHEN an Authenticated User sends a non-empty message in an active Conversation, THE Chat SHALL display a pending message state while delivery is unresolved.
6. WHEN Supabase Realtime confirms a message, THE Chat SHALL display the message as delivered.
7. IF message delivery fails, THEN THE Chat SHALL preserve the unsent message text and offer retry.
8. WHEN a participant blocks another participant, THE Chat SHALL prevent new messages between the blocked participant pair.
9. IF an Authenticated User has no Conversations, THEN THE SnapWorth_Web SHALL display a Chat empty state with a path to Marketplace.

### Requirement 13: Cross-Posting [Could-have]

**User Story:** As an item owner, I want to reuse an item across Feed and Marketplace, so that I can avoid repeating item setup while preserving price meaning.

#### Acceptance Criteria

1. WHERE Cross-Post is enabled, WHEN an owner cross-posts a Feed Post to Marketplace, THE SnapWorth_Web SHALL require manual Asking Price confirmation before Listing publication.
2. WHERE Cross-Post is enabled, WHEN an owner cross-posts a Listing to Feed, THE SnapWorth_Web SHALL preserve the Listing's Asking Price as an Asking Price.
3. WHERE Cross-Post is enabled, WHEN an owner cross-posts an item, THE SnapWorth_Web SHALL reuse the Stored Item photo.
4. WHERE Cross-Post is enabled, THE SnapWorth_Web SHALL retain separate AI Estimate and Asking Price fields for the resulting public records.

### Requirement 14: Administrator Moderation Review [Could-have]

**User Story:** As an Administrator, I want to resolve held and reported content, so that public areas can recover from uncertain or policy-violating submissions.

#### Acceptance Criteria

1. WHEN an Administrator opens `/admin/review`, THE Admin_Review SHALL display unresolved Held Content and moderation reports.
2. WHEN the Admin Review queue contains entries, THE Admin_Review SHALL order entries by moderation priority and submission time.
3. WHEN an Administrator approves Held Content, THE Admin_Review SHALL make the approved content eligible for public display.
4. WHEN an Administrator removes Held Content, THE Admin_Review SHALL retain the moderation decision without making the content public.
5. WHILE an administrator decision is pending, THE Admin_Review SHALL prevent duplicate decisions for the same queue entry.
6. IF the Admin Review queue contains no entries, THEN THE SnapWorth_Web SHALL display an empty queue state.

### Requirement 15: Responsive, Accessible, and Consistent Experience [Must-have]

**User Story:** As a Website User, I want an accessible and coherent interface across browser sizes, so that I can understand and operate SnapWorth using my preferred input and accessibility settings.

#### Acceptance Criteria

1. WHEN browser viewport width changes from 320 CSS pixels through 1920 CSS pixels, THE SnapWorth_Web SHALL preserve access to all content and actions without horizontal page scrolling except within explicitly horizontal controls.
2. THE Shared_Frontend SHALL use the original SnapWorth design tokens and components derived from the Off+Brand method without copying OFF+BRAND assets or trade dress.
3. THE Shared_Frontend SHALL use the SnapWorth design tokens as the source of color, typography, spacing, radius, and motion values.
4. THE SnapWorth_Web SHALL present one Dominant Element on each visible Product Route.
5. THE SnapWorth_Web SHALL present no more than one filled Primary Action on each visible Product Route.
6. WHEN the SnapWorth_Web displays an icon-only control, THE SnapWorth_Web SHALL provide an accessible text label for the control.
7. WHEN the SnapWorth_Web communicates status or choice with color, THE SnapWorth_Web SHALL provide a text, icon, shape, or pattern cue in addition to color.
8. THE SnapWorth_Web SHALL maintain a contrast ratio of at least 4.5:1 for normal text.
9. THE SnapWorth_Web SHALL maintain a contrast ratio of at least 3:1 for large text and interactive component boundaries.
10. WHEN the Website User increases operating-system or browser text scaling to 200 percent, THE SnapWorth_Web SHALL preserve readable content and operable controls without clipped text.
11. THE SnapWorth_Web SHALL provide keyboard access to every interactive control.
12. THE SnapWorth_Web SHALL provide a visible focus indicator for every keyboard-focusable control.
13. THE Shared_Frontend SHALL preserve a uniform visual language across web and future native targets.
14. WHEN the Website User switches between supported light and dark appearance preferences, THE SnapWorth_Web SHALL render the applicable SnapWorth theme.
15. WHEN an item is represented, THE SnapWorth_Web SHALL display the associated item photo with alternative text.

### Requirement 16: Meaningful Motion and Complete Operational States [Must-have]

**User Story:** As a Website User, I want motion and status feedback to explain system changes, so that I can follow progress without distraction or uncertainty.

#### Acceptance Criteria

1. WHEN the SnapWorth_Web animates an interface element, THE SnapWorth_Web SHALL use the animation to communicate a state change.
2. THE SnapWorth_Web SHALL limit extended motion to the estimate reveal and estimation wait experiences.
3. WHILE Reduced Motion Mode is enabled, THE SnapWorth_Web SHALL replace transform and count-up animations with immediate values or opacity transitions.
4. WHILE Reduced Motion Mode is enabled, THE SnapWorth_Web SHALL present information equivalent to the standard motion experience.
5. THE SnapWorth_Web SHALL provide applicable loading, empty, and failed Operational States for each Product Route.
6. IF a retryable operation fails, THEN THE SnapWorth_Web SHALL identify the failed operation and provide a retry action.
7. WHILE a network-dependent operation cannot proceed offline, THE SnapWorth_Web SHALL display an offline status without discarding recoverable user input.
8. WHEN list content is loading, THE SnapWorth_Web SHALL display a skeleton that reflects the final content layout rather than a blank screen.

### Requirement 17: Performance and Media Budgets [Must-have]

**User Story:** As an Authenticated User, I want prompt feedback and bounded waits, so that the website remains understandable on typical network connections.

#### Acceptance Criteria

1. WHEN an AI Estimate request begins under Normal Conditions, THE AI_Pricing_Service SHALL return an AI Estimate or explicit failure within 10 seconds.
2. WHILE an AI Estimate request remains unresolved for 2 seconds, THE SnapWorth_Web SHALL display estimation progress with the item photo visible.
3. WHEN an Authenticated User requests the first Feed page under Normal Conditions, THE SnapWorth_Web SHALL render the first usable page within 3 seconds.
4. WHEN an Authenticated User requests the first Marketplace page under Normal Conditions, THE SnapWorth_Web SHALL render the first usable page within 3 seconds.
5. WHEN an Authenticated User sends a Chat message under Normal Conditions, THE Chat SHALL deliver the message to an active recipient Conversation within 2 seconds.
6. WHEN the Capture Flow receives a supported image, THE Capture_Flow SHALL produce a compressed upload payload before network upload.
7. IF a selected image exceeds documented type or size limits, THEN THE Capture_Flow SHALL reject the image with the applicable limit and preserve access to photo selection.

### Requirement 18: Data Privacy and Secure Integration [Must-have]

**User Story:** As an Authenticated User, I want personal data and provider credentials protected independently of browser behavior, so that client tampering cannot bypass access controls or expose secrets.

#### Acceptance Criteria

1. THE Data_Layer SHALL restrict Private User Data access to authorized Authenticated Users.
2. WHEN an Authenticated User requests another user's private Stored Item or History entry, THE Data_Layer SHALL deny access.
3. WHEN an Authenticated User requests a Conversation, THE Data_Layer SHALL return Conversation content only to an authorized participant.
4. THE Supabase_Platform SHALL store private item photos in storage protected by owner-aware access policies.
5. THE SnapWorth_Web SHALL use Secure Transport for all production network communication.
6. THE Edge_Function SHALL store external AI provider credentials outside the Shared Client bundle.
7. THE Edge_Function SHALL enforce server-side rate limits for AI pricing and moderation requests.
8. THE Shared_Frontend SHALL omit external AI provider credentials from browser-delivered assets.
9. WHEN the Shared_Frontend invokes pricing or moderation, THE Shared_Frontend SHALL call the applicable Edge Function through a Provider Adapter.
10. IF a production request selects a development-only permit-all moderation adapter, THEN THE Supabase_Platform SHALL reject public content publication.

### Requirement 19: Seeded Usability and Provider-Neutral Seams [Must-have]

**User Story:** As a development team, I want the website usable with deterministic data and replaceable providers, so that core flows can be completed before live-provider and Supabase integration is finalized.

#### Acceptance Criteria

1. WHERE Seeded Data mode is enabled, THE SnapWorth_Web SHALL support authentication-state simulation for all non-administrator Product Routes.
2. WHERE Seeded Data mode is enabled, THE Capture Flow SHALL complete storage, estimation, History, Feed, Marketplace, and Chat flows without paid provider calls.
3. WHERE Seeded Data mode is enabled, THE Provider Adapter SHALL return deterministic normalized pricing and moderation responses.
4. WHEN the selected Provider Adapter changes between mock and Edge Function implementations, THE AI_Pricing_Service SHALL preserve the normalized AI Estimate contract.
5. WHEN the selected Provider Adapter changes between mock and Edge Function implementations, THE Moderation_Service SHALL preserve the normalized moderation verdict contract.
6. THE Shared_Frontend SHALL preserve the existing presentation, component, application, service, data-access, and adapter layer boundaries.
7. THE SnapWorth_Web SHALL permit replacement of Seeded Data with Supabase Platform data without changing Product Route contracts.
8. IF a mock provider produces a configured failure, THEN THE SnapWorth_Web SHALL expose the same retryable Operational State used for an equivalent live-provider failure.

### Requirement 20: Explicit Product Exclusions [Must-have]

**User Story:** As a product owner, I want the website boundary stated explicitly, so that implementation remains focused on valuation and peer-to-peer discovery.

#### Acceptance Criteria

1. THE SnapWorth_Web SHALL omit payment collection and payment processing capabilities.
2. THE SnapWorth_Web SHALL omit escrow capabilities.
3. THE SnapWorth_Web SHALL omit shipping and logistics fulfillment capabilities.
4. THE SnapWorth_Web SHALL omit buyer identity verification and seller identity verification capabilities.
5. THE SnapWorth_Web SHALL omit hardware and Internet of Things integration capabilities.
