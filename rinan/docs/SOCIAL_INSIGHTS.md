# 社群洞察（Facebook 粉專＋Instagram）設定與使用

後台 `/#/admin` →「社群洞察（FB／IG）」分頁會向 Meta Graph API 讀取日南稻站粉專與連結的 IG 專業帳號數據，
跟植生牆的種植數放在一起，產生**本期 vs 上一期的 KPI、每日趨勢、洞察、後續行銷策略與下一期目標**，
並可一鍵複製成 Markdown 報告。

- 只讀不寫：不會發文、不會改粉專設定，也不碰廣告帳戶。
- 權杖只存在 Vercel 的伺服器環境變數，不會出現在網頁裡；後台要登入才看得到報表。
- 沒有設定時，其它後台功能完全不受影響，分頁裡會顯示設定步驟。

## 需要的環境變數

| 變數 | 必填 | 說明 |
| --- | --- | --- |
| `META_PAGE_ID` | 是 | 日南稻站粉專的 ID（數字） |
| `META_PAGE_ACCESS_TOKEN` | 是 | **粉專**存取權杖（不是個人的使用者權杖），長效、不會過期的那種 |
| `META_APP_SECRET` | 建議 | Meta App 的 App Secret，用來附上 `appsecret_proof`，權杖外洩也無法被單獨使用 |
| `META_IG_USER_ID` | 否 | 留空會自動抓粉專連結的 IG 專業帳號；只有要指定別的帳號才填 |
| `META_GRAPH_VERSION` | 否 | 預設 `v25.0`；Meta 停用舊版本時改這裡即可 |

填好後重新部署，打開 `https://你的網域/api/health`，回應裡的 `"social": "configured"` 就代表變數有讀到。

## 事前確認

1. IG 帳號已切換成**專業帳號**（商業或創作者），並在 Meta Business Suite 裡跟日南稻站粉專**連結**。
2. 你的 Facebook 個人帳號是粉專的管理員（或在商家資產組合裡對粉專有完整控制權）。

## 取得粉專存取權杖

### 方法 A：Graph API Explorer（最快，約 10 分鐘）

1. 到 [Meta for Developers](https://developers.facebook.com/apps) → 建立應用程式，類型選「商家」。
   應用程式維持「開發模式」即可——讀取自己管理的粉專資料不需要送審。
2. 應用程式 → 設定 → 基本資料，記下**應用程式編號**與**應用程式密鑰**（密鑰就是 `META_APP_SECRET`）。
3. 打開 [Graph API Explorer](https://developers.facebook.com/tools/explorer/)，右側選剛建立的應用程式，
   「使用者或粉絲專頁」選「取得使用者存取權杖」，勾選下列權限後按 Generate Access Token，並在跳出的視窗中勾選日南稻站粉專與 IG 帳號：
   - `pages_show_list`
   - `pages_read_engagement`
   - `read_insights`
   - `instagram_basic`
   - `instagram_manage_insights`
   - `business_management`（粉專歸在商家資產組合底下時需要）
4. 把這個短效使用者權杖換成長效（60 天）：打開 [存取權杖偵錯工具](https://developers.facebook.com/tools/debug/accesstoken/)，
   貼上權杖 → 按最下方「延伸存取權杖」。
5. 回到 Graph API Explorer，把權杖換成剛拿到的長效使用者權杖，查詢：

   ```text
   me/accounts?fields=id,name,access_token,instagram_business_account
   ```

   找到日南稻站那一筆：`id` 填 `META_PAGE_ID`，`access_token` 填 `META_PAGE_ACCESS_TOKEN`。
   有 `instagram_business_account` 就代表 IG 連結成功。
6. 把這個粉專權杖貼回偵錯工具確認「到期時間：永不」。

> 由長效使用者權杖換來的粉專權杖不會過期；但如果你更改 Facebook 密碼、移除應用程式或失去粉專管理權，權杖會失效，
> 後台會顯示「粉專權杖無效或已過期」，重做第 3～5 步即可。

### 方法 B：系統用戶權杖（給長期營運，不綁個人帳號）

Meta Business Suite → 設定 → 商家設定 → 用戶 → **系統用戶** → 新增（管理員或一般員工皆可）→
指派資產：日南稻站粉專（完整控制）與 IG 帳號 → 產生權杖，選上面建立的應用程式並勾選同樣的權限、到期時間選「永不」。
系統用戶權杖本身可以直接當成粉專權杖使用；不會因為某位同仁離職或改密碼而失效。

## 報表內容與判讀

| 區塊 | 內容 |
| --- | --- |
| 平台卡片 | FB：粉絲、觀看次數、觸及人數、貼文互動、淨增追蹤、粉專造訪；IG：粉絲、觸及帳號、觀看次數、互動帳號、總互動、新增粉絲、個人檔案連結點擊。箭頭是對上一期的變化 |
| 每日趨勢 | FB 每日觀看、IG 每日觸及、植生牆每日種植數，各自一張圖、共用日期；游標移上去看單日數字，「檢視每日數據」可展開表格 |
| 洞察 | 依規則自動判讀：成長／下滑（±20%）、互動與觸及是否同步、發文頻率、最佳格式、最佳時段與星期、文案長度、標籤、IG 收藏分享比例、**發文日 vs 非發文日的植生牆種植數** |
| 後續行銷策略 | 依洞察排出的行動清單（優先順序、時程、平台、原因、追蹤目標），加上日南稻站的四個內容支柱 |
| 下一期目標 | 觀看／觸及 +10%（下滑時先追回上一期）、建議發文數、植生牆種植數 +15% |
| 表現最好／較弱的貼文 | 依「互動指數」排序 |

**互動指數**：貼文互動率 ÷ 該平台本期互動率的中位數。1.00 代表平常水準、2.00 代表平常的兩倍。
FB 與 IG 的互動率基準差很多，用指數才能把兩個平台的貼文放在一起比較時段、星期與文案長度。
互動率優先以「觸及」當分母，拿不到觸及時改用粉絲數，並會標示「以粉絲數計」。

**樣本數**：每個分組至少 2 篇、全部至少 5 篇才下結論；只有 1 篇的分組會淡化顯示。發文少的時候，請以 28 天報表為主。

**期間**：以台灣時間午夜為界，不含今天（今天的數字還在變動）。可選近 7／14／28 天，上一期是緊接在前、等長的期間。

## Meta 指標汰換

Meta 這兩年陸續汰換洞察指標，例如 2025 年 11 月起粉專 `impressions` 改為 `views`（`page_media_view`），
2026 年起多數 `*_unique` 觸及改為 `page_total_media_view_unique`；IG 的帳號層級 `impressions` 也已由 `views` 取代。
系統查詢時會先整批要、失敗再逐一重試，失效的指標自動略過並列在洞察最後一則「Meta 有部分指標目前拿不到」，
其它數字照常顯示。如果某個重要指標長期拿不到，到 `rinan/frontend/server/lib/socialCollect.js` 開頭的指標清單換成 Meta 的新名稱即可。

已知限制：

- IG 的 `follower_count`（每日新增粉絲）只提供最近 30 天，所以 28 天報表的上一期通常顯示「無上期資料」，屬正常。
- FB「觸及人數」是每日不重複人數的加總，跨日會重複計算同一個人，適合看趨勢、不適合當絕對人數。
- 貼文的觸及等洞察只抓本期貼文；上一期貼文只用來計算發文頻率。
- 報表在伺服器上快取 15 分鐘；按「重新抓取」會略過快取。

## 程式位置

```text
rinan/frontend/
  server/lib/meta.js            Graph API 用戶端（appsecret_proof、分頁、指標失效容錯）
  server/lib/socialCollect.js   抓 FB／IG／植生牆資料，整理成本期 vs 上一期
  server/lib/socialAnalysis.js  洞察與策略規則（純函式）、Markdown 報告
  server/routes/social.js       GET /api/social/report?days=7|14|28（需後台登入）
  src/components/SocialInsights.jsx、TrendChart.jsx   後台分頁畫面
  tests/socialInsights.test.js  用模擬的 Graph API 回應測整條流程
```
