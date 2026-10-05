-- Behaviour tests for feed comments: visibility, replies, deletion, reports, and the limits a
-- client cannot get around. Run with Backend/scripts/test-db.sh (local Postgres + auth stub).
-- Each check raises on failure; the script stops at the first failure.

\set ON_ERROR_STOP on
\set QUIET on
-- Only the notices (one per check) and the final summary are printed.
\o /dev/null

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

-- Runs `statement` and passes only if it fails with an error whose SQLSTATE is in `codes`.
create function tests.check_rejected(statement text, codes text[], description text)
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

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Four fresh accounts. Ana and Ben comment, Cy and Dee only report.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-b000-00000000000a', 'ana@test', '{"handle":"ana"}'),
  ('00000000-0000-4000-b000-00000000000b', 'ben@test', '{"handle":"ben"}'),
  ('00000000-0000-4000-b000-00000000000c', 'cy@test', '{"handle":"cy_reports"}'),
  ('00000000-0000-4000-b000-00000000000d', 'dee@test', '{}');

select tests.check(
  (select handle from public.profiles where id = '00000000-0000-4000-b000-00000000000a') = 'ana',
  'sign-up creates a profile with the requested handle'
);
select tests.check(
  (select handle from public.profiles where id = '00000000-0000-4000-b000-00000000000d')
    like 'user_%',
  'sign-up without a handle gets a generated one'
);

-- 1. Anyone can read the approved discussion.
set role anon;
select tests.check(
  (select count(*) from public.comment_thread('retro-windbreaker')) = 2,
  'anonymous visitors see the two approved comments on the windbreaker'
);
select tests.check_rejected(
  $$insert into public.comments (post_id, body)
    values ('00000000-0000-4000-9000-000000000001', 'hi')$$,
  array['42501'],
  'anonymous visitors cannot comment'
);
reset role;

-- 2. Ana comments; it is pending, visible only to her.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-b000-00000000000a', false);
insert into public.comments (id, post_id, body)
values ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-9000-000000000001',
        '  Looks fair to me, the zip is in great shape.  ');
select tests.check(
  (select moderation_status from public.comments
    where id = '00000000-0000-4000-c000-000000000001') = 'pending',
  'a new comment starts pending moderation'
);
select tests.check(
  (select body from public.comments where id = '00000000-0000-4000-c000-000000000001')
    = 'Looks fair to me, the zip is in great shape.',
  'surrounding whitespace is trimmed from the body'
);
select tests.check(
  (select is_mine from public.comment_thread('retro-windbreaker')
    where id = '00000000-0000-4000-c000-000000000001'),
  'the author sees their own pending comment, marked as theirs'
);

-- 3. Clients cannot get around moderation or impersonate anyone.
select tests.check_rejected(
  $$insert into public.comments (post_id, body, moderation_status)
    values ('00000000-0000-4000-9000-000000000001', 'self-approved', 'approved')$$,
  array['42501'],
  'a client cannot insert a pre-approved comment'
);
select tests.check_rejected(
  $$insert into public.comments (post_id, body, author_id)
    values ('00000000-0000-4000-9000-000000000001', 'as ben',
            '00000000-0000-4000-b000-00000000000b')$$,
  array['42501'],
  'a client cannot comment as someone else'
);
select tests.check_rejected(
  $$update public.comments set body = 'edited'
     where id = '00000000-0000-4000-c000-000000000001'$$,
  array['42501'],
  'a client cannot edit a comment directly'
);
select tests.check_rejected(
  $$insert into public.comments (post_id, body)
    values ('00000000-0000-4000-9000-000000000001', '   ')$$,
  array['23514'],
  'a blank comment is rejected'
);
select tests.check_rejected(
  format(
    $$insert into public.comments (post_id, body)
      values ('00000000-0000-4000-9000-000000000001', %L)$$,
    repeat('x', 281)
  ),
  array['23514'],
  'a comment over 280 characters is rejected'
);

-- 4. Ben cannot see Ana's comment until it is approved, and cannot reply to it either.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-b000-00000000000b', false);
select tests.check(
  not exists (select 1 from public.comment_thread('retro-windbreaker')
               where id = '00000000-0000-4000-c000-000000000001'),
  'other users do not see a pending comment'
);
select tests.check_rejected(
  $$insert into public.comments (post_id, parent_id, body)
    values ('00000000-0000-4000-9000-000000000001',
            '00000000-0000-4000-c000-000000000001', 'reply to pending')$$,
  array['P0002'],
  'nobody can reply to a comment they cannot see'
);
reset role;

-- 5. Moderation (the server) approves it; now it is public.
set role service_role;
update public.comments
   set moderation_status = 'approved', moderation_ref = 'test', moderated_at = now()
 where id = '00000000-0000-4000-c000-000000000001';
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-b000-00000000000b', false);
select tests.check(
  exists (select 1 from public.comment_thread('retro-windbreaker')
           where id = '00000000-0000-4000-c000-000000000001' and not is_mine),
  'an approved comment is visible to other users'
);

-- 6. Replies: Ben replies to Ana; a reply to his reply joins the same thread.
insert into public.comments (id, post_id, parent_id, body)
values ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-9000-000000000001',
        '00000000-0000-4000-c000-000000000001', 'Agreed, it looks barely worn.');
insert into public.comments (id, post_id, parent_id, body)
values ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-9000-000000000001',
        '00000000-0000-4000-c000-000000000002', 'Also check the cuffs.');
select tests.check(
  (select parent_id from public.comments where id = '00000000-0000-4000-c000-000000000002')
    = '00000000-0000-4000-c000-000000000001',
  'a reply points at the comment it answers'
);
select tests.check(
  (select parent_id from public.comments where id = '00000000-0000-4000-c000-000000000003')
    = '00000000-0000-4000-c000-000000000001',
  'a reply to a reply joins the top-level thread (one level deep)'
);
select tests.check_rejected(
  $$insert into public.comments (post_id, parent_id, body)
    values ('00000000-0000-4000-9000-000000000002',
            '00000000-0000-4000-c000-000000000001', 'wrong post')$$,
  array['22023'],
  'a reply must be on the same post as its parent'
);

-- 7. Deleting: only your own; replies survive under a placeholder.
select tests.check(
  not public.delete_own_comment('00000000-0000-4000-c000-000000000001'),
  'nobody can delete someone else''s comment'
);
reset role;

set role service_role;
update public.comments set moderation_status = 'approved'
 where id in ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-c000-000000000003');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-b000-00000000000a', false);
select tests.check(
  public.delete_own_comment('00000000-0000-4000-c000-000000000001'),
  'the author can delete their own comment'
);
select tests.check(
  not exists (select 1 from public.comments where id = '00000000-0000-4000-c000-000000000001'),
  'a deleted comment is hidden, even from its author'
);
select tests.check(
  (select bool_and(parent_hidden) from public.comment_thread('retro-windbreaker')
    where parent_id = '00000000-0000-4000-c000-000000000001'),
  'replies to a deleted comment remain, flagged as orphaned'
);

-- 8. Reports: others only, once each; three reports hold a comment.
select tests.check_rejected(
  $$insert into public.comment_reports (comment_id, reason)
    values ('00000000-0000-4000-c000-000000000001', 'spam')$$,
  array['42501'],
  'nobody can report their own comment'
);
insert into public.comment_reports (comment_id, reason)
values ('00000000-0000-4000-c000-000000000002', 'spam');
select tests.check(
  (select reported_by_me from public.comment_thread('retro-windbreaker')
    where id = '00000000-0000-4000-c000-000000000002'),
  'the thread remembers what the caller has reported'
);
select tests.check_rejected(
  $$insert into public.comment_reports (comment_id, reason)
    values ('00000000-0000-4000-c000-000000000002', 'spam')$$,
  array['23505'],
  'the same person cannot report a comment twice'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-b000-00000000000c', false);
insert into public.comment_reports (comment_id) values ('00000000-0000-4000-c000-000000000002');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-b000-00000000000d', false);
insert into public.comment_reports (comment_id) values ('00000000-0000-4000-c000-000000000002');
reset role;
select tests.check(
  (select moderation_status from public.comments
    where id = '00000000-0000-4000-c000-000000000002') = 'held',
  'three reports hold a comment for review'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-b000-00000000000d', false);
select tests.check(
  not exists (select 1 from public.comment_thread('retro-windbreaker')
               where id = '00000000-0000-4000-c000-000000000002'),
  'a held comment disappears for everyone else'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-b000-00000000000b', false);
select tests.check(
  (select moderation_status from public.comment_thread('retro-windbreaker')
    where id = '00000000-0000-4000-c000-000000000002') = 'held',
  'its author still sees it, marked held'
);

-- 9. Flood limit: ten comments a minute.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-b000-00000000000d', false);
insert into public.comments (post_id, body)
select '00000000-0000-4000-9000-000000000002', 'flood ' || n from generate_series(1, 10) n;
select tests.check_rejected(
  $$insert into public.comments (post_id, body)
    values ('00000000-0000-4000-9000-000000000002', 'one too many')$$,
  array['P0001'],
  'an eleventh comment within a minute is refused'
);
reset role;

\echo 'All comment tests passed.'
