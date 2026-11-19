# Screens and the services behind them

Every screen in the app runs on a service. With a Supabase project configured
(`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`), the composition root
(`composition/index.tsx`) wires each port to its Supabase adapter, and screens show only that
account's real data: anything the project can't supply is hidden or says it's empty. Without a
project the app runs alone on the device on the preview data in `preview/sample-data.ts`, which is
how it's tried out and demoed. Sample content never shows in Supabase mode (`useBackendMode()`).

| Area                                | Port / provider                              | Supabase side                                                           |
| ----------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| Feed, votes, posts                  | `FeedRepository` (`feed/feed-state.tsx`)     | `feed_posts`, `votes`, moderated by `moderate-content`                  |
| Comments                            | `CommentService`                             | posted through `moderate-comment`, screened again by `moderate-content` |
| Marketplace, listings, price alerts | `MarketplaceRepository`                      | `listings` (with `category`), saved listings                            |
| Hanap                               | `HanapRepository`                            | `hanap_posts`, moderated by `moderate-content`                          |
| Chats, offers, meetups              | `ChatService` (`chat/chat-state.tsx`)        | conversations and messages over Realtime                                |
| History, collections, paid prices   | `ScanHistoryProvider`, `CollectionsProvider` | `scan_history`, `collections`, photo Storage                            |
| Photo estimates                     | `PhotoPricingService`                        | `estimate-price` (Gemini)                                               |
| Worthy's chat                       | `WorthyCloud` (`companion/worthy-cloud.tsx`) | `worthy-chat` (Gemini)                                                  |
| Moderation console                  | `AdminRepository` (`admin/admin-state.tsx`)  | admin RPCs, checked against `public.admins` on every call               |
| Account deletion                    | `features/auth/account-deletion.ts`          | `delete-account`                                                        |

The website is the moderators' console: it opens on `/admin`, lets only admins in, and wraps the
shared screens in `BrowseOnlyProvider` (`session/browse-only.tsx`) so they show posts, listings,
comments and people without voting, commenting, buying or selling. Everything else is the phone
app's. See `Backend/README.md` for the database, the Edge Functions and their secrets.
