-- Behaviour tests for the admin review queue: only an admin can read it or act on it, each
-- decision is recorded with who made it, reports close with a decision and reopen with a new one,
-- and signed-out visitors and ordinary accounts are refused at the database. Run with
-- Backend/scripts/test-db.sh (local Postgres + auth stub). Each check raises on failure.

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema review_tests;
grant usage on schema review_tests to anon, authenticated, service_role;

create function review_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function review_tests.check_rejected(statement text, codes text[], description text)
returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = any (codes) then
      raise notice 'ok - % (rejected: %)', description, sqlerrm;
      return;
    end if;
    raise exception 'FAIL: % (wrong error % %)', description, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % (was allowed)', description;
end;
$$;

grant execute on all functions in schema review_tests to anon, authenticated, service_role;

-- Ada is the admin. Bo writes the content that gets reviewed, Fay owns the post and the listing.
-- Cy, Dee, Eli and Gus report.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a200-00000000000a', 'ada@test', '{"handle":"ada_review"}'),
  ('00000000-0000-4000-a200-00000000000b', 'bo@test', '{"handle":"bo_review"}'),
  ('00000000-0000-4000-a200-00000000000c', 'cy@test', '{"handle":"cy_review"}'),
  ('00000000-0000-4000-a200-00000000000d', 'dee@test', '{"handle":"dee_review"}'),
  ('00000000-0000-4000-a200-00000000000e', 'eli@test', '{"handle":"eli_review"}'),
  ('00000000-0000-4000-a200-00000000000f', 'fay@test', '{"handle":"fay_review"}'),
  ('00000000-0000-4000-a200-000000000010', 'gus@test', '{"handle":"gus_review"}');
insert into public.admins (user_id) values ('00000000-0000-4000-a200-00000000000a');

-- The host post (public), and a second one moderation held.
insert into public.feed_posts (id, slug, owner_id, body, estimate_php, moderation_status) values
  ('00000000-0000-4000-a210-000000000001', 'review-host', '00000000-0000-4000-a200-00000000000f',
   'Is 1,200 fair for this jacket?', 1200, 'approved'),
  ('00000000-0000-4000-a210-000000000002', 'review-held-post', '00000000-0000-4000-a200-00000000000f',
   'DM me for a cheaper price outside the app.', 900, 'held');

-- Bo's comments: held, approved with reports coming, approved and fine, stale pending, new pending,
-- and one that three reports will hold.
insert into public.comments (id, post_id, author_id, body, moderation_status, moderation_ref,
                             moderated_at, created_at) values
  ('00000000-0000-4000-a220-000000000001', '00000000-0000-4000-a210-000000000001',
   '00000000-0000-4000-a200-00000000000b', 'This is a scam, do not buy.', 'held',
   'rules (scam accusation)', now() - interval '3 hours', now() - interval '4 hours'),
  ('00000000-0000-4000-a220-000000000002', '00000000-0000-4000-a210-000000000001',
   '00000000-0000-4000-a200-00000000000b', 'You are all idiots.', 'approved', 'rules',
   now() - interval '2 hours', now() - interval '2 hours'),
  ('00000000-0000-4000-a220-000000000003', '00000000-0000-4000-a210-000000000001',
   '00000000-0000-4000-a200-00000000000b', 'Looks fair to me.', 'approved', 'rules',
   now() - interval '2 hours', now() - interval '2 hours'),
  ('00000000-0000-4000-a220-000000000004', '00000000-0000-4000-a210-000000000001',
   '00000000-0000-4000-a200-00000000000b', 'Stuck waiting for moderation.', 'pending', null,
   null, now() - interval '1 hour'),
  ('00000000-0000-4000-a220-000000000005', '00000000-0000-4000-a210-000000000001',
   '00000000-0000-4000-a200-00000000000b', 'Brand new, still being screened.', 'pending', null,
   null, now()),
  ('00000000-0000-4000-a220-000000000006', '00000000-0000-4000-a210-000000000001',
   '00000000-0000-4000-a200-00000000000b', 'Spammy but approved.', 'approved', 'rules',
   now() - interval '2 hours', now() - interval '2 hours');

insert into public.hanap_posts (id, author_id, body, moderation_status, moderation_ref) values
  ('00000000-0000-4000-a230-000000000001', '00000000-0000-4000-a200-00000000000b',
   'Looking for a console, text me on Viber', 'held', 'rules (off-platform contact)');

-- A conversation about Fay's listing that Cy reported.
insert into public.listings (id, slug, seller_id, title, asking_php) values
  ('00000000-0000-4000-a240-000000000001', 'review-lamp', '00000000-0000-4000-a200-00000000000f',
   'Brass lamp', 1500);
insert into public.conversations (id, listing_id, buyer_id, seller_id) values
  ('00000000-0000-4000-a250-000000000001', '00000000-0000-4000-a240-000000000001',
   '00000000-0000-4000-a200-00000000000c', '00000000-0000-4000-a200-00000000000f');
insert into public.conversation_members (conversation_id, user_id) values
  ('00000000-0000-4000-a250-000000000001', '00000000-0000-4000-a200-00000000000c'),
  ('00000000-0000-4000-a250-000000000001', '00000000-0000-4000-a200-00000000000f');
insert into public.conversation_reports (conversation_id, reporter_id, reason) values
  ('00000000-0000-4000-a250-000000000001', '00000000-0000-4000-a200-00000000000c', 'scam');

-- Two people report the comment that was approved; the queue picks it up.
insert into public.comment_reports (comment_id, reporter_id, reason) values
  ('00000000-0000-4000-a220-000000000002', '00000000-0000-4000-a200-00000000000c', 'harassment'),
  ('00000000-0000-4000-a220-000000000002', '00000000-0000-4000-a200-00000000000d', 'spam');

-- 1. Signed out, there is nothing to read and nothing to do.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select review_tests.check_rejected(
  $$select * from public.admin_review_queue()$$,
  array['42501'],
  'signed-out visitors cannot read the review queue'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000001', 'approve')$$,
  array['42501'],
  'signed-out visitors cannot approve held content'
);
select review_tests.check_rejected(
  $$select count(*) from public.moderation_log$$,
  array['42501'],
  'signed-out visitors cannot read the decision log'
);
select review_tests.check_rejected(
  $$select public.review_cutoff('comment', '00000000-0000-4000-a220-000000000001')$$,
  array['42501'],
  'the report cutoff is not something a visitor can call'
);
reset role;

-- A role of `authenticated` with no user behind it is no better.
set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
select review_tests.check_rejected(
  $$select * from public.admin_review_queue()$$,
  array['42501'],
  'a session with no user cannot read the review queue'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000001', 'approve')$$,
  array['42501'],
  'nor act on it'
);
reset role;

-- 2. An ordinary account is refused too, including the author of the held content.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000c', false);
select review_tests.check_rejected(
  $$select * from public.admin_review_queue()$$,
  array['42501'],
  'an ordinary account cannot read the review queue'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000002', 'remove')$$,
  array['42501'],
  'an ordinary account cannot remove content'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('conversation', '00000000-0000-4000-a250-000000000001', 'dismiss')$$,
  array['42501'],
  'a reporter cannot dismiss reports, even their own'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000b', false);
select review_tests.check_rejected(
  $$select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000001', 'approve')$$,
  array['42501'],
  'an author cannot approve their own held comment'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('hanap', '00000000-0000-4000-a230-000000000001', 'approve')$$,
  array['42501'],
  'an author cannot approve their own held hanap'
);
select review_tests.check_rejected(
  $$update public.hanap_posts set moderation_status = 'approved'
     where id = '00000000-0000-4000-a230-000000000001'$$,
  array['42501'],
  'nor can they change the status directly'
);
select review_tests.check_rejected(
  $$select count(*) from public.moderation_log$$,
  array['42501'],
  'an ordinary account cannot read the decision log'
);
select review_tests.check_rejected(
  $$insert into public.moderation_log (kind, target_id, decision, decided_by)
    values ('comment', '00000000-0000-4000-a220-000000000001', 'approve',
            '00000000-0000-4000-a200-00000000000b')$$,
  array['42501'],
  'an ordinary account cannot write the decision log'
);
reset role;

select review_tests.check(
  (select moderation_status from public.comments
    where id = '00000000-0000-4000-a220-000000000001') = 'held'
  and (select moderation_status from public.hanap_posts
        where id = '00000000-0000-4000-a230-000000000001') = 'held',
  'none of those refused attempts changed anything'
);

-- 3. The admin sees what needs a look, most reported first, and nothing else.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select review_tests.check(
  (select count(*) from public.admin_review_queue()) = 6,
  'the queue holds the held comment, the reported one, the stale pending one, the held post, '
  'the held hanap and the reported conversation'
);
select review_tests.check(
  (select array_agg(kind || ':' || target_id::text order by ordinality)
     from public.admin_review_queue() with ordinality)[1:2]
  = array['comment:00000000-0000-4000-a220-000000000002',
          'conversation:00000000-0000-4000-a250-000000000001'],
  'the most reported come first'
);
select review_tests.check(
  not exists (
    select 1 from public.admin_review_queue()
     where target_id in ('00000000-0000-4000-a220-000000000003',
                         '00000000-0000-4000-a220-000000000005',
                         '00000000-0000-4000-a220-000000000006')
  ),
  'approved content nobody reported, and content still being screened, stay out'
);
select review_tests.check(
  (select report_count from public.admin_review_queue()
    where target_id = '00000000-0000-4000-a220-000000000002') = 2
  and (select report_reasons from public.admin_review_queue()
        where target_id = '00000000-0000-4000-a220-000000000002') = array['harassment', 'spam'],
  'a reported comment shows how many reports it has and why'
);
select review_tests.check(
  (select author_handle || '|' || flag_ref || '|' || status from public.admin_review_queue()
    where target_id = '00000000-0000-4000-a220-000000000001')
  = 'bo_review|rules (scam accusation)|held',
  'a held comment shows its author, why it was held and its status'
);
select review_tests.check(
  (select author_handle || '|' || context from public.admin_review_queue()
    where kind = 'conversation')
  = 'fay_review|About "Brass lamp", reported by @cy_review',
  'a reported conversation shows who it is about, but not what was said'
);
select review_tests.check(
  (select body from public.admin_review_queue() where kind = 'conversation') = '',
  'and carries none of its messages'
);

-- 4. Approving makes content public and records who did it.
select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000001', 'approve');
reset role;
select review_tests.check(
  (select moderation_status || '|' || moderation_ref from public.comments
    where id = '00000000-0000-4000-a220-000000000001')
  = 'approved|admin:00000000-0000-4000-a200-00000000000a'
  and (select moderated_at from public.comments
        where id = '00000000-0000-4000-a220-000000000001') > now() - interval '1 minute',
  'approving a comment publishes it, with the admin and the time on it'
);
select review_tests.check(
  (select decision || '|' || decided_by::text || '|' || kind from public.moderation_log
    where target_id = '00000000-0000-4000-a220-000000000001')
  = 'approve|00000000-0000-4000-a200-00000000000a|comment'
  and (select decided_at from public.moderation_log
        where target_id = '00000000-0000-4000-a220-000000000001') > now() - interval '1 minute',
  'the decision is logged with who and when'
);
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select review_tests.check(
  (select count(*) from public.comment_thread('review-host')
    where id = '00000000-0000-4000-a220-000000000001') = 1,
  'the approved comment is now public'
);
reset role;

-- 5. Removing takes content down; its author still sees it, as removed.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select public.admin_review_decide('hanap', '00000000-0000-4000-a230-000000000001', 'remove');
select review_tests.check(
  not exists (select 1 from public.admin_review_queue() where kind = 'hanap'),
  'a removed hanap leaves the queue'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000b', false);
select review_tests.check(
  (select moderation_status from public.hanap_posts
    where id = '00000000-0000-4000-a230-000000000001') = 'removed',
  'its author sees it as removed'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select review_tests.check_rejected(
  $$select public.admin_review_decide('hanap', '00000000-0000-4000-a230-000000000001', 'approve')$$,
  array['P0002'],
  'removed content cannot be brought back through the queue'
);

-- 6. A feed post is approved the same way.
select public.admin_review_decide('post', '00000000-0000-4000-a210-000000000002', 'approve');
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select review_tests.check(
  (select count(*) from public.feed_posts where slug = 'review-held-post') = 1,
  'an approved feed post is public'
);
reset role;

-- 7. Holding hides content but leaves its reports open; approving closes them.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000002', 'hold');
select review_tests.check(
  (select status || '|' || report_count from public.admin_review_queue()
    where target_id = '00000000-0000-4000-a220-000000000002') = 'held|2',
  'a held comment stays in the queue with its reports still open'
);
select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000002', 'approve');
select review_tests.check(
  not exists (
    select 1 from public.admin_review_queue()
     where target_id = '00000000-0000-4000-a220-000000000002'
  ),
  'approving it closes the reports and clears it from the queue'
);

-- 8. A new report after a decision starts a new case; it is not held by the old reports.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000e', false);
insert into public.comment_reports (comment_id, reason)
values ('00000000-0000-4000-a220-000000000002', 'spam');
reset role;
select review_tests.check(
  (select moderation_status from public.comments
    where id = '00000000-0000-4000-a220-000000000002') = 'approved',
  'one new report does not hold a comment an admin approved, though it has three in all'
);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select review_tests.check(
  (select report_count from public.admin_review_queue()
    where target_id = '00000000-0000-4000-a220-000000000002') = 1,
  'it is back in the queue with just the new report'
);
select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000002', 'dismiss');
select review_tests.check(
  not exists (
    select 1 from public.admin_review_queue()
     where target_id = '00000000-0000-4000-a220-000000000002'
  ),
  'dismissing closes the report'
);
reset role;
select review_tests.check(
  (select moderation_status from public.comments
    where id = '00000000-0000-4000-a220-000000000002') = 'approved'
  and (select count(*) from public.moderation_log
        where target_id = '00000000-0000-4000-a220-000000000002') = 3,
  'a dismissal leaves the comment public, and every step of this one is logged'
);

-- 9. Three open reports still hold an approved comment automatically.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000c', false);
insert into public.comment_reports (comment_id, reason)
values ('00000000-0000-4000-a220-000000000006', 'spam');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000d', false);
insert into public.comment_reports (comment_id, reason)
values ('00000000-0000-4000-a220-000000000006', 'spam');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000e', false);
insert into public.comment_reports (comment_id, reason)
values ('00000000-0000-4000-a220-000000000006', 'spam');
reset role;
select review_tests.check(
  (select moderation_status from public.comments
    where id = '00000000-0000-4000-a220-000000000006') = 'held',
  'three open reports hold a comment, as before'
);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000006', 'approve');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-000000000010', false);
insert into public.comment_reports (comment_id, reason)
values ('00000000-0000-4000-a220-000000000006', 'spam');
reset role;
select review_tests.check(
  (select moderation_status from public.comments
    where id = '00000000-0000-4000-a220-000000000006') = 'approved',
  'but a fourth report after an admin approved it does not hold it again'
);

-- 10. A conversation's reports can only be dismissed, and a new report reopens it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select review_tests.check_rejected(
  $$select public.admin_review_decide('conversation', '00000000-0000-4000-a250-000000000001', 'remove')$$,
  array['22023'],
  'a conversation cannot be removed through the queue'
);
select public.admin_review_decide('conversation', '00000000-0000-4000-a250-000000000001', 'dismiss');
select review_tests.check(
  not exists (select 1 from public.admin_review_queue() where kind = 'conversation'),
  'dismissing a conversation''s reports clears it'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('conversation', '00000000-0000-4000-a250-000000000001', 'dismiss')$$,
  array['22023'],
  'there is nothing left to dismiss'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000f', false);
insert into public.conversation_reports (conversation_id, reason)
values ('00000000-0000-4000-a250-000000000001', 'harassment');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select review_tests.check(
  (select author_handle || '|' || report_count from public.admin_review_queue()
    where kind = 'conversation') = 'cy_review|1',
  'a later report from the other side reopens it, about the other person'
);

-- 11. Things that are not cases.
select review_tests.check_rejected(
  $$select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000003', 'dismiss')$$,
  array['22023'],
  'dismissing needs open reports'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000003', 'delete')$$,
  array['22023'],
  'an unknown decision is refused'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('profile', '00000000-0000-4000-a200-00000000000b', 'remove')$$,
  array['22023'],
  'only the listed kinds of content can be reviewed'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('comment', '00000000-0000-4000-a2ff-000000000000', 'remove')$$,
  array['P0002'],
  'a case that does not exist is refused'
);
select public.admin_review_decide('comment', '00000000-0000-4000-a220-000000000004', 'remove');
select review_tests.check(
  not exists (
    select 1 from public.admin_review_queue()
     where target_id = '00000000-0000-4000-a220-000000000004'
  ),
  'content stuck pending can be removed from the queue too'
);
reset role;

-- 12. Listings. Fay sells; Cy is a buyer in a chat about one of her listings; Ada is the admin.
--     Held and stale pending listings are cases, with their title, words, seller and photo.
-- Set up as the database owner, with nobody signed in (a signed-in caller's slugs are generated).
select set_config('request.jwt.claim.sub', '', false);
insert into public.scan_history (id, user_id, item_name, amount_php, low_php, high_php) values
  ('00000000-0000-4000-a270-000000000001', '00000000-0000-4000-a200-00000000000f',
   'Film camera', 2500, 2000, 3000);
insert into storage.objects (bucket_id, name) values
  ('scan-photos', '00000000-0000-4000-a200-00000000000f/00000000-0000-4000-a270-000000000001.jpg');
update public.scan_history
   set photo_path = '00000000-0000-4000-a200-00000000000f/00000000-0000-4000-a270-000000000001.jpg'
 where id = '00000000-0000-4000-a270-000000000001';

insert into public.listings (id, slug, seller_id, scan_id, photo_path, title, description, asking_php,
                             category, condition, area, status, moderation_status, moderation_ref,
                             moderated_at, created_at) values
  -- Held by the word rules, with a photo.
  ('00000000-0000-4000-a260-000000000001', 'review-held-camera',
   '00000000-0000-4000-a200-00000000000f', '00000000-0000-4000-a270-000000000001',
   '00000000-0000-4000-a200-00000000000f/00000000-0000-4000-a270-000000000001.jpg',
   'Film camera', 'Text me on Viber for a cheaper price.', 3200,
   'collectibles', 'like_new', 'cebu-city', 'active', 'held', 'rules (off-platform contact)',
   now() - interval '2 hours', now() - interval '3 hours'),
  -- Pending for an hour: moderation never finished.
  ('00000000-0000-4000-a260-000000000002', 'review-stale-lens', '00000000-0000-4000-a200-00000000000f',
   null, null, 'Spare lens', 'Fits the camera.', 800,
   'electronics', 'good', 'mandaue', 'active', 'pending', null, null, now() - interval '1 hour'),
  -- Pending for a minute, approved, and held but taken down by its seller: none of these are cases.
  ('00000000-0000-4000-a260-000000000003', 'review-new-strap', '00000000-0000-4000-a200-00000000000f',
   null, null, 'Camera strap', '', 300,
   'fashion', 'good', 'cebu-city', 'active', 'pending', null, null, now() - interval '1 minute'),
  ('00000000-0000-4000-a260-000000000004', 'review-fine-tripod', '00000000-0000-4000-a200-00000000000f',
   null, null, 'Tripod', 'Sturdy.', 900,
   'electronics', 'good', 'cebu-city', 'active', 'approved', 'rules', now() - interval '1 day',
   now() - interval '1 day'),
  ('00000000-0000-4000-a260-000000000005', 'review-gone-flash', '00000000-0000-4000-a200-00000000000f',
   null, null, 'Flash unit', 'Gone.', 500,
   'electronics', 'good', 'cebu-city', 'removed', 'held', 'rules', now() - interval '2 hours',
   now() - interval '3 hours'),
  -- A long-listed approved one with a chat about it.
  ('00000000-0000-4000-a260-000000000006', 'review-old-bag', '00000000-0000-4000-a200-00000000000f',
   null, null, 'Camera bag', 'Padded, two pockets.', 1200,
   'fashion', 'good', 'cebu-city', 'active', 'approved', 'rules', now() - interval '2 days',
   now() - interval '2 days');
insert into public.conversations (id, listing_id, buyer_id, seller_id) values
  ('00000000-0000-4000-a250-000000000002', '00000000-0000-4000-a260-000000000006',
   '00000000-0000-4000-a200-00000000000c', '00000000-0000-4000-a200-00000000000f');
insert into public.conversation_members (conversation_id, user_id) values
  ('00000000-0000-4000-a250-000000000002', '00000000-0000-4000-a200-00000000000c'),
  ('00000000-0000-4000-a250-000000000002', '00000000-0000-4000-a200-00000000000f');
insert into public.messages (conversation_id, sender_id, body) values
  ('00000000-0000-4000-a250-000000000002', '00000000-0000-4000-a200-00000000000c',
   'Is the bag still available?');

-- 12a. Nobody but an admin reads or decides them, not even the seller or a buyer in a chat.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select review_tests.check_rejected(
  $$select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000001', 'approve')$$,
  array['42501'],
  'signed-out visitors cannot approve a held listing'
);
select review_tests.check(
  (select count(*) from storage.objects where bucket_id = 'scan-photos'
    and name like '%a270-000000000001.jpg') = 0,
  'and cannot see the photo of a held listing'
);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000f', false);
select review_tests.check_rejected(
  $$select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000001', 'approve')$$,
  array['42501'],
  'a seller cannot approve their own held listing'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000002', 'remove')$$,
  array['42501'],
  'nor remove one'
);
select review_tests.check_rejected(
  $$select * from public.admin_review_queue()$$,
  array['42501'],
  'nor read the queue they would be in'
);
select review_tests.check_rejected(
  $$update public.listings set moderation_status = 'approved'
     where id = '00000000-0000-4000-a260-000000000001'$$,
  array['42501', 'SWIMM'],
  'nor approve it by updating the row'
);
select review_tests.check(
  (select count(*) from storage.objects where bucket_id = 'scan-photos'
    and name like '%a270-000000000001.jpg') = 1,
  'the seller still sees their own photo'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000c', false);
select review_tests.check_rejected(
  $$select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000006', 'remove')$$,
  array['42501'],
  'a buyer in a chat cannot remove the listing'
);
select review_tests.check(
  (select count(*) from storage.objects where bucket_id = 'scan-photos'
    and name like '%a270-000000000001.jpg') = 0,
  'a buyer cannot see the photo of a held listing'
);
select review_tests.check(
  (select count(*) from public.listings
    where id = '00000000-0000-4000-a260-000000000001') = 0,
  'nor the held listing'
);
reset role;
select review_tests.check(
  (select moderation_status from public.listings
    where id = '00000000-0000-4000-a260-000000000001') = 'held'
  and (select status from public.listings
        where id = '00000000-0000-4000-a260-000000000006') = 'active',
  'none of those refused attempts changed anything'
);

-- 12b. The admin sees the two cases, with what they need to judge them.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select review_tests.check(
  (select array_agg(target_id::text order by target_id) from public.admin_review_queue()
    where kind = 'listing')
  = array['00000000-0000-4000-a260-000000000001', '00000000-0000-4000-a260-000000000002'],
  'the queue has the held listing and the stale pending one, and not a new, approved or '
  'seller-removed one'
);
select review_tests.check(
  (select title || '|' || body || '|' || author_handle || '|' || status || '|' || flag_ref
          || '|' || photo_path || '|' || report_count
     from public.admin_review_queue()
    where target_id = '00000000-0000-4000-a260-000000000001')
  = 'Film camera|Text me on Viber for a cheaper price.|fay_review|held|rules (off-platform contact)|'
    '00000000-0000-4000-a200-00000000000f/00000000-0000-4000-a270-000000000001.jpg|0',
  'a held listing shows its title, description, seller, why it was held and its photo'
);
select review_tests.check(
  (select context from public.admin_review_queue()
    where target_id = '00000000-0000-4000-a260-000000000001')
  = 'Asking ₱3,200 · collectibles · like new · cebu city',
  'and what it asks, and where'
);
select review_tests.check(
  (select status || '|' || coalesce(photo_path, 'none') from public.admin_review_queue()
    where target_id = '00000000-0000-4000-a260-000000000002') = 'pending|none',
  'a stale pending listing shows as pending, with no photo when it has none'
);
select review_tests.check(
  (select count(*) from public.admin_review_queue() where photo_path is not null) = 1
  and (select count(*) from public.admin_review_queue()
        where kind in ('comment', 'hanap', 'conversation') and (title is not null or photo_path is not null)) = 0,
  'only listings and posts can carry a photo, and only listings a title'
);
select review_tests.check(
  (select count(*) from storage.objects where bucket_id = 'scan-photos'
    and name like '%a270-000000000001.jpg') = 1,
  'the admin can read the held listing''s photo'
);
select review_tests.check(
  (select count(*) from storage.objects where bucket_id = 'scan-photos') = 1,
  'and that is the only scan photo they can read: the policy is for what waits for review'
);

-- 12c. Approving publishes it, its photo and its chat; the decision is logged.
select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000001', 'approve');
select review_tests.check(
  not exists (select 1 from public.admin_review_queue()
               where target_id = '00000000-0000-4000-a260-000000000001'),
  'an approved listing leaves the queue'
);
reset role;
select review_tests.check(
  (select moderation_status || '|' || moderation_ref || '|' || status from public.listings
    where id = '00000000-0000-4000-a260-000000000001')
  = 'approved|admin:00000000-0000-4000-a200-00000000000a|active'
  and (select count(*) from public.moderation_log
        where kind = 'listing' and decision = 'approve'
          and target_id = '00000000-0000-4000-a260-000000000001'
          and decided_by = '00000000-0000-4000-a200-00000000000a') = 1,
  'approving a listing publishes it, with the admin on it, and logs who and when'
);
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select review_tests.check(
  (select count(*) from public.listings where slug = 'review-held-camera') = 1
  and (select count(*) from storage.objects where bucket_id = 'scan-photos'
        and name like '%a270-000000000001.jpg') = 1,
  'the approved listing and its photo are public');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000d', false);
select review_tests.check(
  public.start_conversation('review-held-camera') is not null,
  'and a buyer can message about it');
reset role;

-- 12d. Holding hides it from buyers, including those in a chat about it; the seller still sees
--      it. Their words are not screened again while an admin holds it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000006', 'hold');
select review_tests.check(
  (select status || '|' || title from public.admin_review_queue()
    where target_id = '00000000-0000-4000-a260-000000000006') = 'held|Camera bag',
  'a held listing is in the queue'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000c', false);
select review_tests.check(
  (select count(*) from public.listings where id = '00000000-0000-4000-a260-000000000006') = 0
  and (select count(*) from public.conversation_list()
        where id = '00000000-0000-4000-a250-000000000002') = 0,
  'a buyer in a chat no longer sees the held listing, and the chat leaves their list'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000f', false);
select review_tests.check(
  (select moderation_status || '|' || status from public.listings
    where id = '00000000-0000-4000-a260-000000000006') = 'held|active',
  'the seller sees their own listing, marked held'
);
update public.listings set title = 'Camera bag, padded'
 where id = '00000000-0000-4000-a260-000000000006';
select review_tests.check(
  (select moderation_status || '|' || moderation_ref from public.listings
    where id = '00000000-0000-4000-a260-000000000006')
  = 'held|admin:00000000-0000-4000-a200-00000000000a',
  'editing a listing an admin held does not send it back for automatic screening'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select review_tests.check(
  (select title from public.admin_review_queue()
    where target_id = '00000000-0000-4000-a260-000000000006') = 'Camera bag, padded',
  'the admin sees the new words'
);
select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000006', 'approve');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000c', false);
select review_tests.check(
  (select count(*) from public.conversation_list()
    where id = '00000000-0000-4000-a250-000000000002') = 1,
  'approving it again brings the buyer''s chat back'
);
reset role;

-- A listing moderation (not an admin) held goes back to be screened when its words change, and
-- one that was approved a long time ago isn't taken for one whose screening got stuck.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000f', false);
update public.listings set title = 'Tripod, carbon'
 where id = '00000000-0000-4000-a260-000000000004';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select review_tests.check(
  not exists (select 1 from public.admin_review_queue()
               where target_id = '00000000-0000-4000-a260-000000000004'),
  'an old approved listing just edited goes back to pending but is not in the queue yet'
);
reset role;
select review_tests.check(
  (select moderation_status from public.listings
    where id = '00000000-0000-4000-a260-000000000004') = 'pending',
  'it is pending, waiting for moderation'
);

-- 12e. Removing takes a listing down for good: its status too, so its chats close.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000006', 'remove');
select review_tests.check(
  not exists (select 1 from public.admin_review_queue()
               where target_id = '00000000-0000-4000-a260-000000000006'),
  'a removed listing leaves the queue'
);
reset role;
select review_tests.check(
  (select moderation_status || '|' || status from public.listings
    where id = '00000000-0000-4000-a260-000000000006') = 'removed|removed'
  and (select count(*) from public.moderation_log
        where kind = 'listing' and decision = 'remove'
          and target_id = '00000000-0000-4000-a260-000000000006') = 1,
  'removing a listing sets its moderation and its status, and is logged'
);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000c', false);
select review_tests.check(
  (select count(*) from public.listings where id = '00000000-0000-4000-a260-000000000006') = 0
  and (select count(*) from public.conversation_list()
        where id = '00000000-0000-4000-a250-000000000002') = 0,
  'the buyer no longer sees the listing or the chat'
);
select review_tests.check_rejected(
  $$insert into public.messages (conversation_id, body)
    values ('00000000-0000-4000-a250-000000000002', 'Hello?')$$,
  array['SWCLO'],
  'and cannot send into it: the chat is closed'
);
select review_tests.check_rejected(
  $$select public.start_conversation('review-old-bag')$$,
  array['P0002'],
  'nor open a new one'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000f', false);
select review_tests.check(
  (select count(*) from public.conversation_list()
    where id = '00000000-0000-4000-a250-000000000002' and closed = 'archived') = 1
  and (select moderation_status || '|' || status from public.listings
        where id = '00000000-0000-4000-a260-000000000006') = 'removed|removed',
  'the seller still sees the listing as removed, and its chat archived'
);
select review_tests.check_rejected(
  $$update public.listings set title = 'Camera bag again'
     where id = '00000000-0000-4000-a260-000000000006'$$,
  array['SWIMM'],
  'but cannot edit it back to life'
);
select review_tests.check_rejected(
  $$update public.listings set status = 'active'
     where id = '00000000-0000-4000-a260-000000000006'$$,
  array['SWIMM'],
  'nor reactivate it'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select review_tests.check_rejected(
  $$select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000006', 'approve')$$,
  array['P0002'],
  'removed listings cannot be brought back through the queue'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000005', 'approve')$$,
  array['P0002'],
  'a listing its seller took down is not a case'
);
select review_tests.check_rejected(
  $$select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000002', 'dismiss')$$,
  array['22023'],
  'a listing has no reports to dismiss'
);
-- Taking the stale pending one down too: the photo of a removed listing is out of reach.
select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000002', 'remove');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000f', false);
delete from public.listings where id = '00000000-0000-4000-a260-000000000006';
reset role;
select review_tests.check(
  not exists (select 1 from public.listings where id = '00000000-0000-4000-a260-000000000006'),
  'a seller can still delete a listing an admin removed'
);

-- Held again, then removed: the photo of a removed listing is no longer the admin's to read.
update public.listings set moderation_status = 'held', moderation_ref = 'rules (test)'
 where id = '00000000-0000-4000-a260-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a200-00000000000a', false);
select review_tests.check(
  (select count(*) from storage.objects where bucket_id = 'scan-photos') = 1,
  'the admin reads the photo of a listing held again'
);
select public.admin_review_decide('listing', '00000000-0000-4000-a260-000000000001', 'remove');
select review_tests.check(
  (select count(*) from storage.objects where bucket_id = 'scan-photos') = 0,
  'but not once it is removed'
);
reset role;

\echo 'All admin review tests passed.'
