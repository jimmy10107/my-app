-- 2026-11-14｜社群儀表板每日快照：在 Supabase → SQL Editor 執行這一段（已經跑過完整 schema.sql 的資料庫用）。
-- 重複執行不會出錯。

create table if not exists public.social_daily (
  day date not null,
  platform text not null check (platform in ('facebook', 'instagram', 'plantings')),
  followers integer,
  metrics jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (day, platform)
);

comment on table public.social_daily is '社群儀表板每日快照（Vercel Cron 每天寫入）：FB／IG 粉絲數與每日觀看、觸及、互動，以及植生牆每日種植數；累積超過 Meta API 只給 30～93 天的歷史';
comment on column public.social_daily.followers is '快照當下的粉絲總數；只有快照執行當天有值，補寫前一天時不覆蓋';

-- 只有伺服器端（service role）可讀寫，不開放 anon。
alter table public.social_daily enable row level security;
