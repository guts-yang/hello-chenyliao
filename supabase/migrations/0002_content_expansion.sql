-- Phase A: content-model expansion.
--   - long-form blog posts with MDX bodies
--   - short notes / "now" updates
--   - tag dictionary (re-usable across posts / projects / experiences)
--   - per-resource view counters with an atomic increment RPC
--   - site_settings singleton (editable hero / theme / feature flags)
--   - extra columns on projects / timeline
--   - pgvector embedding table feeding the AI retriever
--   - chat_sessions / chat_messages for the persisted assistant transcript
--
-- Apply with: supabase db push  (or paste into the SQL editor)

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "vector";

------------------------------------------------------------
-- posts (blog / long-form)
------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_zh text not null,
  title_en text not null,
  excerpt_zh text not null default '',
  excerpt_en text not null default '',
  body_zh text not null default '',
  body_en text not null default '',
  cover_url text,
  tags text[] not null default '{}',
  reading_minutes int not null default 1,
  display_order int not null default 0,
  published_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_published_idx
  on public.posts (is_published, published_at desc nulls last);
create index if not exists posts_title_zh_trgm_idx
  on public.posts using gin (title_zh gin_trgm_ops);
create index if not exists posts_title_en_trgm_idx
  on public.posts using gin (title_en gin_trgm_ops);

------------------------------------------------------------
-- notes (short / now updates)
------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  body_zh text not null,
  body_en text not null,
  mood text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists notes_created_idx
  on public.notes (is_published, created_at desc);

------------------------------------------------------------
-- tags dictionary (kept lightweight; posts/projects tags[]
--   columns still hold slug strings, this table powers UI labels)
------------------------------------------------------------
create table if not exists public.tags (
  slug text primary key,
  name_zh text not null,
  name_en text not null,
  description_zh text,
  description_en text,
  color text
);

------------------------------------------------------------
-- views (per-resource counters)
------------------------------------------------------------
create table if not exists public.views (
  scope text not null check (scope in ('project', 'experience', 'post', 'home')),
  ref_id text not null,
  count bigint not null default 0,
  last_seen_at timestamptz not null default now(),
  primary key (scope, ref_id)
);

create or replace function public.increment_view(p_scope text, p_ref_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count bigint;
begin
  insert into public.views (scope, ref_id, count, last_seen_at)
  values (p_scope, p_ref_id, 1, now())
  on conflict (scope, ref_id)
  do update set
    count = public.views.count + 1,
    last_seen_at = now()
  returning count into next_count;
  return next_count;
end;
$$;

revoke all on function public.increment_view(text, text) from public;
grant execute on function public.increment_view(text, text) to anon, authenticated;

------------------------------------------------------------
-- site_settings (singleton id='main')
------------------------------------------------------------
create table if not exists public.site_settings (
  id text primary key default 'main',
  hero_zh text not null default '',
  hero_en text not null default '',
  cta_label_zh text not null default '',
  cta_label_en text not null default '',
  theme_tokens jsonb not null default '{}'::jsonb,
  feature_flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

------------------------------------------------------------
-- extra columns on existing tables (idempotent)
------------------------------------------------------------
alter table public.projects
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists stack   jsonb not null default '{}'::jsonb;

alter table public.timeline
  add column if not exists featured boolean not null default false;

------------------------------------------------------------
-- profile_embeddings (AI retriever)
------------------------------------------------------------
create table if not exists public.profile_embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id text not null,
  source_type text not null check (source_type in ('profile','project','experience','honor','education','post','note')),
  source_ref text,
  locale text not null check (locale in ('zh','en')),
  content text not null,
  embedding vector(1024),
  updated_at timestamptz not null default now(),
  unique (chunk_id, locale)
);

create index if not exists profile_embeddings_locale_idx
  on public.profile_embeddings (locale, source_type);
-- ivfflat needs ANALYZE + lists tuning later; keep the index optional here.
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'profile_embeddings_vec_idx'
  ) then
    -- guard with try/catch via dynamic SQL: ivfflat may not be ready on first run
    begin
      execute 'create index profile_embeddings_vec_idx on public.profile_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 50)';
    exception when others then
      -- ignore; index can be created later once data exists
      null;
    end;
  end if;
end$$;

------------------------------------------------------------
-- chat_sessions / chat_messages (anonymous transcript persistence)
------------------------------------------------------------
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_token text not null,
  locale text not null check (locale in ('zh','en')),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index if not exists chat_sessions_visitor_idx
  on public.chat_sessions (visitor_token, last_active_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  tool_name text,
  tool_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx
  on public.chat_messages (session_id, created_at);

------------------------------------------------------------
-- updated_at triggers for the new tables
------------------------------------------------------------
drop trigger if exists trg_posts_touch on public.posts;
create trigger trg_posts_touch
  before update on public.posts
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_site_settings_touch on public.site_settings;
create trigger trg_site_settings_touch
  before update on public.site_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_profile_embeddings_touch on public.profile_embeddings;
create trigger trg_profile_embeddings_touch
  before update on public.profile_embeddings
  for each row execute function public.touch_updated_at();

------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------
alter table public.posts              enable row level security;
alter table public.notes              enable row level security;
alter table public.tags               enable row level security;
alter table public.views              enable row level security;
alter table public.site_settings      enable row level security;
alter table public.profile_embeddings enable row level security;
alter table public.chat_sessions      enable row level security;
alter table public.chat_messages      enable row level security;

-- Public reads (only published posts / notes; site_settings is fully public)
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (is_published);

drop policy if exists notes_read on public.notes;
create policy notes_read on public.notes for select using (is_published);

drop policy if exists tags_read on public.tags;
create policy tags_read on public.tags for select using (true);

drop policy if exists views_read on public.views;
create policy views_read on public.views for select using (true);

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select using (true);

-- Embeddings and chat tables are not directly read from the browser
-- (the server uses the service-role client for those); deny anon reads
-- explicitly so a leaked anon key can't dump them.
drop policy if exists profile_embeddings_read on public.profile_embeddings;
create policy profile_embeddings_read on public.profile_embeddings
  for select to authenticated using (true);

drop policy if exists chat_sessions_read on public.chat_sessions;
create policy chat_sessions_read on public.chat_sessions
  for select to authenticated using (true);

drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages
  for select to authenticated using (true);

-- Authenticated owner write for everything (single-user CMS).
drop policy if exists posts_write on public.posts;
create policy posts_write on public.posts for all to authenticated using (true) with check (true);

drop policy if exists notes_write on public.notes;
create policy notes_write on public.notes for all to authenticated using (true) with check (true);

drop policy if exists tags_write on public.tags;
create policy tags_write on public.tags for all to authenticated using (true) with check (true);

drop policy if exists site_settings_write on public.site_settings;
create policy site_settings_write on public.site_settings for all to authenticated using (true) with check (true);

drop policy if exists profile_embeddings_write on public.profile_embeddings;
create policy profile_embeddings_write on public.profile_embeddings for all to authenticated using (true) with check (true);

drop policy if exists chat_sessions_write on public.chat_sessions;
create policy chat_sessions_write on public.chat_sessions for all to authenticated using (true) with check (true);

drop policy if exists chat_messages_write on public.chat_messages;
create policy chat_messages_write on public.chat_messages for all to authenticated using (true) with check (true);

-- Views table: we don't let the browser write directly; the increment_view
-- RPC is the only entry point. Allow service-role / authenticated to manage.
drop policy if exists views_write on public.views;
create policy views_write on public.views for all to authenticated using (true) with check (true);
