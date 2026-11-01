-- ============================================================
--  منارة الحلقة — مخطط قاعدة البيانات السحابية (Supabase)
--  نفّذ هذا الملف كاملًا في SQL Editor داخل مشروع Supabase.
-- ============================================================

-- ---------- الجداول ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  full_name text not null default '',
  username text not null,
  email text not null default '',
  phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));
create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email))
  where email <> '';

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  teacher_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(trim(title)) >= 3),
  category text not null check (category in (
    'memorization', 'recitation', 'sunnah', 'oratory',
    'behavior', 'participation', 'project'
  )),
  achievement_date date not null default current_date,
  points integer not null default 0 check (points between 0 and 1000),
  description text not null default '',
  teacher_note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists achievements_student_idx on public.achievements (student_id);
create index if not exists achievements_status_idx on public.achievements (status);
create index if not exists achievements_date_idx on public.achievements (achievement_date desc);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  teacher_id uuid references public.profiles (id) on delete set null,
  term text not null,
  score integer not null check (score between 0 and 100),
  notes text not null default '',
  evaluation_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evaluations_student_idx on public.evaluations (student_id);
create index if not exists evaluations_date_idx on public.evaluations (evaluation_date desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 3),
  body text not null check (char_length(trim(body)) >= 3),
  audience text not null default 'all' check (audience in ('all', 'students', 'teachers')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_created_idx on public.announcements (created_at desc);

create table if not exists public.halaqa_settings (
  id integer primary key default 1 check (id = 1),
  name text not null default 'حلقة المنارة المتقدمة',
  mosque text not null default 'حلقات جامع الراجحي',
  association text not null default 'جمعية قبس للقرآن والسنة والخطابة',
  supervisor text not null default '',
  teacher text not null default '',
  year text not null default '',
  schedule text not null default '',
  location text not null default '',
  description text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- دوال مساعدة ----------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid() and active = true
  limit 1;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('teacher', 'admin'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- منع المستخدم العادي من ترقية نفسه أو تغيير بريده/اسم مستخدمه
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(auth.role(), '') = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.active is distinct from old.active
     or new.username is distinct from old.username
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at then
    raise exception 'لا تملك صلاحية تعديل هذه الحقول.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- إنشاء ملف شخصي تلقائيًا عند إضافة مستخدم في Supabase Auth.
-- الدور الافتراضي طالب دائمًا؛ دالة admin-user هي التي ترفعه إلى معلم/مدير.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    'user_' || substr(new.id::text, 1, 8)
  );

  if exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := v_username || '_' || substr(new.id::text, 1, 4);
  end if;

  insert into public.profiles (id, role, full_name, username, email, phone, active)
  values (
    new.id,
    'student',
    v_full_name,
    v_username,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    true
  )
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- المشغلات ----------
drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists achievements_updated_at on public.achievements;
create trigger achievements_updated_at
  before update on public.achievements
  for each row execute function public.set_updated_at();

drop trigger if exists evaluations_updated_at on public.evaluations;
create trigger evaluations_updated_at
  before update on public.evaluations
  for each row execute function public.set_updated_at();

drop trigger if exists announcements_updated_at on public.announcements;
create trigger announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

drop trigger if exists settings_updated_at on public.halaqa_settings;
create trigger settings_updated_at
  before update on public.halaqa_settings
  for each row execute function public.set_updated_at();

-- ---------- عرض عام للطلاب (بدون البريد والهاتف) ----------
create or replace view public.profiles_public
with (security_invoker = false) as
select id, role, full_name, username, active, created_at
from public.profiles;

-- ---------- تفعيل RLS ----------
alter table public.profiles enable row level security;
alter table public.achievements enable row level security;
alter table public.evaluations enable row level security;
alter table public.announcements enable row level security;
alter table public.halaqa_settings enable row level security;

-- ---------- سياسات profiles ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_staff());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- ---------- سياسات achievements ----------
drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements
  for select to authenticated
  using (student_id = auth.uid() or public.is_staff());

drop policy if exists achievements_insert on public.achievements;
create policy achievements_insert on public.achievements
  for insert to authenticated
  with check (
    public.is_staff()
    or (
      student_id = auth.uid()
      and status = 'pending'
      and teacher_id is null
      and coalesce(teacher_note, '') = ''
    )
  );

drop policy if exists achievements_update on public.achievements;
create policy achievements_update on public.achievements
  for update to authenticated
  using (public.is_staff() or (student_id = auth.uid() and status = 'pending'))
  with check (
    public.is_staff()
    or (
      student_id = auth.uid()
      and status = 'pending'
      and teacher_id is null
      and coalesce(teacher_note, '') = ''
    )
  );

drop policy if exists achievements_delete on public.achievements;
create policy achievements_delete on public.achievements
  for delete to authenticated
  using (public.is_staff() or (student_id = auth.uid() and status = 'pending'));

-- ---------- سياسات evaluations ----------
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select to authenticated
  using (student_id = auth.uid() or public.is_staff());

drop policy if exists evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists evaluations_delete on public.evaluations;
create policy evaluations_delete on public.evaluations
  for delete to authenticated
  using (public.is_staff());

-- ---------- سياسات announcements ----------
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    public.is_admin()
    or audience = 'all'
    or (audience = 'students' and public.current_user_role() = 'student')
    or (audience = 'teachers' and public.current_user_role() = 'teacher')
  );

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements
  for delete to authenticated
  using (public.is_admin());

-- ---------- سياسات halaqa_settings ----------
drop policy if exists settings_select on public.halaqa_settings;
create policy settings_select on public.halaqa_settings
  for select to authenticated
  using (true);

drop policy if exists settings_insert on public.halaqa_settings;
create policy settings_insert on public.halaqa_settings
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists settings_update on public.halaqa_settings;
create policy settings_update on public.halaqa_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- صلاحيات ----------
revoke all on public.profiles from anon;
revoke all on public.achievements from anon;
revoke all on public.evaluations from anon;
revoke all on public.announcements from anon;
revoke all on public.halaqa_settings from anon;
revoke all on public.profiles_public from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.achievements to authenticated;
grant select, insert, update, delete on public.evaluations to authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert, update on public.halaqa_settings to authenticated;
grant select on public.profiles_public to authenticated;

-- ---------- دوال تسجيل الدخول والترتيب ----------
create or replace function public.email_for_username(uname text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where lower(username) = lower(trim(uname))
    and active = true
    and email <> ''
  limit 1;
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

create or replace function public.student_leaderboard()
returns table (
  user_id uuid,
  full_name text,
  username text,
  points bigint,
  achievements_count bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select
      p.id as user_id,
      p.full_name,
      p.username,
      coalesce(sum(a.points) filter (where a.status = 'approved'), 0)::bigint as points,
      count(a.id) filter (where a.status = 'approved')::bigint as achievements_count
    from public.profiles p
    left join public.achievements a on a.student_id = p.id
    where p.role = 'student' and p.active = true
    group by p.id, p.full_name, p.username
  )
  select
    user_id,
    full_name,
    username,
    points,
    achievements_count,
    rank() over (order by points desc, achievements_count desc, full_name asc)::bigint as rank
  from totals
  order by points desc, achievements_count desc, full_name asc;
$$;

revoke all on function public.student_leaderboard() from public;
grant execute on function public.student_leaderboard() to authenticated;

-- ---------- بيانات إعدادات الحلقة ----------
insert into public.halaqa_settings
  (id, name, mosque, association, supervisor, teacher, year, schedule, location, description)
values
  (
    1,
    'حلقة المنارة المتقدمة',
    'حلقات جامع الراجحي',
    'جمعية قبس للقرآن والسنة والخطابة',
    'الشيخ د. عبدالله بن محمد العمري',
    'الأستاذ محمد بن عبدالله العمري',
    '١٤٤٨هـ — 2026م',
    'السبت والأحد والثلاثاء بعد صلاة العصر',
    'حلقات جامع الراجحي — القاعة الشرقية',
    'حلقة متقدمة لطلاب حلقات جامع الراجحي تجمع بين حفظ القرآن الكريم وعلوم السنة والخطابة، بإشراف جمعية قبس للقرآن والسنة والخطابة. يتابع المعلمون إنجاز كل طالب ويسجّلون ملاحظاتهم وتقييماتهم في سجل رقمي واحد.'
  )
on conflict (id) do nothing;

-- ---------- البث المباشر ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'achievements'
  ) then
    alter publication supabase_realtime add table public.achievements;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'evaluations'
  ) then
    alter publication supabase_realtime add table public.evaluations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end
$$;

-- ============================================================
--  بعد تنفيذ الملف:
--  1) أنشئ أول حساب من Authentication > Users > Add user.
--  2) ثم رقِّه إلى مدير بهذا الأمر:
--     update public.profiles set role = 'admin' where email = 'YOUR_EMAIL';
--  3) انشر دالة admin-user عبر Supabase CLI (انظر README.md).
-- ============================================================
