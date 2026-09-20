import { useEffect, useRef, useState } from 'react';
import { CloseupScene, preloadGltf } from '../three/closeupScene.js';
import { closeupStagesFor } from '../lib/closeupModels.js';

const INTRO_FRAME_MS = 1500; // 4 階段 x 1.5s ≈ 6 秒，對齊「六到七秒跑完生長歷程」的目標
const DEFAULT_SLOT = 2; // 盛開，動畫結束後預設看的階段

export function PlantCloseupViewer({ plantId }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  const stages = closeupStagesFor(plantId);

  const [phase, setPhase] = useState('intro'); // 'intro' | 'interactive'
  const [introFrame, setIntroFrame] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(DEFAULT_SLOT);
  const [modelStatus, setModelStatus] = useState('loading'); // 目前這個階段的 3D 模型狀態
  const [progress, setProgress] = useState(0);
  const [retryTick, setRetryTick] = useState(0);

  // 一進彈窗：背景搶先預載四個階段的 glTF（不需要 canvas，先把資料抓回來），
  // 同時跑靜態圖 flipbook。使用者隨時可以點某個階段提早跳過動畫進互動模式。
  useEffect(() => {
    if (!stages) return undefined;
    let cancelled = false;
    setPhase('intro');
    setIntroFrame(0);
    setSelectedSlot(DEFAULT_SLOT);

    stages.forEach((stage) => {
      preloadGltf(stage.file).catch(() => {});
    });

    const timer = setInterval(() => {
      setIntroFrame((f) => {
        if (f >= stages.length - 1) {
          clearInterval(timer);
          if (!cancelled) setPhase('interactive');
          return f;
        }
        return f + 1;
      });
    }, INTRO_FRAME_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [plantId, stages]);

  // 進互動模式後才建立 WebGL 場景（intro 階段只放靜態圖，不用先開 GL context）。
  useEffect(() => {
    if (phase !== 'interactive' || !stages) return undefined;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const scene = new CloseupScene(canvas);
    sceneRef.current = scene;
    scene.resize(wrap.clientWidth, wrap.clientHeight);
    scene.start();

    const resizeObserver = new ResizeObserver(() => {
      scene.resize(wrap.clientWidth, wrap.clientHeight);
    });
    resizeObserver.observe(wrap);

    return () => {
      resizeObserver.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [phase, stages]);

  // 切換階段（互動模式下）：對應的 glTF 通常在 intro 階段已經預載完成，直接秒開；
  // 沒好的話一樣走 progress／timeout。
  useEffect(() => {
    if (phase !== 'interactive' || !stages) return undefined;
    const scene = sceneRef.current;
    if (!scene) return undefined;
    const stage = stages[selectedSlot];
    let cancelled = false;
    setModelStatus('loading');
    setProgress(0);
    scene
      .load(stage.file, stage.bounds, (ratio) => {
        if (!cancelled) setProgress(ratio);
      })
      .then(() => {
        if (!cancelled) setModelStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setModelStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [phase, selectedSlot, stages, retryTick]);

  if (!stages) return null;

  function jumpToStage(slotIndex) {
    setSelectedSlot(slotIndex);
    setPhase('interactive');
  }

  const showStill = phase === 'intro' || modelStatus !== 'ready';
  const stillSrc = phase === 'intro' ? stages[introFrame].still : stages[selectedSlot].still;

  return (
    <div className="closeup-viewer" ref={wrapRef}>
      <canvas ref={canvasRef} style={{ visibility: phase === 'interactive' ? 'visible' : 'hidden' }} />
      {showStill && <img className="closeup-viewer__still" src={stillSrc} alt="" />}

      {phase === 'intro' && (
        <div className="closeup-viewer__introbar">
          {stages.map((s, i) => (
            <span key={s.slot} className={`closeup-viewer__dot${i <= introFrame ? ' is-active' : ''}`} />
          ))}
        </div>
      )}

      {phase === 'interactive' && modelStatus === 'loading' && (
        <div className="closeup-viewer__hint">載入 3D 模型中…{progress > 0 ? `${Math.round(progress * 100)}%` : ''}</div>
      )}
      {phase === 'interactive' && modelStatus === 'error' && (
        <button type="button" className="closeup-viewer__retry" onClick={() => setRetryTick((n) => n + 1)}>
          模型載入失敗，點一下重試
        </button>
      )}
      {phase === 'interactive' && modelStatus === 'ready' && (
        <div className="closeup-viewer__tag">{stages[selectedSlot].stageLabel}．可拖曳旋轉</div>
      )}

      <div className="closeup-viewer__tabs">
        {stages.map((s, i) => (
          <button
            key={s.slot}
            type="button"
            className={`closeup-viewer__tab${phase === 'interactive' && selectedSlot === i ? ' is-selected' : ''}`}
            onClick={() => jumpToStage(i)}
          >
            {s.slot}
          </button>
        ))}
      </div>
    </div>
  );
}
