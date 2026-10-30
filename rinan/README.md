# 日南稻站｜Grounded in Rinan 數位互動植生牆

對應《往返 TO AND FROM》策展計畫「GROUND｜生根」展區的核心展項：觀眾用 LINE 掃投影牆上的 QR（或點參加連結）進入 LIFF 互動頁，選一株植物、留一句話，種子就會從投影牆角落的 QR 卡片飛進花園、落地發芽；留言裡的關鍵詞會飄上天空，成為整面牆的文字雲。

流程：**LINE（LIFF）／現場平板 → `/api`（Vercel Serverless）驗證、過濾、寫入 → Supabase（資料庫＋Realtime）→ 投影牆即時生成**。網站跟 API 部署在同一個 Vercel 專案，不需要另外租主機；投影端只要用現場電腦開瀏覽器全螢幕即可。

## 專案結構

```text
rinan/
  frontend/                 一個 Vercel 專案（Root Directory 設在這裡）
    src/                    Vite + React 網頁：/play /kiosk /wall /admin
    api/index.js            Vercel Serverless Function 入口，所有 /api/* 都進這裡
    server/                 Express API 本體（LIFF token 驗證、內容過濾、後台、人流統計）
    vercel.json             把 /api/* 改寫到上面那支 Function
  supabase/schema.sql       全新專案用：資料表、RLS、Realtime 設定
  supabase/migrations/      既有專案升級用的 SQL
  docs/SOURCES.md           往返展覽文史內容的來源／佐證台帳
```

## 四個網頁介面

| 頁面 | 路徑 | 用途 |
| --- | --- | --- |
| 互動頁 Play | `/#/play` | 觀眾掃 QR 進入，LINE 登入、選植物、留言、種下，看自己的植物發芽 |
| 現場平板 Kiosk | `/#/kiosk` | 沒有 LINE 也能玩：固定在現場的平板，自己打暱稱 |
| 投影牆 Wall | `/#/wall` | 投影機全螢幕：3D 花園、天空文字雲、掃碼 QR、底部最新留言 |
| 後台 Admin | `/#/admin` | 參加連結與 QR 下載、統計、最新種下清單（一鍵下架／恢復）、CSV 匯出 |

## 資料如何流動

1. 觀眾掃投影牆上的 QR（`https://liff.line.me/{LIFF ID}`）在 LINE 裡打開 `/play`，LIFF SDK 自動登入。
2. 選植物、寫一句話（15 字內）送出，前端把 LIFF `accessToken` 連同內容送到 `POST /api/plantings`。
3. **API** 用 token 向 LINE 驗證身分（不信任前端回報的 userId），擋掉不雅字詞、10 秒內重複送出，然後直接以 `approved` 寫入 Supabase——**種下就上牆**，不用等人工審核。
4. `/wall` 用 Supabase anon key 訂閱 Realtime，新的一株幾秒內就從 QR 卡片飛進花園；另外每 10 秒再完整同步一次，就算 Realtime 斷線、或後台剛下架，牆面也會跟著更新。
5. 值班人員在 `/admin` 看到不妥的內容，按「下架」即可，投影牆 10 秒內移除；按「恢復」會重新種回去。
6. 入口的人流感測裝置（ESP32 + VL53L1X，選配）用共用密鑰呼叫 `POST /api/visits` 回報匿名計數，不做人臉辨識、不與 LINE 身分連結。

## 環境變數（Vercel → Settings → Environment Variables）

| 變數 | 給誰用 | 從哪裡拿 |
| --- | --- | --- |
| `VITE_LIFF_ID` | 網頁 | LINE Developers → LINE Login Channel → LIFF 分頁 |
| `VITE_SUPABASE_URL` | 網頁 | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | 網頁 | 同上，`anon public` key |
| `SUPABASE_URL` | API | 跟 `VITE_SUPABASE_URL` 一樣 |
| `SUPABASE_SERVICE_ROLE_KEY` | API | 同上，`service_role` key（**絕對不要**加 `VITE_` 前綴，這把 key 能繞過所有權限） |
| `LIFF_CHANNEL_ID` | API | LINE Login Channel 的 Channel ID（數字） |
| `ADMIN_PASSWORD` | API | 自訂的後台密碼 |
| `ADMIN_JWT_SECRET` | API | 自訂一長串隨機英數字 |
| `VISIT_DEVICE_SECRET` | API | 選配，人流感測裝置的共用密鑰；沒有裝置就不要設 |

`VITE_` 開頭的會被打包進網頁（只能放可以公開的資訊）；改了 `VITE_` 變數要重新部署才會生效。舊的 `VITE_API_BASE_URL` 已經用不到，可以刪掉。

部署後打開 `https://你的網域/api/health`：看到 `"ok": true, "database": "ok"` 就代表 API 跟資料庫都接好了；如果有缺，`missing` 會列出還沒設定的變數名稱。

## 第一次設定

### 1. Supabase

1. 到 https://supabase.com 建立專案（區域選 Singapore 等離台灣近的）。
2. **SQL Editor** 貼上 `rinan/supabase/schema.sql` 整份執行。
3. 已經在用的專案不用重建，只要執行 `rinan/supabase/migrations/` 裡還沒跑過的檔案（例如 `2026-10-29-instant-wall.sql`：開啟 plantings 的 Realtime、限制匿名身分只能讀投影需要的欄位）。

### 2. LINE LIFF

1. [LINE Developers Console](https://developers.line.biz/console/) → Provider → 新增 **LINE Login** Channel。
2. LIFF 分頁新增 LIFF App：Size 選 `Full`、Scope 勾 `profile`，**Endpoint URL** 填正式網址首頁，例如 `https://www.rinancommons.com/`（首頁會自動轉到互動頁）。
3. 記下 LIFF ID（`VITE_LIFF_ID`）與 Channel ID（`LIFF_CHANNEL_ID`）。
4. 把 Channel 跟日南稻站官方帳號連動（Linked OA），觀眾在 LINE 裡開啟時體驗才一致。

### 3. Vercel

1. 匯入 GitHub repo，**Root Directory** 設 `rinan/frontend`，Framework 選 Vite（會自動偵測）。
2. 填上面表格的環境變數，部署。
3. 打開 `/api/health` 確認、`/#/admin` 登入後台、`/#/wall` 全螢幕投影。

## 本機開發

```bash
cd rinan/frontend
cp .env.example .env     # 填入上面表格的變數
npm install
npm run dev:api          # API：http://localhost:4001
npm run dev              # 網頁：http://localhost:5173（另開一個終端機；/api 會自動轉給 dev:api）
```

`/wall`、`/admin`、`/kiosk` 直接用瀏覽器開；`/play` 要用手機 LINE 開 `https://liff.line.me/{LIFF ID}` 測試。

## 投影牆小抄

- 用 Chrome 開 `https://你的網域/#/wall`，按 F11 全螢幕。1080p、4K 投影都會自動依比例排版。
- 右下角 QR 就是參加連結；後台「參加連結」可以下載同一張 QR 的 PNG 印成海報或桌卡。
- 牆上同時顯示最新的 300 株；植物會依各自的生長週期一直循環生長，沒有人互動時畫面也是活的。
- 點牆上任何一株可以讀它的故事（現場有觸控螢幕時適用）。

## 安全設計重點

- `service_role` key 只在 API 的環境變數；網頁與 Realtime 一律用 `anon` key，匿名身分只能讀已上牆的植株，而且只開放投影需要的欄位（LINE userId 等不會外流）。
- 種植紀錄一律先驗證 LIFF token（或確認平板流水號真的存在）才寫入，同一人 10 秒內只能種一株，平板流水號也有發放頻率上限。
- 種下即上牆，靠自動字詞過濾＋後台一鍵下架把關；下架的內容保留在資料庫，可以隨時恢復。
- 人流資料（`visits`）與互動資料（`plantings`）分表，`visits` 不含任何可識別個人的欄位，也不對外開放讀取。

## 如果某天需要停用數位互動

依《往返》製作包的備援原則：若網路、投影或離線備援任一項在開展前未通過測試，直接切換成紙本共創牆，不要讓整體展覽被單一數位模組卡住。這個系統沒有依賴現場專屬硬體（人流感測器為選配），停用時只要關閉投影或把 `/wall` 換成別的網頁即可。
