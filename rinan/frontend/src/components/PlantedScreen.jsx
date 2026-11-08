import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { plantById } from '../lib/plants.js';
import { closeupStagesFor } from '../lib/closeupModels.js';
import { StoryModal } from './StoryModal.jsx';
import { PlantShareButton } from './PlantShareButton.jsx';
import { wallPathForPlanting } from '../lib/plantingLink.js';

const STILL_MS = 2400; // 跟讀故事彈窗的生長 flipbook 同一個節奏：每張停一下，交叉淡入
const SPROUT_STAGES = 3; // 幼苗 → 生長 → 盛開，不放凋萎（剛種下的不該看到它枯掉）

// 種下之後的畫面（Play 與 Kiosk 共用）：用預先渲染的生長靜態圖播一段發芽，
// 提醒抬頭看投影牆——同一時間，牆上的種子正從 QR 卡片飛進花園。
export function PlantedScreen({ plantType, plantingId, nickname, message, notice, onAgain, autoReturnSeconds }) {
  const plant = plantById(plantType);
  const stages = (closeupStagesFor(plantType) ?? []).slice(0, SPROUT_STAGES);
  const stills = stages.map((stage) => stage.still);
  const stillsRef = useRef([]);
  const [frame, setFrame] = useState(0);
  const [storyOpen, setStoryOpen] = useState(false);
  const [sharingPhoto, setSharingPhoto] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(autoReturnSeconds ?? null);

  useEffect(() => {
    if (stills.length < 2) return undefined;
    const timer = setInterval(() => setFrame((f) => (f + 1) % stills.length), STILL_MS);
    return () => clearInterval(timer);
  }, [stills.length]);

  // 現場平板：沒人操作一段時間就自動回到表單，給下一位訪客
  useEffect(() => {
    if (!autoReturnSeconds || storyOpen || sharingPhoto) return undefined;
    const deadline = Date.now() + autoReturnSeconds * 1000;
    setSecondsLeft(autoReturnSeconds);
    const timer = setInterval(() => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(timer);
        onAgain();
      } else {
        setSecondsLeft(left);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [autoReturnSeconds, storyOpen, sharingPhoto, onAgain]);

  return (
    <div className="page planted">
      <span className="planted__eyebrow">PLANTED｜種下了</span>

      <div className="planted__stage" aria-hidden="true">
        <div className="planted__halo" />
        {stills.map((src, i) => (
          <img key={src} src={src} alt="" ref={(image) => { stillsRef.current[i] = image; }}
            className={`planted__still${i === frame ? ' is-active' : ''}`} />
        ))}
      </div>

      <h1 className="planted__title">
        你的<span style={{ color: plant?.color }}>{plant?.name}</span>正在發芽
      </h1>
      <p className="planted__notice">{notice || '抬頭看看投影牆：種子正從 QR 卡片飛進花園，落地就會發芽。'}</p>

      <figure className="planted__card">
        {message ? <blockquote>「{message}」</blockquote> : <blockquote className="is-empty">（沒有留言）</blockquote>}
        <figcaption>
          {nickname}．{plant?.meaning}的{plant?.name}
        </figcaption>
      </figure>

      <Link className="planted__wall-link" to={wallPathForPlanting(plantingId)}>
        {plantingId ? '在牆上定位我的植物 →' : '看整座花園 →'}
      </Link>
      <PlantShareButton plant={plant} displayName={nickname} onSharingChange={setSharingPhoto}
        capturePlant={() => {
          const image = stillsRef.current[frame];
          return image?.complete && image.naturalWidth ? { image, stageLabel: stages[frame].stageLabel } : null;
        }} />
      <div className="planted__actions">
        <button type="button" className="planted__secondary" onClick={() => setStoryOpen(true)}>
          讀{plant?.name}的故事
        </button>
        <button type="button" onClick={onAgain}>
          再種一株
        </button>
      </div>
      {secondsLeft !== null && !storyOpen && !sharingPhoto && <p className="planted__countdown">{secondsLeft} 秒後回到首頁</p>}

      <StoryModal plant={storyOpen ? plant : null} displayName={nickname} onClose={() => setStoryOpen(false)} />
    </div>
  );
}
