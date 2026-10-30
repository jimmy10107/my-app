-- 2026-10-29｜掃碼即時發芽：只需在 Supabase → SQL Editor 執行這一段（已經跑過完整 schema.sql 的資料庫用）。
-- 重複執行不會出錯。

-- 1. 讓投影牆收得到即時新增（Realtime）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plantings'
  ) then
    alter publication supabase_realtime add table public.plantings;
  end if;
end
$$;

-- 2. 公開金鑰只能讀投影牆需要的欄位，不再能讀到參與者的 LINE userId
revoke select on public.plantings from anon, authenticated;
grant select (id, plant_type, display_name, message, status, created_at) on public.plantings to anon, authenticated;
