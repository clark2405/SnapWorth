-- Suki: a seller's regular. A seller marks a buyer they've chatted with as their suki and gives
-- them a standing discount, which both of them see in their chats and the buyer's offers start
-- from. Only the seller sets it, and only the two of them can see it.

create table public.suki_discounts (
  seller_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  discount_pct integer not null check (discount_pct between 1 and 50),
  updated_at timestamptz not null default now(),
  primary key (seller_id, buyer_id),
  constraint suki_two_people check (seller_id <> buyer_id)
);

comment on table public.suki_discounts is
  'A seller''s standing discount for a regular buyer. Seen only by the two of them.';

create index suki_discounts_buyer on public.suki_discounts (buyer_id);

create function public.touch_suki_discount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger suki_discounts_touch
  before update on public.suki_discounts
  for each row execute function public.touch_suki_discount();

alter table public.suki_discounts enable row level security;

create policy "Sellers and their suki see the discount"
  on public.suki_discounts for select
  to authenticated
  using (seller_id = (select auth.uid()) or buyer_id = (select auth.uid()));

-- Only someone who has sold to, or been asked by, this buyer in a chat can make them a suki.
create policy "Sellers make a buyer they've chatted with their suki"
  on public.suki_discounts for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and exists (
      select 1
        from public.conversations c
       where c.seller_id = (select auth.uid())
         and c.buyer_id = suki_discounts.buyer_id
    )
  );

create policy "Sellers change their suki discount"
  on public.suki_discounts for update
  to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy "Sellers end a suki"
  on public.suki_discounts for delete
  to authenticated
  using (seller_id = (select auth.uid()));

-- Column-level grants back the policies up: the seller is always the caller.
revoke all on public.suki_discounts from anon, authenticated;
grant select on public.suki_discounts to authenticated;
grant insert (buyer_id, discount_pct) on public.suki_discounts to authenticated;
grant update (discount_pct) on public.suki_discounts to authenticated;
grant delete on public.suki_discounts to authenticated;
