export const SHARE_INVITATION = '一起種下日南吧';

export function plantShareDetails(plant, displayName, joinUrl) {
  const owner = displayName?.trim() || '日南的一位朋友';
  const name = `${owner}的${plant.name}`;
  const filename = `${name}-日南生根.png`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
  return { name, filename, title: `${name}｜${SHARE_INVITATION}`,
    text: `我在日南種下了「${name}」。\n${SHARE_INVITATION}！\n${joinUrl}` };
}

export function loadShareImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error('照片載入逾時')); }, 12000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('照片載入失敗')); };
    image.src = src;
  });
}

// 裁去透明邊界，讓特寫畫布與不同大小的植物素材都能清楚出現在分享照片中。
function plantBounds(source) {
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  if (!width || !height) throw new Error('植物照片尚未準備好');
  const sample = document.createElement('canvas');
  const scale = Math.min(1, 640 / width);
  sample.width = Math.max(1, Math.round(width * scale));
  sample.height = Math.max(1, Math.round(height * scale));
  const ctx = sample.getContext('2d');
  ctx.drawImage(source, 0, 0, sample.width, sample.height);
  const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
  let left = sample.width, right = -1, top = sample.height, bottom = -1;
  for (let y = 0; y < sample.height; y += 2) {
    for (let x = 0; x < sample.width; x += 2) {
      if (pixels[(y * sample.width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('植物照片尚未準備好');
  const padding = 12;
  left = Math.max(0, left - padding); top = Math.max(0, top - padding);
  right = Math.min(sample.width, right + padding); bottom = Math.min(sample.height, bottom + padding);
  return [left / scale, top / scale, (right - left) / scale, (bottom - top) / scale];
}

function textLines(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const character of Array.from(text)) {
    if (line && ctx.measureText(line + character).width > maxWidth) { lines.push(line); line = ''; }
    line += character;
  }
  if (line) lines.push(line);
  return lines;
}

export function createPlantShareCanvas({ plant, name, photo, qrImage, stageLabel }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  const serif = '"Noto Serif TC", "Noto Sans TC", serif';
  const sans = '"Noto Sans TC", sans-serif';
  ctx.fillStyle = '#1d1814'; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#dfb46e'; ctx.font = `500 26px ${sans}`;
  ctx.fillText('GROUNDED IN RINAN', 80, 76);
  ctx.fillStyle = '#f6f2e8'; ctx.font = `700 38px ${serif}`;
  ctx.fillText('日南稻站｜日南生根', 80, 132);
  ctx.strokeStyle = '#6e5b3b'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 165); ctx.lineTo(1000, 165); ctx.stroke();

  const glow = ctx.createRadialGradient(540, 480, 20, 540, 510, 490);
  glow.addColorStop(0, '#463d29'); glow.addColorStop(1, '#1d1814');
  ctx.fillStyle = glow; ctx.fillRect(50, 180, 980, 640);
  const [sx, sy, sw, sh] = plantBounds(photo);
  const scale = Math.min(840 / sw, 580 / sh);
  ctx.drawImage(photo, sx, sy, sw, sh, (1080 - sw * scale) / 2, 200 + (580 - sh * scale) / 2, sw * scale, sh * scale);
  ctx.fillStyle = '#dfb46e'; ctx.font = `500 26px ${sans}`;
  ctx.fillText(stageLabel ? `我的植物・${stageLabel}` : '我在日南種下的一株植物', 80, 830);

  let fontSize = 58;
  let lines;
  do { ctx.font = `900 ${fontSize}px ${serif}`; lines = textLines(ctx, name, 920); fontSize -= 2; }
  while (lines.length > 2 && fontSize >= 30);
  ctx.fillStyle = '#f6f2e8';
  lines.forEach((line, index) => ctx.fillText(line, 80, 910 + index * 76));
  ctx.fillStyle = '#c1b79f'; ctx.font = `500 30px ${sans}`;
  ctx.fillText(`象徵｜${plant.meaning}`, 80, 1040);

  ctx.fillStyle = '#f6f2e8'; ctx.fillRect(0, 1090, 1080, 260);
  ctx.fillStyle = '#231f20'; ctx.font = `900 52px ${serif}`;
  ctx.fillText(SHARE_INVITATION, 80, 1174);
  ctx.font = `500 29px ${sans}`;
  ctx.fillText('在往返之間，認識日南。', 80, 1232);
  ctx.fillStyle = '#66543a'; ctx.font = `500 25px ${sans}`;
  ctx.fillText('掃碼，換你種一株 →', 80, 1292);
  ctx.drawImage(qrImage, 800, 1124, 190, 190);
  return canvas;
}

// 同步轉成 File，分享按鈕不用等待網路或 toBlob，保留手機要求的點擊授權。
export function pngDataUrlToFile(dataUrl, filename) {
  if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('分享照片格式錯誤');
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (character) => character.charCodeAt(0));
  return new File([bytes], filename, { type: 'image/png' });
}

export function canSharePlantPhoto(file, browserNavigator = navigator) {
  try { return Boolean(browserNavigator.share && browserNavigator.canShare?.({ files: [file] })); }
  catch { return false; }
}
