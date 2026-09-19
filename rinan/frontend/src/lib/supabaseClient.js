import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 前端只使用 anon key，並且 RLS 只允許讀取 status = 'approved' 的種植紀錄，
// 因此就算 key 外洩也無法讀寫其他資料，可以安心用在投影頁（Wall）。
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
