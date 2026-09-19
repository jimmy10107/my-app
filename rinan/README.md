# 日南稻站｜Grounded in Rinan 數位互動植生牆

對應《往返 TO AND FROM》策展計畫「GROUND｜生根」展區的核心展項：觀眾以 LINE 掃碼進入 LIFF 互動頁、選一株植物並留言，經人工審核後，投影牆會即時「長出」這株植物。

流程：**LINE 官方帳號／LINE Login／LIFF → 後端驗證與審核 → Supabase（資料庫＋Realtime）→ 投影網頁即時生成**。全部是網頁，不需要現場架設主機——投影端只要用現場既有電腦開瀏覽器全螢幕即可。

## 專案結構

```text
rinan/
  frontend/          Vite + React，三個頁面：/play（互動）/wall（投影）/admin（後台）
  backend/            Express API：LIFF token 驗證、審核、人流統計
  supabase/schema.sql  資料表與 RLS 設定
  docs/SOURCES.md      往返展覽文史內容的來源／佐證台帳
```

## 三個網頁介面

| 頁面 | 路徑 | 用途 |
| --- | --- | --- |
| 互動頁 Play | `/play` | 觀眾掃 QR 進入，LINE 登入、選植物、留言、送出 |
| 投影頁 Wall | `/wall` | 現場投影機全螢幕開啟，即時顯示大家種下的植物 |
| 管理頁 Admin | `/admin` | 值班人員審核留言、查看人流統計 |

## 資料如何流動

1. 觀眾在 `/play` 完成 LINE 登入（LIFF SDK 處理），選植物、寫下一句話（60 字內）送出。
2. 前端把 LIFF 拿到的 `accessToken` 連同植物種類、留言送到後端 `POST /api/plantings`。
3. **後端**（而非前端）用這個 token 向 LINE 官方 API 驗證身分，避免有人偽造 userId 洗版，然後以 `pending` 狀態寫入 Supabase。
4. 值班人員在 `/admin` 看到待審核清單，按「通過」或「退件」。
5. `/wall` 頁面用 Supabase 的 anon key 直接訂閱 Realtime；資料庫的 Row Level Security 只允許讀到 `status = 'approved'` 的紀錄，所以一經核准就會立刻出現在投影牆上，不需要後端額外推播。
6. 入口的人流感測裝置（ESP32 + VL53L1X，未來擴充）可用共用密鑰呼叫 `POST /api/visits` 回報匿名計數，只統計人數、不做人臉辨識、不與 LINE 身分連結。

## 前置準備（目前都還沒申請，照順序做一次即可）

### 1. 建立 Supabase 專案

1. 到 https://supabase.com 註冊並建立新專案（選離台灣近的區域，如 Singapore）。
2. 專案建好後，到左側選單 **SQL Editor**，貼上 `rinan/supabase/schema.sql` 整份內容並執行，會建立 `plantings`、`visits` 兩張表與對應的 RLS 政策。
3. 到 **Settings → API**，記下：
   - `Project URL`（給前端 `VITE_SUPABASE_URL` 與後端 `SUPABASE_URL` 用）
   - `anon public` key（**只**給前端 `VITE_SUPABASE_ANON_KEY`）
   - `service_role` key（**只**給後端 `SUPABASE_SERVICE_ROLE_KEY`，絕對不要放進前端或 commit 進 git，這把 key 可以繞過所有權限檢查）

### 2. 建立 LINE 官方帳號與 LIFF App

1. 到 [LINE Official Account Manager](https://manager.line.biz/) 建立（或使用既有的）日南稻站官方帳號。
2. 到 [LINE Developers Console](https://developers.line.biz/console/)，建立一個 **Provider**，底下新增一個 **Channel**，類型選 **LINE Login**。
3. 進入該 Channel 的 **LIFF** 分頁，新增一個 LIFF App：
   - **Size**：`Full`（互動頁建議全螢幕）
   - **Endpoint URL**：先填 `https://localhost:5173/#/play`（本機測試用），部署上線後改成正式網址，例如 `https://your-domain.com/#/play`
   - **Scope**：勾選 `profile`（取得 `userId`、`displayName` 需要）
4. 建立完成後記下：
   - **LIFF ID**（`VITE_LIFF_ID`，前端用）
   - **Channel ID**（`LIFF_CHANNEL_ID`，後端用來驗證 token 是否真的屬於這個 LIFF App）
5. 把這個 Channel 底下的 LINE Login 頻道與官方帳號連動（Console 內有「Linked OA」設定），這樣觀眾在 LINE 裡開啟連結時體驗才會一致。

> LIFF 頁面在正式環境必須是 **HTTPS**，本機開發可用 `localhost`（LIFF SDK 允許）。部署到 Vercel/Netlify 等平台預設就是 HTTPS，不用額外處理。

### 3. 填入環境變數

```bash
cd rinan/backend && cp .env.example .env    # 填入 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / LIFF_CHANNEL_ID / 自訂密碼
cd ../frontend && cp .env.example .env      # 填入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_LIFF_ID
```

`ADMIN_PASSWORD`、`ADMIN_JWT_SECRET`、`VISIT_DEVICE_SECRET` 自己設定即可，不需要向外部服務申請。

## 本機啟動

```bash
# 後端
cd rinan/backend
npm install
npm run dev        # http://localhost:4001

# 前端（另開一個終端機）
cd rinan/frontend
npm install
npm run dev         # http://localhost:5173
```

開發時用手機 LINE 掃這個 LIFF 連結（`https://liff.line.me/{LIFF_ID}`）測試 `/play`；`/wall` 與 `/admin` 直接用瀏覽器開就可以，不需要在 LINE 裡面開。

## 部署建議

- **前端**：`npm run build` 產生 `dist/`，部署到 Vercel／Netlify／Cloudflare Pages 等靜態平台。記得在平台後台填入 `VITE_*` 環境變數。
- **後端**：部署到 Railway／Render／任一支援 Node.js 的平台，填入 `.env.example` 列出的所有變數。
- 部署完成後，回到 LINE Developers Console 把 LIFF 的 Endpoint URL 改成正式網址。

## 安全設計重點

- `service_role` key 只存在後端環境變數，前端與 Realtime 訂閱一律用權限受限的 `anon` key。
- 種植紀錄一律先驗證 LIFF token 再寫入，不信任前端直接回報的身分。
- 人流資料（`visits`）與互動資料（`plantings`）分表儲存，`visits` 不含任何可識別個人的欄位，也不對外開放讀取，符合個資最小化原則。
- 留言預設進 `pending`，需人工審核通過才會出現在投影牆，避免不當內容直接曝光。

## 如果某天需要停用數位互動

依《往返》製作包的備援原則：若網路、審核、投影或離線備援任一項在開展前未通過測試，直接切換成紙本共創牆，不要讓整體展覽被單一數位模組卡住。這個系統本身沒有依賴任何現場專屬硬體（除了未來選配的人流感測器），所以停用時只需要把 `/wall` 換成別的網頁或直接關閉投影即可，不影響展場其他部分。
