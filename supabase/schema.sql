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


-- ─── Columns added after the initial schema ───────────────────────────────────
alter table public.articles add column if not exists title_ar    text;
alter table public.articles add column if not exists summary_ar  text;
alter table public.articles add column if not exists taitan_take text;

-- ─── Scheduling ───────────────────────────────────────────────────────────────
-- The pipeline is driven by an external cron (cron-job.org) calling the
-- run-pipeline edge function every 15 minutes with the x-admin-key header.
-- An earlier pg_cron job ('ruya-fetch-news-daily') called the retired
-- fetch-news function; remove it if it still exists:
--   select cron.unschedule('ruya-fetch-news-daily');
