-- Saved AI briefings. Any approved account (manager or shelf) can read every row;
-- the author stamp comes from the signed-in user, not from the request body.
-- Apply in the Supabase SQL editor after 0001_foodbridge.sql.

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('briefing', 'county', 'shelf', 'ask')),
  result_mode text not null check (result_mode in ('ai', 'offline')),
  title text not null check (length(title) between 1 and 200),
  county text check (county is null or length(county) <= 60),
  question text check (question is null or length(question) <= 2000),
  as_of text not null check (as_of ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  workspace text not null check (workspace in ('demo', 'live')),
  markdown text not null check (length(markdown) between 1 and 80000),
  model text check (model is null or length(model) <= 80),
  note text check (note is null or length(note) <= 500),
  tool_calls jsonb not null default '[]'::jsonb check (jsonb_typeof(tool_calls) = 'array'),
  author_email text check (author_email is null or length(author_email) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists briefs_created_at on public.briefs (created_at desc);

-- Stamp the author from the session so a client cannot file a briefing under someone else.
create or replace function public.briefs_stamp_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
    select email into new.author_email from public.profiles where id = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists briefs_stamp_author on public.briefs;
create trigger briefs_stamp_author before insert on public.briefs
  for each row execute function public.briefs_stamp_author();

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('manager', 'shelf')
  );
$$;

alter table public.briefs enable row level security;

drop policy if exists "briefs: approved read" on public.briefs;
create policy "briefs: approved read" on public.briefs for select
  using (public.is_approved());

drop policy if exists "briefs: approved insert" on public.briefs;
create policy "briefs: approved insert" on public.briefs for insert
  with check (public.is_approved());

drop policy if exists "briefs: manager delete" on public.briefs;
create policy "briefs: manager delete" on public.briefs for delete
  using (public.is_manager());

grant select, insert, delete on table public.briefs to authenticated;
