-- Expose each commenter's account name (`profiles.display_name`) in `comment_thread`, so
-- comments show the account name instead of the generated `user_<hex>` fallback handle.
drop function if exists public.comment_thread(text);

create function public.comment_thread(post_slug text)
returns table (
  id uuid,
  parent_id uuid,
  parent_hidden boolean,
  body text,
  moderation_status public.moderation_status,
  created_at timestamptz,
  author_id uuid,
  author_handle text,
  author_display_name text,
  author_avatar_url text,
  is_mine boolean,
  reported_by_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.parent_id,
    c.parent_id is not null
      and not exists (select 1 from public.comments v where v.id = c.parent_id) as parent_hidden,
    c.body,
    c.moderation_status,
    c.created_at,
    c.author_id,
    pr.handle,
    pr.display_name,
    pr.avatar_url,
    c.author_id = (select auth.uid()) as is_mine,
    exists (
      select 1
        from public.comment_reports r
       where r.comment_id = c.id
         and r.reporter_id = (select auth.uid())
    ) as reported_by_me
  from public.comments c
  join public.feed_posts p on p.id = c.post_id
  join public.profiles pr on pr.id = c.author_id
  where p.slug = post_slug or p.id::text = post_slug
  order by c.created_at desc;
$$;

grant execute on function public.comment_thread(text) to anon, authenticated;
