import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { JOIN_URL } from '../lib/joinUrl.js';
import { closeupStagesFor } from '../lib/closeupModels.js';
import { canSharePlantPhoto, createPlantShareCanvas, loadShareImage, plantShareDetails, pngDataUrlToFile } from '../lib/plantShare.js';

export function PlantShareButton({ plant, displayName, capturePlant, onSharingChange }) {
  const [assets, setAssets] = useState(null);
  const [preparingError, setPreparingError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('');
  const details = plantShareDetails(plant, displayName, JOIN_URL);

  useEffect(() => { onSharingChange?.(sharing); }, [sharing, onSharingChange]);

  useEffect(() => () => {
    if (preview?.downloadUrl) URL.revokeObjectURL(preview.downloadUrl);
  }, [preview?.downloadUrl]);

  useEffect(() => {
    let cancelled = false;
    setAssets(null); setPreparingError(false);
    const stages = closeupStagesFor(plant.id);
    const fonts = document.fonts?.load('900 58px "Noto Serif TC"', `${details.name}一起種下日南吧`).catch(() => {});
    Promise.all([
      loadShareImage(stages[2].still),
      QRCode.toDataURL(JOIN_URL, { width: 240, margin: 2, errorCorrectionLevel: 'M',
        color: { dark: '#231f20', light: '#f6f2e8' } }).then(loadShareImage),
      Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 1500))]),
    ]).then(
      ([photo, qrImage]) => !cancelled && setAssets({ photo, qrImage }),
      () => !cancelled && setPreparingError(true)
    );
    return () => { cancelled = true; };
  }, [plant.id, details.name, retry]);

  async function share() {
    if (!assets || sharing) return;
    setSharing(true); setStatus('');
    try {
      const snapshot = capturePlant?.();
      const compose = (photo, stageLabel) => createPlantShareCanvas({ plant, name: details.name,
        photo, stageLabel, qrImage: assets.qrImage });
      let canvas;
      try {
        canvas = snapshot?.image && compose(snapshot.image, snapshot.stageLabel);
      } catch { /* 3D 畫布遺失或尚未完成時，使用已載好的植物照片。 */ }
      if (!canvas) canvas = compose(assets.photo, closeupStagesFor(plant.id)[2].stageLabel);
      const imageUrl = canvas.toDataURL('image/png');
      const file = pngDataUrlToFile(imageUrl, details.filename);
      setPreview({ imageUrl, downloadUrl: URL.createObjectURL(file), file, text: details.text });
      if (canSharePlantPhoto(file)) {
        // 在第一次 await 前開啟分享選單，避免手機遺失本次按鈕點擊的授權。
        await navigator.share({ files: [file], title: details.title, text: details.text });
        setStatus('已開啟分享照片；也可以儲存圖片或複製下方邀請文字。');
      } else {
        setStatus('照片已準備好，儲存後就能傳給朋友；也可以複製下方邀請文字。');
      }
    } catch (error) {
      if (error.name !== 'AbortError') setStatus('暫時無法開啟分享。若下方已有照片，可直接儲存並複製文字；或再試一次。');
    } finally { setSharing(false); }
  }

  async function copyInvitation() {
    try { await navigator.clipboard.writeText(preview.text); setStatus('邀請文字已複製，貼給朋友就能一起種下日南。'); }
    catch { setStatus('請長按下方邀請文字，選取並複製。'); }
  }

  return (
    <div className="plant-share">
      <button className="plant-share__main" type="button" disabled={!assets || sharing} onClick={share}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" /></svg>
        {sharing ? '正在開啟分享…' : !assets && !preparingError ? '正在準備分享照片…' : '分享照片給朋友'}
      </button>
      {preparingError && <p className="plant-share__status" role="alert">照片暫時載入失敗。<button type="button" onClick={() => setRetry((value) => value + 1)}>重新準備照片</button></p>}
      {status && <p className="plant-share__status" role="status">{status}</p>}
      {preview && <div className="plant-share__preview">
        <img src={preview.imageUrl} alt={`${details.name}的分享照片，附有「一起種下日南吧」及種植入口 QR Code`} />
        <div className="plant-share__actions">
          <a href={preview.downloadUrl} download={preview.file.name}>儲存分享照片</a>
          <button type="button" onClick={copyInvitation}>複製邀請文字</button>
        </div>
        <textarea readOnly aria-label="分享邀請文字" value={preview.text} rows={4} />
        <p className="plant-share__hint">也可以長按照片儲存，再傳給朋友。</p>
      </div>}
    </div>
  );
}
