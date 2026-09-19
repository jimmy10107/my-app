// 生長週期：幼苗(0) → 生長(1) → 盛開(2) → 凋萎(3) → 回到幼苗，循環不停。
// 讓投影牆即使沒有新的互動，也一直是「活的」，不會停在同一個畫面。
const STAGE_FRACTIONS = [0.12, 0.4, 0.62, 0.88];

function smoothstep(a, b, x) {
  if (a === b) return x < a ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * 計算某一筆種下紀錄在目前時間的生長狀態。
 * @param {number} cycleSeconds 該植物完整生長一輪需要的秒數
 * @param {number} createdAtMs 種下時間（epoch ms）
 * @param {number} nowMs 目前時間（epoch ms）
 */
export function growthState(cycleSeconds, createdAtMs, nowMs) {
  const cycleMs = cycleSeconds * 1000;
  let progress = ((nowMs - createdAtMs) % cycleMs) / cycleMs;
  if (progress < 0) progress += 1;

  const [s1, s2, s3, s4] = STAGE_FRACTIONS;
  let scale;
  let opacity;
  let formA;
  let formB;
  let formT;

  if (progress < s1) {
    const t = smoothstep(0, s1, progress);
    scale = 0.08 + t * 0.5;
    opacity = t;
    formA = 0;
    formB = 0;
    formT = 0;
  } else if (progress < s2) {
    const t = smoothstep(s1, s2, progress);
    scale = 0.55 + t * 0.45;
    opacity = 1;
    formA = 0;
    formB = 1;
    formT = t;
  } else if (progress < s3) {
    const local = (progress - s2) / (s3 - s2);
    const wave = Math.sin(local * Math.PI);
    scale = 1 + wave * 0.08;
    opacity = 1;
    formA = 1;
    formB = 2;
    formT = smoothstep(0, 1, local);
  } else if (progress < s4) {
    const t = smoothstep(s3, s4, progress);
    scale = 1 - t * 0.35;
    opacity = 1 - t * 0.55;
    formA = 2;
    formB = 3;
    formT = t;
  } else {
    const t = smoothstep(s4, 1, progress);
    scale = 0.3 * (1 - t) + 0.04;
    opacity = 0.35 * (1 - t);
    formA = 3;
    formB = 3;
    formT = 0;
  }

  return { scale, opacity, formA, formB, formT };
}
