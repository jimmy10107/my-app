const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000; // 台灣不實施日光節約時間，固定 UTC+8

// 伺服器（Vercel）跑在 UTC，直接 setHours(0) 會變成台灣早上 8 點才換日；
// 「今日」統計一律以台灣午夜為界。
export function startOfTaipeiDay(now = Date.now()) {
  const taipei = new Date(now + TAIPEI_OFFSET_MS);
  taipei.setUTCHours(0, 0, 0, 0);
  return new Date(taipei.getTime() - TAIPEI_OFFSET_MS);
}
