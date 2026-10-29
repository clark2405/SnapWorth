# SnapWorth Backend

`Backend/` is the single shared backend for SnapWorth's web, Android and iOS apps: Supabase Auth, PostgreSQL with Row Level Security (RLS), Storage, Realtime, and Edge Functions. Provider secrets (AI moderation and pricing keys) stay here, server-side, and never ship in an app.

## What is built

| Area                 | Where                                                  | What it does                                                                                                       |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Feed discussion      | `supabase/migrations/20261005000000_feed_comments.sql` | Profiles, feed posts, comments with one level of replies, reports, and the RLS policies that decide who sees what. |
| Chats                | `supabase/migrations/20261029000000_chat.sql`          | Listings (the minimum a chat needs), conversations, messages, offers, pickups, blocks, reports, and their RLS.     |
| Moderation           | `supabase/functions/moderate-content/`                 | Screens each new comment and approves or holds it. Fail-closed: nothing is public until it has been screened.      |
| Moderation providers | `supabase/functions/_shared/providers/moderation.ts`   | `openai` (OpenAI's free moderation endpoint) for real use; `rules` (a fixed word list) for local development.      |
| Development data     | `supabase/seed/`                                       | The demo accounts, the two feed posts the app ships with and their comments, and the market listings.              |
| Tests                | `supabase/tests/`, `scripts/`                          | Database behaviour tests and Edge Function tests, run in CI on every push.                                         |

### How comments work

- **Posting:** the app inserts the comment (it starts `pending`), then calls `moderate-content`. The function sets it to `approved` or `held` using the service role, which is the only way those fields can change.
- **Who sees what:** everyone sees approved comments on approved posts. An author also sees their own `pending` or `held` comment, labelled as such in the app. Nobody else does.
- **Replies:** a reply points at a top-level comment on the same post. Replying to a reply joins the same thread, so threads stay one level deep.
- **Deleting:** only your own, through `delete_own_comment`. It is a soft delete; replies stay under a "removed" placeholder.
- **Reporting:** only other people's comments, once each. Three reports hold an approved comment for review automatically.
- **Limits:** 1 to 280 characters (trimmed), at most 10 comments a minute per account.
- **Fail-closed moderation:** with no provider configured, comments are held for review. If the provider is temporarily down, the comment stays pending and the call can be retried.

### How chats work

- **Starting:** `start_conversation(listing_slug)` opens the caller's conversation with the listing's seller, or returns the one they already have. One conversation per buyer and listing; nobody can message themselves.
- **Who sees what:** only the buyer and the seller see a conversation or its messages. Realtime applies the same rule, so new messages and answers stream only to those two.
- **Messages:** text (1 to 1,000 characters, trimmed), a price offer with an optional note, or a proposed pickup (where and when). The device picks each message's id, so a resend after a dropped connection lands once.
- **Offers and pickups:** a new offer from either side counters the one still open. Only the other person can answer, through `respond_to_offer` and `confirm_meetup`; a client can never write a status directly.
- **Reading:** `mark_conversation_read`; `conversation_list()` counts what the caller hasn't read.
- **Closing:** once a listing sells, its conversations are read-only and list under Past.
- **Safety:** `set_block` stops messages both ways in every conversation between two people; the blocked person can't see who blocked them. Either person can report a conversation, once. Private messages are not put through moderation.
- **Limits:** at most 30 messages a minute per account.

The client's errors map from the database's codes: `SWCLO` (closed), `SWBLK` (blocked) and `SWOLD` (offer no longer open).

## Setting up a Supabase project

You need the [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase` works) and a project from [supabase.com](https://supabase.com).

1. **Link and migrate** (from `Backend/`):

   ```sh
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --include-seed   # leave out --include-seed for production
   ```

2. **Allow anonymous sign-ins** (Dashboard → Authentication → Sign In / Providers → Anonymous). Until email sign-in is wired into the app, each device comments under its own anonymous account with a generated handle.

3. **Deploy moderation** and choose its provider:

   ```sh
   npx supabase functions deploy moderate-content
   npx supabase secrets set MODERATION_PROVIDER=openai OPENAI_API_KEY=<key>
   # or, for development only:
   npx supabase secrets set MODERATION_PROVIDER=rules
   ```

4. **Point the apps at the project:** copy `Frontend/web/.env.example` to `Frontend/web/.env.local` (and the same for `Frontend/mobile/`) and fill in the project URL and **anon** key from Dashboard → Project Settings → API. Never put the service-role key in an app. Expo loads `.env.local` on `expo start`. Restart the dev server after changing these values.

Without step 4 the apps still work: comments are kept on the device, under the same rules, so the UI can be built and tested before a project exists.

## Camera price estimation

`supabase/functions/estimate-price/` implements the camera-only Gemini prototype. It validates
the caller's Supabase session, accepts a JPEG/PNG/WebP up to 4 MiB, sends image bytes to Gemini,
and validates a PHP estimate/range/explanation or an explicit unable-to-estimate result. The
key is never sent to the app. There is no upload to permanent Storage or saved scan History yet.

The function uses the existing `AI_PROVIDER=gemini` and `AI_API_KEY` Edge Function secrets.
`AI_MODEL` optionally overrides the default `gemini-3.6-flash`; use a model available on your
free tier. There is no automatic model or paid fallback. Rate limits return an explicit retry
error. The prototype also has a per-instance guard of two requests/minute and ten/day per
user; this is not a durable project-wide quota across multiple Edge instances. Before a public
launch, add a shared persistent quota and abuse controls for anonymous signups.

The default uses medium reasoning, a 4,096-token budget shared by reasoning and output,
a concise explanation, and up to three assumptions. Other model overrides use low reasoning.
`AI_THINKING_LEVEL` optionally overrides reasoning (`minimal`, `low`, `medium`, `high`); choose a
level supported by the selected model (3.8 Flash does not support minimal). Keep these settings
on the server. The prompt checks identification, visible condition and completeness, and asks
for missing details when necessary rather than inventing an exact model or functionality.
The user's selected deployment configuration is `AI_MODEL=gemini-3.6-flash` and
`AI_THINKING_LEVEL=medium`. There is no automatic model fallback. Timing varies, and the
free-tier quota can block estimates until its applicable limit resets. The five-photo
[3.6 comparison](../docs/benchmarks/gemini-3.6-comparison.md) records provider errors and
timings for low and medium reasoning. These tests do not establish pricing accuracy.

Enable Anonymous Sign-Ins in the project's Authentication settings. This is a backend session
for the camera; the existing app login screen remains visible and is still a demo UI session.

After signing into the Supabase CLI with `supabase login`, deploy from `Backend/`:

```sh
supabase functions deploy estimate-price --project-ref ofnkthxiexmbmyhjevbm --use-api
```

The function intentionally disables gateway JWT verification because it validates the bearer
token itself with Supabase Auth. It rejects unauthenticated callers before any Gemini call.
Never remove the function's session validation.

Run isolated handler tests from the repository root:

```sh
node --experimental-strip-types --test Backend/supabase/functions/estimate-price/pricing_test.mjs
```

For one real Gemini call using a non-sensitive repository image, fill in the ignored
`Backend/supabase/.env.local`, then run:

```sh
node --experimental-strip-types Backend/scripts/check-pricing.mjs
```

This smoke test exercises pricing logic and the Gemini API; it does not test deployed
Supabase authentication. Actual private photos should not be used in development because
Google's unpaid API terms permit product-improvement use of inputs and outputs.

## Running the tests

```sh
Backend/scripts/test-db.sh         # migrations, RLS, seed: a throwaway local Postgres, no Docker
Backend/scripts/test-functions.sh  # Edge Function typecheck and unit tests (needs Deno)
```

`test-db.sh` needs Postgres 15+ server binaries (`initdb`, `pg_ctl`, `psql`). It applies a small stand-in for Supabase's `auth` schema and roles (`supabase/tests/support/supabase_stub.sql`), then the migrations, the seed, and every `*_test.sql`, acting as anonymous visitors, different signed-in users, and the server.

## Directory map

```text
Backend/
├── README.md
├── scripts/
│   ├── test-db.sh
│   └── test-functions.sh
└── supabase/
    ├── config.toml
    ├── migrations/
    ├── seed/
    ├── tests/
    │   └── support/
    └── functions/
        ├── _shared/providers/
        ├── estimate-price/        (planned)
        └── moderate-content/
```
