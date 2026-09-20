-- 日南稻站｜Grounded in Rinan 數位互動植生牆
-- Supabase schema：種植紀錄、匿名人流事件
-- 在 Supabase SQL Editor 執行整份檔案即可建立資料表與權限。

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- plantings：LIFF 互動頁送出的「種下一株」紀錄
-- ---------------------------------------------------------------------------
create table if not exists public.plantings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'line' check (source in ('line', 'kiosk')),
  line_user_id text not null,
  display_name text,
  plant_type text not null check (
    plant_type in ('casuarina', 'rice', 'taro', 'koelreuteria', 'miscanthus', 'broussonetia')
  ),
  message text check (char_length(message) <= 15),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by text
);

-- 若是舊資料庫已經有 plantings 表（沒有 source 欄位），補上去，不影響既有資料。
alter table public.plantings add column if not exists source text not null default 'line';
alter table public.plantings drop constraint if exists plantings_source_check;
alter table public.plantings add constraint plantings_source_check check (source in ('line', 'kiosk'));

-- 留言字數上限從舊版 60 字改成 15 字，既有資料庫要跑這個才會套用新限制。
alter table public.plantings drop constraint if exists plantings_message_check;
alter table public.plantings add constraint plantings_message_check check (char_length(message) <= 15);

create index if not exists plantings_status_created_at_idx
  on public.plantings (status, created_at desc);

create index if not exists plantings_line_user_id_idx
  on public.plantings (line_user_id);

comment on table public.plantings is '互動頁（Play／Kiosk）送出、經後台審核後於投影頁（Wall）即時生成的種植紀錄';
comment on column public.plantings.plant_type is '六種植物：木麻黃(casuarina)守護／水稻(rice)耕作／芋頭(taro)實踐／台灣欒樹(koelreuteria)日常／甜根子草(miscanthus)韌性／構樹(broussonetia)生命力';
comment on column public.plantings.source is '種下來源：line（LIFF 手機登入）／kiosk（現場固定平板，無 LINE 身分）';
comment on column public.plantings.line_user_id is 'LINE 來源存真實 userId；kiosk 來源存生成的流水編號（如 UNI-000123），兩者合併去重即為不重複參與人數';
comment on column public.plantings.display_name is '公開顯示的暱稱（使用者可自訂，不一定等於 LINE 真實顯示名稱）';

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
-- kiosk_sessions：現場固定平板（無 LINE）每次開始互動時發一組流水編號
-- ---------------------------------------------------------------------------
create table if not exists public.kiosk_sessions (
  id bigserial primary key,
  created_at timestamptz not null default now()
);

comment on table public.kiosk_sessions is '固定平板每次互動發的流水編號來源，UNI ID 格式為 UNI- 加上這個 id 補零';

-- 平板開始一次互動時呼叫：建立一組新的流水編號，同時計入一次人流（visits），
-- 兩件事放在同一個函式裡，確保原子性（不會發生編號建立但人流沒算到的情況）。
create or replace function public.create_kiosk_session()
returns text
language plpgsql
as $$
declare
  new_id bigint;
begin
  insert into public.kiosk_sessions default values returning id into new_id;
  insert into public.visits (device_id, count) values ('kiosk', 1);
  return 'UNI-' || lpad(new_id::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- line_users：以 LINE userId 去重後留存的使用者名冊
-- 對應計畫書「使用者：匿名代號、LINE 身分、第一次參與時間、是否回訪」，
-- 與 plantings（可能同一人多筆）分開，一人只有一列，可看出回訪狀況。
-- 含 LINE 身分識別資訊，僅後端（service role）可讀寫，不對外公開。
-- ---------------------------------------------------------------------------
create table if not exists public.line_users (
  line_user_id text primary key,
  display_name text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  visit_count integer not null default 1
);

comment on table public.line_users is '以 LINE userId 去重的使用者名冊，記錄首次／最近參與時間與互動次數（是否回訪）';

-- 每次互動頁送出時呼叫這個函式，新使用者建立一列，舊使用者更新最近時間與次數＋1。
create or replace function public.touch_line_user(p_user_id text, p_display_name text)
returns void
language sql
as $$
  insert into public.line_users (line_user_id, display_name)
  values (p_user_id, p_display_name)
  on conflict (line_user_id) do update
    set display_name = excluded.display_name,
        last_seen_at = now(),
        visit_count = public.line_users.visit_count + 1;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- 前端 Wall 頁使用 anon key 直接訂閱 Realtime，只能讀到已審核通過的種植紀錄。
-- 寫入、審核、visits 讀寫一律經由後端（service role key）處理，不對外公開。
-- ---------------------------------------------------------------------------
alter table public.plantings enable row level security;
alter table public.visits enable row level security;
alter table public.line_users enable row level security;
alter table public.kiosk_sessions enable row level security;

drop policy if exists "public can read approved plantings" on public.plantings;
create policy "public can read approved plantings"
  on public.plantings
  for select
  to anon, authenticated
  using (status = 'approved');

-- 不建立 anon insert/update policy：一律由後端以 service role key 寫入，
-- 這樣才能先驗證 LIFF ID Token、做內容管理，再落地資料庫。
-- visits、line_users、kiosk_sessions 表不開放任何 anon 權限，僅 service role 可讀寫。
