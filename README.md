# 薪資水瓶｜Git 部署正式版骨架

這份專案把原本 Apps Script 部署思路，改成 **Git 可管理、前後端分離、Google Sheets API 作為正式資料存取層** 的版本。

## 對應規格書
- 角色分層：Guest / Member / Facilitator
- 會員登入後預設進 Dashboard
- 執行師登入後進 Console
- 四階段完整探索流程
- Session / Module / Version / Report / Snapshot 正式結構
- Google Sheets 同步與 integration_jobs / export_logs / usage_logs 留痕

## 專案結構

```text
salary-bottle-git-app/
  backend/     # Express API + JWT + Google Sheets API
  frontend/    # Vite React 前端
  .env.example
  README.md
```

## 你現在的 Git 狀態
你提供的指令代表：
1. 原本 `git push` 被拒絕，是因為遠端 `main` 比本地多內容。
2. 你後來用 `git push --force` 已成功覆蓋遠端。
3. 之後 `git config --global http.sslVerify true` 已把 SSL 驗證恢復。
4. 最後 `git push` 顯示 `Everything up-to-date`，代表目前本地與遠端已同步。

## 建議部署方式

### A. 後端
部署到任一支援 Node.js 的平台，例如：
- Railway
- Render
- VPS / Docker
- 你自己的伺服器

啟動指令：
```bash
cd backend
npm install
npm run start
```

### B. 前端
部署到任一可從 Git 自動建置的靜態平台：
- Vercel
- Netlify
- Cloudflare Pages
- 任何支援 Vite build 的平台

建置指令：
```bash
cd frontend
npm install
npm run build
```

輸出目錄：
```text
dist
```

## Google Sheets API 設定

### 1. 建立 Service Account
在 Google Cloud Console：
- 啟用 Google Sheets API
- 建立 Service Account
- 下載金鑰 JSON

### 2. 將 Sheet 分享給 Service Account Email
把你的 Google Sheet 分享給：
```text
service-account@your-project.iam.gserviceaccount.com
```
至少給 Editor 權限。

### 3. 設定環境變數
把 `.env.example` 複製成 `.env`，填入：
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SPREADSHEET_ID`
- `JWT_SECRET`
- `FRONTEND_URL`
- `VITE_API_BASE_URL`

## 啟動順序

### 後端
```bash
cd backend
npm install
npm run dev
```

### 前端
```bash
cd frontend
npm install
npm run dev
```

## 預設帳號
系統啟動時會自動建立一個執行師帳號：
```text
Email: facilitator@example.com
Password: Password123!
```

## 與既有 Google Sheet 欄位完全對接的方法
如果你現有欄位名稱 **已經和規格書一致**，這版可直接對接。

如果你的既有欄位名稱不完全一致，請修改：
```text
backend/src/config/sheetSchema.js
```
這裡是目前所有 Sheet tab 與欄位映射的唯一入口。

## 下一步建議
1. 先把這份專案推上 GitHub。
2. 先部署 backend，取得 API URL。
3. 把 `VITE_API_BASE_URL` 指向 backend。
4. 測試註冊、登入、建立 session、完成 snapshot。
5. 再依你現有 Google Sheet 欄位進行精準欄位映射。

## 你下一輪最值得做的兩件事
- 把 `sheetSchema.js` 改成你的真實欄位名。
- 把 ExplorationPage 換成你原本完整卡牌 UI。
