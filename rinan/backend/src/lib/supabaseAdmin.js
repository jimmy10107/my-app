import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// service role key：只在後端使用，可繞過 RLS，因此所有寫入與審核都經過這支 client。
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
