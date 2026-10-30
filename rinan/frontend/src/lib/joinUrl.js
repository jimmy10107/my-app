// 投影牆 QR、後台「參加連結」共用的入口網址。有 LIFF ID 就用 LINE 的 LIFF 網址
// （手機掃了會直接在 LINE 裡開啟、自動登入）；本機開發沒設定時退回網頁版互動頁。
const LIFF_ID = import.meta.env.VITE_LIFF_ID;

export const JOIN_URL = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : `${window.location.origin}/#/play`;
