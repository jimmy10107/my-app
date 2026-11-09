import liff from '@line/liff';

const LIFF_ID = import.meta.env.VITE_LIFF_ID;

let initPromise = null;

// 整個互動頁只需要 init 一次；重複呼叫 liff.init 是安全的，但共用同一個 promise
// 可以避免畫面上多個元件同時觸發初始化造成競爭。
export function initLiff() {
  if (!initPromise) {
    initPromise = liff.init({ liffId: LIFF_ID }).catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function ensureLoggedIn({ loginIfNeeded = false } = {}) {
  await initLiff();
  if (!liff.isLoggedIn()) {
    // 一般網址進來先提供「在 LINE 開啟」，網頁登入只在使用者點選後執行。
    // LIFF 瀏覽器的登入由 init 自動完成，不另外導向帳號密碼頁。
    if (!loginIfNeeded) return false;
    liff.login({ redirectUri: window.location.href });
    // login() 會導頁離開，這裡回傳一個不會 resolve 的 promise 讓呼叫端停在載入狀態即可
    return new Promise(() => {});
  }
  return true;
}

export function getAccessToken() {
  return liff.getAccessToken();
}

export async function getProfile() {
  await initLiff();
  return liff.getProfile();
}

export function isInClient() {
  return liff.isInClient();
}
