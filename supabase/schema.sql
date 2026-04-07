-- ─── Ru'ya | رؤية — Database Schema ──────────────────────────────────────────
-- Run this in Supabase Dashboard → SQL Editor → New query → Run

-- Articles table (url is the primary key / unique ID)
create table if not exists public.articles (
  url             text primary key,
  title           text not null default '',
  description     text default '',
  image           text,
  published_at    timestamptz,
  source          text default '',
  source_priority text default '',
  tag             text,
  summary         text default '',
  fetched_at      timestamptz default now()
);

-- Enable Row Level Security
alter table public.articles enable row level security;

-- Anyone (anon) can read articles — the React app uses the anon key
create policy "anon_read_articles"
  on public.articles for select to anon using (true);

-- Service role (edge functions) can do everything
create policy "service_all_articles"
  on public.articles for all to service_role
  using (true) with check (true);

-- Performance indexes
create index if not exists idx_articles_published_at on public.articles(published_at desc nulls last);
create index if not exists idx_articles_tag           on public.articles(tag);
create index if not exists idx_articles_fetched_at    on public.articles(fetched_at desc);

-- ─── Fetch log (so admin can see when the last server-side fetch ran) ─────────
create table if not exists public.fetch_log (
  id          bigserial primary key,
  ran_at      timestamptz default now(),
  raw_count   int default 0,
  stored      int default 0,
  ai_tagged   int default 0,
  status      text default 'ok',
  error_msg   text
);

alter table public.fetch_log enable row level security;

create policy "anon_read_fetch_log"
  on public.fetch_log for select to anon using (true);

create policy "service_all_fetch_log"
  on public.fetch_log for all to service_role
  using (true) with check (true);

-- ─── Enable pg_cron + pg_net extensions (needed for scheduled fetch) ──────────
-- These may already be enabled. Safe to run again.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─── Daily cron: fetch news every day at 04:00 UTC (07:00 Riyadh time) ────────
-- Replace Global$23 if you change the admin password
select cron.schedule(
  'ruya-fetch-news-daily',
  '0 4 * * *',
  $$
  select net.http_post(
    url     := 'https://esacgqoalnvyzpsgrruc.supabase.co/functions/v1/fetch-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-admin-key',  'Taitan12@@4'
    ),
    body    := '{}'::jsonb
  );
  $$
);
