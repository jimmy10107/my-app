import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';

let client = null;

// service role key 只在伺服器端使用，可繞過 RLS，所有寫入與後台操作都經過這支 client。
// 第一次用到才建立：環境變數還沒設定時，模組載入不會整個掛掉，/api/health 仍能回報狀況。
export function db() {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}
