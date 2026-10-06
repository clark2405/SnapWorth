# SnapWorth Backend

`Backend/` is the single shared backend for SnapWorth's web, Android and iOS apps: Supabase Auth, PostgreSQL with Row Level Security (RLS), Storage, Realtime, and Edge Functions. Provider secrets (AI moderation and pricing keys) stay here, server-side, and never ship in an app.

## What is built

| Area               | Where                                              | What it does                                                                                                         |
| ------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Feed discussion    | `supabase/migrations/20261005000000_feed_comments.sql` | Profiles, feed posts, comments with one level of replies, reports, and the RLS policies that decide who sees what. |
| Moderation         | `supabase/functions/moderate-content/`              | Screens each new comment and approves or holds it. Fail-closed: nothing is public until it has been screened.       |
| Moderation providers | `supabase/functions/_shared/providers/moderation.ts` | `openai` (OpenAI's free moderation endpoint) for real use; `rules` (a fixed word list) for local development.     |
| Development data   | `supabase/seed/01_feed_preview.sql`                 | The demo accounts, the two feed posts the app ships with, and their comments.                                         |
| Tests              | `supabase/tests/`, `scripts/`                       | Database behaviour tests and Edge Function tests, run in CI on every push.                                           |

### How comments work

- **Posting:** the app inserts the comment (it starts `pending`), then calls `moderate-content`. The function sets it to `approved` or `held` using the service role, which is the only way those fields can change.
- **Who sees what:** everyone sees approved comments on approved posts. An author also sees their own `pending` or `held` comment, labelled as such in the app. Nobody else does.
- **Replies:** a reply points at a top-level comment on the same post. Replying to a reply joins the same thread, so threads stay one level deep.
- **Deleting:** only your own, through `delete_own_comment`. It is a soft delete; replies stay under a "removed" placeholder.
- **Reporting:** only other people's comments, once each. Three reports hold an approved comment for review automatically.
- **Limits:** 1 to 280 characters (trimmed), at most 10 comments a minute per account.
- **Fail-closed moderation:** with no provider configured, comments are held for review. If the provider is temporarily down, the comment stays pending and the call can be retried.

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

4. **Point the apps at the project:** copy `Frontend/web/.env.example` to `Frontend/web/.env` (and the same for `Frontend/mobile/`) and fill in the project URL and **anon** key from Dashboard → Project Settings → API. Never put the service-role key in an app.

Without step 4 the apps still work: comments are kept on the device, under the same rules, so the UI can be built and tested before a project exists.

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
