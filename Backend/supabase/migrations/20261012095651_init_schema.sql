-- ==============================================================================
-- SnapWorth Initial Schema Migration
-- Migration: 20261012091725_init_schema.sql
-- Description: Core tables, security functions, RLS policies, storage bucket,
--              and performance indexes for SnapWorth.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. HELPER FUNCTIONS

-- Function to safely check if the current user is an administrator via app_metadata
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'administrator',
    false
  );
$$;

-- Trigger function to automatically update `updated_at` column
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 3. CORE TABLES
-- ==============================================================================

-- PROFILES: linked to auth.users for user-visible profile & onboarding state
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile trigger when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    coalesce(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1),
      'User'
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating `updated_at` on profiles
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ITEMS: Private captured items and History source
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_path text NOT NULL,
  photo_version text NOT NULL DEFAULT '1',
  photo_alt text NOT NULL DEFAULT '',
  photo_width integer NOT NULL,
  photo_height integer NOT NULL,
  photo_mime_type text NOT NULL CHECK (photo_mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  title text,
  category text CHECK (category IN (
    'antiques', 'art', 'collectibles', 'electronics', 'fashion',
    'furniture', 'home', 'jewelry', 'other', 'sports', 'toys'
  )),
  storage_status text NOT NULL DEFAULT 'uploading' CHECK (storage_status IN ('uploading', 'stored', 'failed')),
  estimation_status text NOT NULL DEFAULT 'estimating' CHECK (estimation_status IN ('estimating', 'estimated', 'failed', 'queued_offline')),
  current_attempt integer NOT NULL DEFAULT 1 CHECK (current_attempt >= 1),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS items_set_updated_at ON public.items;
CREATE TRIGGER items_set_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ESTIMATE_ATTEMPTS: Idempotent history of AI pricing estimation attempts
CREATE TABLE IF NOT EXISTS public.estimate_attempts (
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL CHECK (attempt_no >= 1),
  status text NOT NULL CHECK (status IN ('estimating', 'estimated', 'failed', 'queued_offline')),
  amount_cents bigint CHECK (amount_cents IS NULL OR amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  lower_confidence_cents bigint CHECK (lower_confidence_cents IS NULL OR lower_confidence_cents >= 0),
  upper_confidence_cents bigint CHECK (upper_confidence_cents IS NULL OR upper_confidence_cents >= 0),
  provider_ref text,
  failure_code text CHECK (failure_code IS NULL OR failure_code IN (
    'timeout', 'rate_limited', 'provider_unavailable', 'invalid_response', 'offline', 'unknown'
  )),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (item_id, attempt_no)
);


-- FEED_POSTS: Public feed projection for community estimation feedback
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'held', 'removed')),
  publication_status text NOT NULL DEFAULT 'published' CHECK (publication_status IN ('published', 'withdrawn')),
  published_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one active (non-withdrawn, non-deleted) post per item
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_feed_post_per_item
  ON public.feed_posts (item_id)
  WHERE publication_status = 'published' AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS feed_posts_set_updated_at ON public.feed_posts;
CREATE TRIGGER feed_posts_set_updated_at
  BEFORE UPDATE ON public.feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- VOTES: One active vote per user per feed post
CREATE TABLE IF NOT EXISTS public.votes (
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice text NOT NULL CHECK (choice IN ('too_high', 'too_low', 'just_right')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, voter_id)
);

DROP TRIGGER IF EXISTS votes_set_updated_at ON public.votes;
CREATE TRIGGER votes_set_updated_at
  BEFORE UPDATE ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- COMMENTS: Moderated comments on feed posts
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 2000),
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'held', 'removed')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS comments_set_updated_at ON public.comments;
CREATE TRIGGER comments_set_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- LISTINGS: Marketplace items confirmed with asking price
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asking_price_cents bigint NOT NULL CHECK (asking_price_cents > 0 AND asking_price_cents <= 99999999999),
  currency text NOT NULL DEFAULT 'USD',
  category text NOT NULL CHECK (category IN (
    'antiques', 'art', 'collectibles', 'electronics', 'fashion',
    'furniture', 'home', 'jewelry', 'other', 'sports', 'toys'
  )),
  region_code text,
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'held', 'removed')),
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'active', 'sold', 'withdrawn')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one active/held listing per item
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_listing_per_item
  ON public.listings (item_id)
  WHERE status IN ('active', 'held');

DROP TRIGGER IF EXISTS listings_set_updated_at ON public.listings;
CREATE TRIGGER listings_set_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- CONVERSATIONS: One-to-one threads scoped to a specific listing
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latest_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_not_seller CHECK (buyer_id <> seller_id),
  CONSTRAINT unique_listing_buyer_seller UNIQUE (listing_id, buyer_id, seller_id)
);


-- MESSAGES: Realtime messages within a conversation
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_message_id text NOT NULL,
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 4000),
  delivery_state text NOT NULL DEFAULT 'delivered' CHECK (delivery_state IN ('pending', 'delivered', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_sender_client_message UNIQUE (sender_id, client_message_id)
);


-- BLOCKS: Bidirectional buyer/seller contact blocks
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocker_not_blocked CHECK (blocker_id <> blocked_id)
);


-- MODERATION_CASES: Queue for held or reported content
CREATE TABLE IF NOT EXISTS public.moderation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('feed_post', 'comment', 'listing')),
  target_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'automated' CHECK (source IN ('automated', 'user_report')),
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved')),
  version integer NOT NULL DEFAULT 1,
  decision text CHECK (decision IS NULL OR decision IN ('approve', 'remove')),
  decided_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS moderation_cases_set_updated_at ON public.moderation_cases;
CREATE TRIGGER moderation_cases_set_updated_at
  BEFORE UPDATE ON public.moderation_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- REPORTS: User submitted flags for public content
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.moderation_cases(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('feed_post', 'comment', 'listing')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'prohibited_item', 'misleading', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_reporter_target UNIQUE (reporter_id, target_type, target_id)
);


-- RATE_LIMIT_EVENTS: Server-side tracking for Edge Functions abuse control
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  hashed_subject text NOT NULL,
  function_name text NOT NULL,
  bucket_timestamp timestamptz NOT NULL,
  event_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (hashed_subject, function_name, bucket_timestamp)
);

-- ==============================================================================
-- 4. PERFORMANCE INDEXES
-- ==============================================================================

-- Items index for History view (excluding deleted items)
CREATE INDEX IF NOT EXISTS idx_items_owner_history
  ON public.items (owner_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Feed posts index for public feed
CREATE INDEX IF NOT EXISTS idx_feed_posts_public
  ON public.feed_posts (moderation_status, publication_status, published_at DESC, id DESC)
  WHERE publication_status = 'published' AND deleted_at IS NULL;

-- Comments index for post detail threads
CREATE INDEX IF NOT EXISTS idx_comments_post_thread
  ON public.comments (post_id, moderation_status, created_at ASC, id ASC)
  WHERE deleted_at IS NULL;

-- Listings index for marketplace browse & filters
CREATE INDEX IF NOT EXISTS idx_listings_marketplace
  ON public.listings (status, moderation_status, published_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_listings_category_price
  ON public.listings (category, asking_price_cents)
  WHERE status = 'active' AND moderation_status = 'approved';

-- Conversations index for inbox lists
CREATE INDEX IF NOT EXISTS idx_conversations_buyer
  ON public.conversations (buyer_id, latest_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_seller
  ON public.conversations (seller_id, latest_message_at DESC);

-- Messages index for thread order and cursor pagination
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages (conversation_id, created_at ASC, id ASC);

-- Moderation queue index
CREATE INDEX IF NOT EXISTS idx_moderation_cases_queue
  ON public.moderation_cases (status, priority DESC, created_at ASC, id ASC);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- ITEMS POLICIES (Strict private ownership)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own items"
  ON public.items FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own items"
  ON public.items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own items"
  ON public.items FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can soft-delete their own items"
  ON public.items FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ------------------------------------------------------------------------------
-- ESTIMATE_ATTEMPTS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view estimate attempts for their own items"
  ON public.estimate_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = estimate_attempts.item_id
        AND items.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert estimate attempts for their own items"
  ON public.estimate_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = estimate_attempts.item_id
        AND items.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- FEED_POSTS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Anyone can view approved published feed posts or own post"
  ON public.feed_posts FOR SELECT
  TO authenticated
  USING (
    (moderation_status = 'approved' AND publication_status = 'published' AND deleted_at IS NULL)
    OR auth.uid() = owner_id
  );

CREATE POLICY "Users can create feed posts for their own items"
  ON public.feed_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = feed_posts.item_id
        AND items.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own feed posts"
  ON public.feed_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ------------------------------------------------------------------------------
-- VOTES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Authenticated users can view votes"
  ON public.votes FOR SELECT
  TO authenticated
  USING (true);

-- Disallow voting on one's own post
CREATE POLICY "Users can vote on others posts"
  ON public.votes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = voter_id
    AND NOT EXISTS (
      SELECT 1 FROM public.feed_posts
      WHERE feed_posts.id = votes.post_id
        AND feed_posts.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can change their own vote"
  ON public.votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = voter_id)
  WITH CHECK (auth.uid() = voter_id);

CREATE POLICY "Users can remove their own vote"
  ON public.votes FOR DELETE
  TO authenticated
  USING (auth.uid() = voter_id);

-- ------------------------------------------------------------------------------
-- COMMENTS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view approved comments or their own comment"
  ON public.comments FOR SELECT
  TO authenticated
  USING (
    (moderation_status = 'approved' AND deleted_at IS NULL)
    OR auth.uid() = author_id
  );

CREATE POLICY "Users can post comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- ------------------------------------------------------------------------------
-- LISTINGS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Anyone can view active approved listings or own listings"
  ON public.listings FOR SELECT
  TO authenticated
  USING (
    (moderation_status = 'approved' AND status = 'active')
    OR auth.uid() = seller_id
  );

CREATE POLICY "Sellers can create listings for their own items"
  ON public.listings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = listings.item_id
        AND items.owner_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update their own listings"
  ON public.listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- ------------------------------------------------------------------------------
-- CONVERSATIONS & MESSAGES POLICIES (Participants only)
-- ------------------------------------------------------------------------------
CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (auth.uid() IN (buyer_id, seller_id));

CREATE POLICY "Buyers can initiate conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = buyer_id
    AND buyer_id <> seller_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = seller_id AND blocked_id = buyer_id)
         OR (blocker_id = buyer_id AND blocked_id = seller_id)
    )
  );

CREATE POLICY "Participants can view conversation messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.buyer_id, conversations.seller_id)
    )
  );

CREATE POLICY "Participants can send messages if not blocked"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() IN (c.buyer_id, c.seller_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_id = c.seller_id AND b.blocked_id = c.buyer_id)
             OR (b.blocker_id = c.buyer_id AND b.blocked_id = c.seller_id)
        )
    )
  );

-- ------------------------------------------------------------------------------
-- BLOCKS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own block list"
  ON public.blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block other users"
  ON public.blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);

CREATE POLICY "Users can unblock users"
  ON public.blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

-- ------------------------------------------------------------------------------
-- MODERATION CASES & REPORTS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Admins can view and manage moderation cases"
  ON public.moderation_cases FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports, admins view all"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- RATE LIMIT EVENTS POLICIES (Server-only / Service role access)
-- ------------------------------------------------------------------------------
-- No client policies created; default deny prevents browser access.

-- ==============================================================================
-- 6. STORAGE BUCKET CONFIGURATION (item-photos)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-photos',
  'item-photos',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS policies for `item-photos`
-- Pattern: {owner_uuid}/{item_uuid}/source.{ext}
CREATE POLICY "Owners can upload item photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'item-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners can read their own item photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'item-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners can delete their own item photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'item-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
