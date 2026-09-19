-- 日南稻站｜Grounded in Rinan 數位互動植生牆
-- Supabase schema：種植紀錄、匿名人流事件
-- 在 Supabase SQL Editor 執行整份檔案即可建立資料表與權限。

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- plantings：LIFF 互動頁送出的「種下一株」紀錄
-- ---------------------------------------------------------------------------
create table if not exists public.plantings (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  display_name text,
  plant_type text not null check (
    plant_type in ('casuarina', 'rice', 'taro', 'koelreuteria', 'miscanthus', 'broussonetia')
  ),
  message text check (char_length(message) <= 60),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by text
);

create index if not exists plantings_status_created_at_idx
  on public.plantings (status, created_at desc);

create index if not exists plantings_line_user_id_idx
  on public.plantings (line_user_id);

comment on table public.plantings is '互動頁（Play）送出、經後台審核後於投影頁（Wall）即時生成的種植紀錄';
comment on column public.plantings.plant_type is '六種植物：木麻黃(casuarina)守護／水稻(rice)耕作／芋頭(taro)實踐／台灣欒樹(koelreuteria)日常／甜根子草(miscanthus)韌性／構樹(broussonetia)生命力';

-- ---------------------------------------------------------------------------
-- visits：匿名人流事件（未來 ESP32 + VL53L1X 感測裝置寫入）
-- 只統計人數，不做人臉辨識、不與 LINE 身分連結
-- ---------------------------------------------------------------------------
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  event_time timestamptz not null default now(),
  device_id text,
  count integer not null default 1 check (count > 0)
);

create index if not exists visits_event_time_idx
  on public.visits (event_time desc);

comment on table public.visits is '入口感測裝置回報的匿名來訪人數事件，不含任何個人識別資訊';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- 前端 Wall 頁使用 anon key 直接訂閱 Realtime，只能讀到已審核通過的種植紀錄。
-- 寫入、審核、visits 讀寫一律經由後端（service role key）處理，不對外公開。
-- ---------------------------------------------------------------------------
alter table public.plantings enable row level security;
alter table public.visits enable row level security;

drop policy if exists "public can read approved plantings" on public.plantings;
create policy "public can read approved plantings"
  on public.plantings
  for select
  to anon, authenticated
  using (status = 'approved');

-- 不建立 anon insert/update policy：一律由後端以 service role key 寫入，
-- 這樣才能先驗證 LIFF ID Token、做內容管理，再落地資料庫。
-- visits 表不開放任何 anon 權限，僅 service role 可讀寫。
