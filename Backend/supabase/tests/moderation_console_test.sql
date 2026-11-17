-- The moderation console: suspending and reinstating accounts, finding people, the history and
-- the overview. Only admins may do any of it.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create schema console_tests;
grant usage on schema console_tests to anon, authenticated, service_role;

create function console_tests.check(passed boolean, description text) returns void
language plpgsql as $$
begin
  if not coalesce(passed, false) then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

create function console_tests.check_rejected(statement text, codes text[], description text)
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

create function console_tests.as_user(who uuid) returns void
language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(who::text, ''), false);
$$;

grant execute on all functions in schema console_tests to anon, authenticated, service_role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-c100-00000000000a', 'mod@test', '{"handle":"mod_console"}'),
  ('00000000-0000-4000-c100-00000000000b', 'troll@test', '{"handle":"troll_console"}'),
  ('00000000-0000-4000-c100-00000000000c', 'nice@test', '{"handle":"nice_console"}'),
  ('00000000-0000-4000-c100-00000000000d', 'mod2@test', '{"handle":"mod2_console"}');
insert into public.admins (user_id) values
  ('00000000-0000-4000-c100-00000000000a'),
  ('00000000-0000-4000-c100-00000000000d');

insert into public.feed_posts (id, slug, owner_id, body, moderation_status) values
  ('00000000-0000-4000-c110-000000000001', 'troll-post', '00000000-0000-4000-c100-00000000000b',
   'Buy my stuff, everything else is a scam', 'approved'),
  ('00000000-0000-4000-c110-000000000002', 'nice-post', '00000000-0000-4000-c100-00000000000c',
   'Is 900 fair for this lamp?', 'approved');

-- 1. Nobody but an admin gets anywhere.
set role authenticated;
select console_tests.as_user('00000000-0000-4000-c100-00000000000c');
select console_tests.check_rejected(
  $$select public.admin_suspend_account('00000000-0000-4000-c100-00000000000b', 'spam')$$,
  array['42501'], 'an ordinary account cannot suspend anyone'
);
select console_tests.check_rejected(
  $$select * from public.admin_find_people(null)$$,
  array['42501'], 'nor look people up'
);
select console_tests.check_rejected(
  $$select * from public.admin_moderation_history(10)$$,
  array['42501'], 'nor read the history'
);
select console_tests.check_rejected(
  $$select * from public.admin_overview()$$,
  array['42501'], 'nor see the overview'
);
select console_tests.check_rejected(
  $$select * from public.account_suspensions$$,
  array['42501'], 'and the suspensions table is closed to everyone'
);
reset role;

-- 2. An admin finds the troll, suspends them with their posts taken down.
set role authenticated;
select console_tests.as_user('00000000-0000-4000-c100-00000000000a');
select console_tests.check(
  (select count(*) = 1 from public.admin_find_people('troll')),
  'an admin finds people by handle'
);
select console_tests.check_rejected(
  $$select public.admin_suspend_account('00000000-0000-4000-c100-00000000000a', 'oops')$$,
  array['22023'], 'an admin cannot suspend themself'
);
select console_tests.check_rejected(
  $$select public.admin_suspend_account('00000000-0000-4000-c100-00000000000d', 'oops')$$,
  array['22023'], 'nor another admin'
);
select console_tests.check_rejected(
  $$select public.admin_suspend_account('00000000-0000-4000-c100-00000000000b', '   ')$$,
  array['22023'], 'a suspension needs a reason'
);
select public.admin_suspend_account(
  '00000000-0000-4000-c100-00000000000b', 'Spam and insults', 7, true
);
select console_tests.check(
  (select suspended and suspended_until > now() + interval '6 days'
     from public.admin_find_people('troll')),
  'the troll is suspended for a week'
);
select console_tests.check(
  (select decision = 'suspend' and target_label = '@troll_console'
     from public.admin_moderation_history(1)),
  'the suspension is in the history, with who it was'
);
select console_tests.check(
  (select suspended_accounts = 1 from public.admin_overview()),
  'the overview counts it'
);
reset role;

select console_tests.check(
  (select moderation_status = 'removed' from public.feed_posts
    where id = '00000000-0000-4000-c110-000000000001'),
  'taking down their content removed the troll''s post'
);
select console_tests.check(
  (select moderation_status = 'approved' from public.feed_posts
    where id = '00000000-0000-4000-c110-000000000002'),
  'and nobody else''s'
);

-- 3. The suspended account can't publish anything new.
set role authenticated;
select console_tests.as_user('00000000-0000-4000-c100-00000000000b');
select console_tests.check_rejected(
  $$insert into public.feed_posts (title, body) values ('Again', 'Buy now')$$,
  array['42501'], 'a suspended account cannot post'
);
select console_tests.check_rejected(
  $$insert into public.comments (post_id, body)
    values ('00000000-0000-4000-c110-000000000002', 'scam!!')$$,
  array['42501'], 'nor comment'
);
select console_tests.check_rejected(
  $$insert into public.votes (post_id, choice)
    values ('00000000-0000-4000-c110-000000000002', 'too_high')$$,
  array['42501'], 'nor vote'
);
reset role;

-- 4. Reinstated, they can again; someone never suspended always could.
set role authenticated;
select console_tests.as_user('00000000-0000-4000-c100-00000000000a');
select public.admin_reinstate_account('00000000-0000-4000-c100-00000000000b');
select console_tests.check(
  (select not suspended from public.admin_find_people('troll')),
  'a reinstated account is no longer suspended'
);
select console_tests.check(
  (select decision = 'reinstate' from public.admin_moderation_history(1)),
  'and that is in the history too'
);
select console_tests.as_user('00000000-0000-4000-c100-00000000000b');
insert into public.comments (post_id, body)
  values ('00000000-0000-4000-c110-000000000002', 'Looks fair to me');
select console_tests.check(true, 'a reinstated account can comment again');
reset role;

drop schema console_tests cascade;
delete from public.admins where user_id in (
  '00000000-0000-4000-c100-00000000000a', '00000000-0000-4000-c100-00000000000d'
);
delete from auth.users where id::text like '00000000-0000-4000-c100-%';

\echo 'All moderation console tests passed.'
