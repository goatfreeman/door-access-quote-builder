create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null default '',
  name text not null,
  category text not null,
  unit_price numeric(12, 2) not null default 0,
  msrp numeric(12, 2),
  vendor text,
  inventory integer,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  collaborators uuid[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.template_lines (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quote_templates(id) on delete cascade,
  item_id uuid not null references public.catalog_items(id),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (template_id, item_id)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  share_token uuid not null default gen_random_uuid(),
  quote_number text not null unique,
  customer text not null,
  project text not null,
  location text,
  email text,
  margin_percent numeric(6, 2) not null default 0,
  tax_percent numeric(6, 2) not null default 0,
  include_labor boolean not null default false,
  labor_hours numeric(8, 2),
  labor_rate numeric(10, 2),
  scope_of_work text,
  notes text,
  lines_snapshot jsonb not null default '[]'::jsonb,
  total numeric(12, 2) not null default 0,
  revision integer not null default 1,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quotes
  add column if not exists scope_of_work text;

create table if not exists public.quote_revisions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  revision integer not null,
  summary text,
  changed_by uuid references public.profiles(id),
  meta_snapshot jsonb not null default '{}'::jsonb,
  lines_snapshot jsonb not null default '[]'::jsonb,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (quote_id, revision)
);

create table if not exists public.draft_quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  device_id text,
  kind text not null default 'current' check (kind in ('current', 'saved')),
  quote_step text not null default 'pick' check (quote_step in ('pick', 'customize', 'review', 'finalize')),
  meta_snapshot jsonb not null default '{}'::jsonb,
  lines_snapshot jsonb not null default '[]'::jsonb,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists draft_quotes_one_current_per_user_idx
  on public.draft_quotes(owner_id)
  where kind = 'current';

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  device_name text not null,
  revoked_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create table if not exists public.debug_logs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('auth', 'session', 'sync', 'database', 'ui')),
  level text not null check (level in ('info', 'warning', 'error')),
  message text not null,
  user_id uuid references public.profiles(id),
  device_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_items_category_idx on public.catalog_items(category) where deleted_at is null;
create index if not exists catalog_items_name_idx on public.catalog_items using gin (to_tsvector('simple', name));
create index if not exists quote_templates_name_idx on public.quote_templates(name) where deleted_at is null;
create index if not exists template_lines_item_id_idx on public.template_lines(item_id);
create index if not exists quotes_quote_number_idx on public.quotes(quote_number);
create index if not exists quotes_share_token_idx on public.quotes(share_token);
create index if not exists quotes_customer_project_idx on public.quotes(customer, project) where deleted_at is null;
create index if not exists quote_revisions_quote_id_idx on public.quote_revisions(quote_id, revision desc);
create index if not exists draft_quotes_owner_idx on public.draft_quotes(owner_id, updated_at desc);
create index if not exists user_sessions_user_idx on public.user_sessions(user_id, last_seen_at desc);
create index if not exists debug_logs_created_idx on public.debug_logs(created_at desc);

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_catalog_items_updated_at on public.catalog_items;
create trigger touch_catalog_items_updated_at before update on public.catalog_items
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_quote_templates_updated_at on public.quote_templates;
create trigger touch_quote_templates_updated_at before update on public.quote_templates
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_quotes_updated_at on public.quotes;
create trigger touch_quotes_updated_at before update on public.quotes
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_draft_quotes_updated_at on public.draft_quotes;
create trigger touch_draft_quotes_updated_at before update on public.draft_quotes
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.catalog_items enable row level security;
alter table public.quote_templates enable row level security;
alter table public.template_lines enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_revisions enable row level security;
alter table public.draft_quotes enable row level security;
alter table public.user_sessions enable row level security;
alter table public.debug_logs enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "profiles read team" on public.profiles;
create policy "profiles read team" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "items team read active" on public.catalog_items;
create policy "items team read active" on public.catalog_items
  for select to authenticated using (deleted_at is null or public.is_admin());

drop policy if exists "items team write" on public.catalog_items;
create policy "items team write" on public.catalog_items
  for all to authenticated using (true) with check (true);

drop policy if exists "templates team read active" on public.quote_templates;
create policy "templates team read active" on public.quote_templates
  for select to authenticated using (deleted_at is null or public.is_admin());

drop policy if exists "templates team write" on public.quote_templates;
create policy "templates team write" on public.quote_templates
  for all to authenticated using (true) with check (true);

drop policy if exists "template lines team read" on public.template_lines;
create policy "template lines team read" on public.template_lines
  for select to authenticated using (true);

drop policy if exists "template lines team write" on public.template_lines;
create policy "template lines team write" on public.template_lines
  for all to authenticated using (true) with check (true);

drop policy if exists "quotes team read active" on public.quotes;
create policy "quotes team read active" on public.quotes
  for select to authenticated using (deleted_at is null or public.is_admin());

drop policy if exists "quotes team write" on public.quotes;
create policy "quotes team write" on public.quotes
  for all to authenticated using (true) with check (true);

drop policy if exists "quote revisions team read" on public.quote_revisions;
create policy "quote revisions team read" on public.quote_revisions
  for select to authenticated using (true);

drop policy if exists "quote revisions team insert" on public.quote_revisions;
create policy "quote revisions team insert" on public.quote_revisions
  for insert to authenticated with check (true);

drop policy if exists "drafts owner read" on public.draft_quotes;
create policy "drafts owner read" on public.draft_quotes
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "drafts owner write" on public.draft_quotes;
create policy "drafts owner write" on public.draft_quotes
  for all to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "sessions owner read" on public.user_sessions;
create policy "sessions owner read" on public.user_sessions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "sessions owner write" on public.user_sessions;
create policy "sessions owner write" on public.user_sessions
  for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "debug logs admin read" on public.debug_logs;
create policy "debug logs admin read" on public.debug_logs
  for select to authenticated using (public.is_admin());

drop policy if exists "debug logs user insert" on public.debug_logs;
create policy "debug logs user insert" on public.debug_logs
  for insert to authenticated with check (user_id = auth.uid() or user_id is null);

drop policy if exists "settings admin only" on public.app_settings;
drop policy if exists "settings authenticated read" on public.app_settings;
create policy "settings authenticated read" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "settings admin write" on public.app_settings;
create policy "settings admin write" on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
