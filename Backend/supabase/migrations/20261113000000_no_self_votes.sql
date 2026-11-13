-- Prevent post authors from voting on their own feed posts (they can still comment).

drop policy "Signed-in users cast votes as themselves on visible posts" on public.votes;
create policy "Signed-in users cast votes as themselves on visible posts"
  on public.votes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.feed_posts p
       where p.id = post_id
         and p.moderation_status = 'approved'
         and p.owner_id <> (select auth.uid())
    )
  );

drop policy "Voters change their own votes" on public.votes;
create policy "Voters change their own votes"
  on public.votes for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.feed_posts p
       where p.id = post_id
         and p.moderation_status = 'approved'
         and p.owner_id <> (select auth.uid())
    )
  );
