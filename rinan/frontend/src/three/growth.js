// 18 分鐘一輪：幼苗 → 生長 → 峰值 → 凋零 → 淡出再生。
// 前五個節點每三分鐘推進一次，讓新種下與既有植株能在牆上形成清楚的生命階段差異。
const STAGE_FRACTIONS = [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6];

function smoothstep(a, b, x) {
  if (a === b) return x < a ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * 計算某一筆種下紀錄在目前時間的生長狀態。
 * @param {number} cycleSeconds 該植物完整生長一輪需要的秒數（本展設定為 18 分鐘）
 * @param {number} createdAtMs 種下時間（epoch ms）
 * @param {number} nowMs 目前時間（epoch ms）
 */
export function growthState(cycleSeconds, createdAtMs, nowMs) {
  const cycleMs = cycleSeconds * 1000;
  // 牆面電腦的時鐘可能比資料庫慢幾秒；負時間一律從幼苗開始，不繞回週期尾端。
  const progress = (Math.max(0, nowMs - createdAtMs) % cycleMs) / cycleMs;
  const [seedlingEnd, earlyGrowthEnd, fullGrowthEnd, peakEnd, wiltEnd] = STAGE_FRACTIONS;
  let scale;
  let opacity;
  let formA;
  let formB;
  let formT;

  if (progress < seedlingEnd) {
    const t = smoothstep(0, seedlingEnd, progress);
    scale = 0.12 + t * 0.38;
    opacity = 0.78 + t * 0.22;
    formA = 0;
    formB = 0;
    formT = 0;
  } else if (progress < earlyGrowthEnd) {
    const t = smoothstep(seedlingEnd, earlyGrowthEnd, progress);
    scale = 0.5 + t * 0.25;
    opacity = 1;
    formA = 0;
    formB = 1;
    formT = t;
  } else if (progress < fullGrowthEnd) {
    const t = smoothstep(earlyGrowthEnd, fullGrowthEnd, progress);
    scale = 0.75 + t * 0.24;
    opacity = 1;
    formA = 1;
    formB = 1;
    formT = 0;
  } else if (progress < peakEnd) {
    const t = smoothstep(fullGrowthEnd, peakEnd, progress);
    scale = 0.99 + t * 0.09;
    opacity = 1;
    formA = 1;
    formB = 2;
    formT = t;
  } else if (progress < wiltEnd) {
    const t = smoothstep(peakEnd, wiltEnd, progress);
    scale = 1.08 - t * 0.28;
    opacity = 1 - t * 0.12;
    formA = 2;
    formB = 3;
    formT = t;
  } else {
    const t = smoothstep(wiltEnd, 1, progress);
    scale = 0.8 * (1 - t) + 0.04;
    opacity = 0.88 * (1 - t);
    formA = 3;
    formB = 3;
    formT = 0;
  }

  return { scale, opacity, formA, formB, formT };
}
