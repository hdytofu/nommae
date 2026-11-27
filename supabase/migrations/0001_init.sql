-- 0001_init.sql — คลังนมแม่: โครงสร้างข้อมูล + สิทธิ์การเข้าถึง (RLS)
--
-- หลักการ: ข้อมูลทั้งหมดผูกกับ "ครอบครัว" (households) หนึ่งครอบครัว = สต็อกนมของแม่หนึ่งคน
-- สมาชิกครอบครัว (แม่ พ่อ ยาย พี่เลี้ยง) เห็นและบันทึกได้เฉพาะครอบครัวที่ตัวเองเป็นสมาชิก
-- ครอบครัวอื่นมองไม่เห็นข้อมูลกันเลย — บังคับที่ฐานข้อมูล ไม่ได้พึ่งโค้ดหน้าเว็บ
--
-- รันไฟล์นี้ครั้งเดียวใน Supabase → SQL Editor (ดู supabase/README.md)

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  picture_url text,
  line_user_id text unique,
  consent_at timestamptz,               -- ยอมรับนโยบายความเป็นส่วนตัว (PDPA) เมื่อไร
  created_at timestamptz not null default now()
);

-- สร้างโปรไฟล์อัตโนมัติเมื่อมีผู้ใช้ใหม่ (ทั้งล็อกอิน LINE และอีเมล)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(coalesce(new.email, ''), '@', 1)), 80))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- households (ครอบครัว)
create table public.households (
  id uuid primary key default gen_random_uuid(),
  baby_name text not null default '' check (char_length(baby_name) <= 40),
  unit text not null default 'oz' check (unit in ('oz', 'ml')),
  room_hours numeric not null default 4 check (room_hours > 0 and room_hours <= 72),
  cooler_hours numeric not null default 24 check (cooler_hours > 0 and cooler_hours <= 168),
  fridge_days numeric not null default 4 check (fridge_days > 0 and fridge_days <= 30),
  freezer_days numeric not null default 90 check (freezer_days > 0 and freezer_days <= 730),
  thawed_hours numeric not null default 24 check (thawed_hours > 0 and thawed_hours <= 72),
  -- แพ็กเกจ: ทดลองฟรี 30 วัน แล้วจ่ายต่ออายุ (paid_until) — ผู้ใช้แก้ 2 ช่องนี้เองไม่ได้
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  paid_until timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user on public.household_members (user_id);

-- โค้ดเชิญเข้าครอบครัว (ใช้ได้หลายคน ภายใน 7 วัน)
create table public.invites (
  code text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
create index invites_household on public.invites (household_id);

-- ---------------------------------------------------------------- bags (ถุงนม)
-- ml เก็บเป็นมิลลิลิตรเสมอ (ทศนิยม 2 ตำแหน่ง) หน้าเว็บแปลงเป็นออนซ์ตามที่ครอบครัวเลือก
create table public.bags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  session_id uuid not null,                          -- ปั๊มครั้งเดียวกันแต่แบ่งหลายถุง
  pumped_at timestamptz not null,
  ml numeric(8, 2) not null check (ml > 0 and ml <= 2500),
  side text check (side in ('L', 'R', 'B')),
  place text not null check (place in ('room', 'cooler', 'fridge', 'freezer', 'thawed', 'used', 'discarded')),
  active boolean not null default true,              -- ยังอยู่ในสต็อก
  direct boolean not null default false,             -- ป้อนลูกทันทีหลังปั๊ม (ไม่เข้าสต็อก)
  thawed_at timestamptz,
  done_at timestamptz,                               -- เวลาที่ป้อนหรือทิ้ง
  prev_place text check (prev_place in ('room', 'cooler', 'fridge', 'freezer', 'thawed')),
  note text not null default '' check (char_length(note) <= 200),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active = (place in ('room', 'cooler', 'fridge', 'freezer', 'thawed')))
);
create index bags_household_active on public.bags (household_id) where active;
create index bags_household_updated on public.bags (household_id, updated_at desc);
create index bags_household_pumped on public.bags (household_id, pumped_at desc);

-- ประทับเวลา/ผู้แก้ไข และกันไม่ให้ย้ายถุงไปครอบครัวอื่น
create function public.bags_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  else
    new.household_id := old.household_id;
    new.created_at := old.created_at;
    -- เปลี่ยนผู้บันทึกเป็นคนอื่นไม่ได้ แต่เป็น null ได้ (ตอนผู้บันทึกลบบัญชี FK จะตั้งเป็น null)
    if new.created_by is not null then
      new.created_by := old.created_by;
    end if;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end $$;

create trigger bags_stamp
  before insert or update on public.bags
  for each row execute function public.bags_stamp();

-- ---------------------------------------------------------------- helper functions
-- security definer: อ่านตารางสมาชิกได้โดยไม่วนเรียก RLS ซ้ำ
create function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = h and user_id = auth.uid())
$$;

create function public.is_owner(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = h and user_id = auth.uid() and role = 'owner')
$$;

create function public.shares_household(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members me
    join household_members them on them.household_id = me.household_id
    where me.user_id = auth.uid() and them.user_id = other)
$$;

create function public.is_premium(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from households
    where id = h and (trial_ends_at > now() or coalesce(paid_until > now(), false)))
$$;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invites enable row level security;
alter table public.bags enable row level security;

-- ผู้ไม่ได้ล็อกอินไม่มีสิทธิ์ใด ๆ
revoke all on public.profiles, public.households, public.household_members, public.invites, public.bags from anon;

-- profiles: เห็นตัวเองและคนในครอบครัวเดียวกัน · แก้ได้เฉพาะชื่อและการยอมรับ PDPA ของตัวเอง
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, consent_at) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- households: สมาชิกเห็นและแก้การตั้งค่าได้ · สร้างผ่าน create_household() เท่านั้น
-- แก้ trial_ends_at / paid_until ไม่ได้ (ไม่ได้ให้สิทธิ์คอลัมน์)
revoke insert, update, delete on public.households from authenticated;
grant update (baby_name, unit, room_hours, cooler_hours, fridge_days, freezer_days, thawed_hours)
  on public.households to authenticated;
create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

-- household_members: เห็นสมาชิกในครอบครัวตัวเอง · เข้าร่วมผ่าน accept_invite() เท่านั้น
-- สมาชิกออกเองได้ · เจ้าของครอบครัวเอาคนอื่นออกได้ (เจ้าของออกเองไม่ได้)
revoke insert, update on public.household_members from authenticated;
create policy members_select on public.household_members for select to authenticated
  using (public.is_member(household_id));
create policy members_delete on public.household_members for delete to authenticated
  using ((user_id = auth.uid() and role <> 'owner') or (public.is_owner(household_id) and user_id <> auth.uid()));

-- invites: สมาชิกเห็นและยกเลิกโค้ดของครอบครัวตัวเองได้ · สร้างผ่าน create_invite()
revoke insert, update on public.invites from authenticated;
create policy invites_select on public.invites for select to authenticated
  using (public.is_member(household_id));
create policy invites_delete on public.invites for delete to authenticated
  using (public.is_member(household_id));

-- bags: สมาชิกครอบครัวอ่าน/เพิ่ม/แก้/ลบถุงนมของครอบครัวตัวเองได้
create policy bags_select on public.bags for select to authenticated
  using (public.is_member(household_id));
create policy bags_insert on public.bags for insert to authenticated
  with check (public.is_member(household_id));
create policy bags_update on public.bags for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy bags_delete on public.bags for delete to authenticated
  using (public.is_member(household_id));

-- ---------------------------------------------------------------- RPC
-- สร้างครอบครัวใหม่ + ตั้งตัวเองเป็นเจ้าของ (ทดลองฟรีเฉพาะครอบครัวแรกที่สร้าง)
create function public.create_household(p_baby_name text, p_unit text default 'oz', p_freezer_days numeric default 90)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  h uuid;
  had_before boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from household_members where user_id = auth.uid() and role = 'owner') >= 5 then
    raise exception 'too_many_households';
  end if;
  select exists (select 1 from households where created_by = auth.uid()) into had_before;
  insert into households (baby_name, unit, freezer_days, created_by, trial_ends_at)
  values (
    left(coalesce(trim(p_baby_name), ''), 40),
    case when p_unit = 'ml' then 'ml' else 'oz' end,
    case when p_freezer_days > 0 and p_freezer_days <= 730 then p_freezer_days else 90 end,
    auth.uid(),
    case when had_before then now() else now() + interval '30 days' end
  )
  returning id into h;
  insert into household_members (household_id, user_id, role) values (h, auth.uid(), 'owner');
  return h;
end $$;

-- สร้างโค้ดเชิญ 8 ตัวอักษร (ตัดตัวที่อ่านสับสน เช่น 0/O, 1/I) — ใช้ได้เมื่อแพ็กเกจยังไม่หมดอายุ
create function public.create_invite(p_household uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
  i int;
begin
  if not public.is_member(p_household) then raise exception 'not_member'; end if;
  if not public.is_premium(p_household) then raise exception 'premium_required'; end if;
  delete from invites where household_id = p_household and expires_at < now();
  loop
    b := uuid_send(gen_random_uuid());
    c := '';
    foreach i in array array[0, 1, 2, 3, 4, 5, 10, 11] loop
      c := c || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from invites where code = c);
  end loop;
  insert into invites (code, household_id, created_by) values (c, p_household, auth.uid());
  return c;
end $$;

-- ดูข้อมูลคำเชิญก่อนกดเข้าร่วม (ชื่อเล่นลูก + ยังใช้ได้ไหม)
create function public.invite_info(p_code text)
returns table (baby_name text, valid boolean, already_member boolean)
language sql stable security definer set search_path = public as $$
  select h.baby_name,
         (i.expires_at > now()) as valid,
         public.is_member(h.id) as already_member
  from invites i join households h on h.id = i.household_id
  where i.code = upper(trim(p_code)) and auth.uid() is not null
$$;

create function public.accept_invite(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into inv from invites where code = upper(trim(p_code));
  if not found or inv.expires_at < now() then raise exception 'invite_invalid'; end if;
  if public.is_member(inv.household_id) then return inv.household_id; end if;
  if not public.is_premium(inv.household_id) then raise exception 'premium_required'; end if;
  if (select count(*) from household_members where household_id = inv.household_id) >= 8 then
    raise exception 'household_full';
  end if;
  insert into household_members (household_id, user_id, role) values (inv.household_id, auth.uid(), 'member');
  return inv.household_id;
end $$;

revoke execute on function public.create_household(text, text, numeric) from public, anon;
revoke execute on function public.create_invite(uuid) from public, anon;
revoke execute on function public.invite_info(text) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.create_household(text, text, numeric) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.invite_info(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------------------------------------------------------------- realtime
-- ให้ทุกคนในครอบครัวเห็นถุงนมอัปเดตทันที
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.bags;
  end if;
end $$;
