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

\echo 'All admin review tests passed.'
