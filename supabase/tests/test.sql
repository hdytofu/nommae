-- ชุดทดสอบสิทธิ์: แม่ A, พ่อ B (เข้าครอบครัว A ด้วยโค้ดเชิญ), แม่ C (อีกครอบครัว) — ทุกบรรทัดต้องขึ้นต้นด้วย PASS
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\set QUIET 1
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000c'
create table public._ids (k text primary key, v text);
grant select on public._ids to authenticated, anon;
create function public._id(k text) returns uuid language sql stable as $$ select v::uuid from public._ids where k = $1 $$;
create function public._idt(k text) returns text language sql stable as $$ select v from public._ids where k = $1 $$;
insert into auth.users (id, email, raw_user_meta_data) values
 (:'A', 'line_ua@line.local', '{"name":"แม่เอ"}'), (:'B', 'line_ub@line.local', '{"name":"พ่อบี"}'), (:'C', 'mom.c@example.com', '{}');

-- ===== A creates family 1
set role authenticated; select set_config('request.jwt.claim.sub', :'A', false) \gset x_
select case when display_name = 'แม่เอ' then 'PASS' else 'FAIL' end || ' profile auto-created from LINE name' from profiles where id = auth.uid();
select public.create_household('ข้าวหอม', 'oz', 90) as h1 \gset
insert into bags (household_id, session_id, pumped_at, ml, place) values (:'h1', gen_random_uuid(), now(), 118.29, 'fridge') returning id as bag1 \gset
select public.create_invite(:'h1') as code \gset
select case when :'code' ~ '^[A-HJ-NP-Z2-9]{8}$' then 'PASS' else 'FAIL' end || ' invite code format ' || :'code';
reset role; insert into _ids values ('h1', :'h1'), ('bag1', :'bag1'), ('code', :'code');

-- ===== C creates family 2 and tries to reach family 1
set role authenticated; select set_config('request.jwt.claim.sub', :'C', false) \gset x_
select case when display_name = 'mom.c' then 'PASS' else 'FAIL' end || ' profile name falls back to email prefix' from profiles where id = auth.uid();
select public.create_household('ต้นกล้า', 'ml', 14) as h2 \gset
reset role; insert into _ids values ('h2', :'h2'); set role authenticated;
select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' C sees no bags of family 1' from bags where household_id = _id('h1');
select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' C sees no family 1 row' from households where id = _id('h1');
select case when count(*) = 1 then 'PASS' else 'FAIL' end || ' C sees only own profile' from profiles;
select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' C cannot read family 1 invites' from invites where household_id = _id('h1');
select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' C cannot see family 1 members' from household_members where household_id = _id('h1');
do $$ begin insert into bags (household_id, session_id, pumped_at, ml, place) values (public._id('h1'), gen_random_uuid(), now(), 50, 'fridge'); raise notice 'FAIL C inserted into family 1'; exception when others then raise notice 'PASS C cannot insert into family 1 (%)', sqlerrm; end $$;
with u as (update bags set ml = 1 where id = _id('bag1') returning 1) select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' C cannot update family 1 bag' from u;
with d as (delete from bags where id = _id('bag1') returning 1) select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' C cannot delete family 1 bag' from d;
do $$ begin perform public.create_invite(public._id('h1')); raise notice 'FAIL C invited to family 1'; exception when others then raise notice 'PASS C cannot create family 1 invite (%)', sqlerrm; end $$;
do $$ begin insert into household_members values (public._id('h1'), auth.uid(), 'member', now()); raise notice 'FAIL C self-joined'; exception when others then raise notice 'PASS C cannot self-join family 1 (%)', sqlerrm; end $$;
do $$ begin insert into households (baby_name) values ('x'); raise notice 'FAIL direct household insert'; exception when others then raise notice 'PASS direct household insert blocked (%)', sqlerrm; end $$;
insert into bags (household_id, session_id, pumped_at, ml, place) values (:'h2', gen_random_uuid(), now(), 90, 'freezer') returning id as bag2 \gset
with u as (update bags set household_id = _id('h1') where id = :'bag2' returning household_id) select case when household_id = :'h2' then 'PASS' else 'FAIL' end || ' bag cannot be moved to another family' from u;
do $$ begin update households set paid_until = now() + interval '10 years' where id = public._id('h2'); raise notice 'FAIL C set paid_until'; exception when others then raise notice 'PASS C cannot set paid_until (%)', sqlerrm; end $$;
do $$ begin update households set trial_ends_at = now() + interval '10 years' where id = public._id('h2'); raise notice 'FAIL C extended trial'; exception when others then raise notice 'PASS C cannot extend trial (%)', sqlerrm; end $$;
with u as (update households set baby_name = 'ต้นกล้าน้อย', unit = 'oz' where id = _id('h2') returning 1) select case when count(*) = 1 then 'PASS' else 'FAIL' end || ' C can change own family settings' from u;
with u as (update households set baby_name = 'hack' where id = _id('h1') returning 1) select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' C cannot change family 1 settings' from u;
select public.create_household('คนที่สอง', 'oz', 90) as h3 \gset
select case when not public.is_premium(:'h3') and public.is_premium(:'h2') then 'PASS' else 'FAIL' end || ' only the first family gets the free trial';

-- ===== B joins family 1 with the code
select set_config('request.jwt.claim.sub', :'B', false) \gset x_
select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' B cannot list invites before joining' from invites;
select case when baby_name = 'ข้าวหอม' and valid and not already_member then 'PASS' else 'FAIL' end || ' invite_info shows baby name' from invite_info(lower(:'code'));
select case when public.accept_invite(' ' || lower(:'code') || ' ') = _id('h1') then 'PASS' else 'FAIL' end || ' B joins family 1 (code is case/space tolerant)';
select case when count(*) = 1 then 'PASS' else 'FAIL' end || ' B sees family 1 bag' from bags;
select case when count(*) = 2 then 'PASS' else 'FAIL' end || ' B sees A profile and own' from profiles;
select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' B cannot see C profile' from profiles where id = :'C';
with d as (delete from household_members where household_id = _id('h1') and user_id = :'A' returning 1) select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' member cannot remove the owner' from d;
insert into bags (household_id, session_id, pumped_at, ml, place, created_by) values (_id('h1'), gen_random_uuid(), now(), 60, 'room', :'A') returning case when created_by = auth.uid() then 'PASS' else 'FAIL' end || ' created_by cannot be spoofed';
do $$ begin insert into bags (household_id, session_id, pumped_at, ml, place, active) values (public._id('h1'), gen_random_uuid(), now(), 60, 'used', true); raise notice 'FAIL used bag marked active'; exception when others then raise notice 'PASS active/place mismatch rejected'; end $$;
do $$ begin update profiles set line_user_id = 'Uspoof' where id = auth.uid(); raise notice 'FAIL changed line_user_id'; exception when others then raise notice 'PASS cannot change own line_user_id (%)', sqlerrm; end $$;
with u as (update profiles set display_name = 'แม่เอถูกแก้' where id = :'A' returning 1) select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' cannot rename someone else' from u;

-- ===== plan expiry
reset role; update households set trial_ends_at = now() - interval '1 day' where id = :'h1'; set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false) \gset x_
do $$ begin perform public.create_invite(public._id('h1')); raise notice 'FAIL expired plan invited'; exception when others then raise notice 'PASS expired plan cannot invite (%)', sqlerrm; end $$;
insert into bags (household_id, session_id, pumped_at, ml, place) values (_id('h1'), gen_random_uuid(), now(), 30, 'fridge') returning 'PASS expired plan can still record';
with d as (delete from household_members where household_id = _id('h1') and user_id = :'B' returning 1) select case when count(*) = 1 then 'PASS' else 'FAIL' end || ' owner removes a member' from d;
select set_config('request.jwt.claim.sub', :'B', false) \gset x_
select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' removed member sees no bags' from bags;
do $$ begin perform public.accept_invite(public._idt('code')); raise notice 'FAIL rejoined while expired'; exception when others then raise notice 'PASS rejoin refused while expired (%)', sqlerrm; end $$;
select case when count(*) = 0 then 'PASS' else 'FAIL' end || ' cannot rejoin while plan expired' from household_members where household_id = _id('h1') and user_id = auth.uid();
reset role; update households set paid_until = now() + interval '30 days' where id = :'h1'; set role authenticated;
select case when public.accept_invite(:'code') = _id('h1') then 'PASS' else 'FAIL' end || ' can join again after paying';

-- ===== signed-out visitor
reset role; set role anon; select set_config('request.jwt.claim.sub', '', false) \gset x_
do $$ begin perform count(*) from public.bags; raise notice 'FAIL anon read bags'; exception when others then raise notice 'PASS anon cannot read bags (%)', sqlerrm; end $$;
do $$ begin perform public.create_household('x'); raise notice 'FAIL anon created household'; exception when others then raise notice 'PASS anon cannot create household (%)', sqlerrm; end $$;
do $$ begin perform * from public.invite_info('ABC'); raise notice 'FAIL anon invite_info'; exception when others then raise notice 'PASS anon cannot probe invites (%)', sqlerrm; end $$;
reset role;

-- ===== account deletion cascades
delete from auth.users where id = :'B';
select case when not exists (select 1 from household_members where user_id = :'B') and not exists (select 1 from profiles where id = :'B') then 'PASS' else 'FAIL' end || ' deleting a user removes profile + memberships';
select case when (select count(*) from bags where household_id = :'h1') = 3 and (select count(*) from bags where created_by is null) = 1 then 'PASS' else 'FAIL' end || ' family bags stay, author cleared';
select case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'bags') then 'PASS' else 'FAIL' end || ' bags published for realtime';
-- someone in the family tries to wipe the author on purpose
insert into auth.users (id, email) values (:'B', 'line_ub@line.local');
insert into household_members values (:'h1', :'B', 'member', now());
set role authenticated; select set_config('request.jwt.claim.sub', :'B', false) \gset x_
with u as (update bags set created_by = :'B' where id = _id('bag1') returning created_by) select case when created_by = :'A' then 'PASS' else 'FAIL' end || ' cannot reassign author of a bag' from u;
reset role;
