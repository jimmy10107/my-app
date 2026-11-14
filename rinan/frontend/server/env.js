// 伺服器端環境變數（在 Vercel 專案 Settings → Environment Variables 設定，本機放 .env）。
// 不在載入時就丟錯：少了變數時 API 回清楚的 503 訊息，/api/health 也會列出缺哪幾個，
// 方便在後台設定完後自己打開網址檢查，不用看主機日誌。
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'LIFF_CHANNEL_ID', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET'];

function read(name) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export const env = {
  get supabaseUrl() {
    return read('SUPABASE_URL');
  },
  get supabaseServiceRoleKey() {
    return read('SUPABASE_SERVICE_ROLE_KEY');
  },
  get liffChannelId() {
    return read('LIFF_CHANNEL_ID');
  },
  get adminPassword() {
    return read('ADMIN_PASSWORD');
  },
  get adminJwtSecret() {
    return read('ADMIN_JWT_SECRET');
  },
  // 入口人流感測器（選配）才需要；沒設定時只有 POST /api/visits 會拒絕。
  get visitDeviceSecret() {
    return read('VISIT_DEVICE_SECRET');
  },
  // 社群洞察（選配）：沒設定時只有後台「社群洞察」分頁顯示設定說明，其它功能不受影響。
  get metaPageId() {
    return read('META_PAGE_ID');
  },
  get metaPageAccessToken() {
    return read('META_PAGE_ACCESS_TOKEN');
  },
  // 留空時自動用粉專連結的 IG 專業帳號
  get metaIgUserId() {
    return read('META_IG_USER_ID');
  },
  get metaAppSecret() {
    return read('META_APP_SECRET');
  },
  // Vercel Cron 呼叫 /api/social/snapshot 時帶的密鑰（Vercel 會自動放進 Authorization header）
  get cronSecret() {
    return read('CRON_SECRET');
  },
  get metaGraphVersion() {
    return read('META_GRAPH_VERSION') || 'v25.0';
  },
};

export function missingEnv() {
  return REQUIRED.filter((name) => !read(name));
}
