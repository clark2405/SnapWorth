-- Other people's profiles can show the collections their owner chose to show.
--
-- Collections stay private by default. Turning on `shown_on_profile` shows that collection on the
-- owner's profile: its name, how many things are in it, what they're worth together, and the
-- first few things' names. Nothing else of the scans behind it is shown (their photos, notes and
-- what was paid stay the owner's), so this goes through one function rather than opening the
-- tables up.

alter table public.collections
  add column shown_on_profile boolean not null default false;

comment on column public.collections.shown_on_profile is
  'Whether the owner shows this collection on their profile. Off unless they turn it on.';

grant update (shown_on_profile) on public.collections to authenticated;

create function public.profile_collections(target uuid)
returns table (
  id uuid,
  name text,
  item_count integer,
  total_php bigint,
  item_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.name,
    count(s.id)::integer as item_count,
    coalesce(sum(s.amount_php), 0)::bigint as total_php,
    coalesce(
      (array_agg(s.item_name order by i.added_at desc) filter (where s.id is not null))[1:4],
      '{}'
    ) as item_names
  from public.collections c
  left join public.collection_items i on i.collection_id = c.id
  left join public.scan_history s on s.id = i.scan_id and s.user_id = c.user_id
  where c.user_id = target
    and c.shown_on_profile
  group by c.id, c.name, c.created_at
  order by c.created_at;
$$;

comment on function public.profile_collections(uuid) is
  'The collections a person shows on their profile: names, counts and totals only.';

revoke all on function public.profile_collections(uuid) from public;
grant execute on function public.profile_collections(uuid) to anon, authenticated;
