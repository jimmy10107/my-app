import { useEffect, useRef, useState } from 'react';
import { CloseupScene, preloadGltf } from '../three/closeupScene.js';
import { closeupStagesFor } from '../lib/closeupModels.js';

const FRAME_MS = 2400; // flipbook 逐格間隔，放慢到有「定格欣賞」的感受，而不是一閃而過
const MAX_INTRO_MS = 26000; // 保底上限：真的卡住也不能讓使用者永遠卡在動畫
const ZONE_COUNT = 4;
const DEFAULT_SLIDER = 60; // 落在「盛開」區間，動畫結束後預設看的形態

function zoneForSlider(value) {
  return Math.min(ZONE_COUNT - 1, Math.floor((value / 100) * ZONE_COUNT));
}

export function PlantCloseupViewer({ plantId }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  const stages = closeupStagesFor(plantId);

  const [phase, setPhase] = useState('intro'); // 'intro' | 'ready'
  const [introFrame, setIntroFrame] = useState(0);
  const [sliderValue, setSliderValue] = useState(DEFAULT_SLIDER);
  const [activeZone, setActiveZone] = useState(zoneForSlider(DEFAULT_SLIDER));
  const [modelStatus, setModelStatus] = useState('loading');
  const [progress, setProgress] = useState(0);
  const [retryTick, setRetryTick] = useState(0);

  // 四個階段的 glTF「一起」平行預載（不是點了才一個一個載），flipbook 至少播
  // MIN_INTRO_MS，全部載完（或超過 MAX_INTRO_MS 保底逾時）才會解鎖 3D／滑輪／縮放。
  useEffect(() => {
    if (!stages) return undefined;
    let cancelled = false;
    setPhase('intro');
    setIntroFrame(0);
    setSliderValue(DEFAULT_SLIDER);
    setActiveZone(zoneForSlider(DEFAULT_SLIDER));

    // 至少完整播完一輪生長歷程（絲滑淡入淡出、每格都定格欣賞一下）才會結束，
    // 就算模型早就載完也不提前切斷；真的卡住則靠 MAX_INTRO_MS 保底。
    const minIntroMs = stages.length * FRAME_MS;
    const startedAt = Date.now();
    const loadAll = Promise.all(stages.map((stage) => preloadGltf(stage.file).catch(() => null)));

    const frameTimer = setInterval(() => {
      setIntroFrame((f) => (f + 1) % stages.length);
    }, FRAME_MS);

    let settleTimer;
    const finishIntro = () => {
      if (cancelled) return;
      clearInterval(frameTimer);
      clearTimeout(settleTimer);
      setPhase('ready');
    };

    loadAll.then(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, minIntroMs - elapsed);
      settleTimer = setTimeout(finishIntro, remaining);
    });
    const hardCap = setTimeout(finishIntro, MAX_INTRO_MS);

    return () => {
      cancelled = true;
      clearInterval(frameTimer);
      clearTimeout(settleTimer);
      clearTimeout(hardCap);
    };
  }, [plantId, stages]);

  // 進 ready 階段才建立 WebGL 場景／掛 OrbitControls，intro 期間完全不能互動。
  useEffect(() => {
    if (phase !== 'ready' || !stages) return undefined;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const scene = new CloseupScene(canvas);
    sceneRef.current = scene;
    // 用 canvas 自己的 clientHeight（CSS 已經扣掉底部滑桿高度），
    // 不要用整個 wrapper 的高度，避免內部渲染解析度跟實際顯示尺寸對不上而變形。
    const syncSize = () => scene.resize(canvas.clientWidth, canvas.clientHeight);
    syncSize();
    scene.start();

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(wrap);

    return () => {
      resizeObserver.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [phase, stages]);

  // 滑輪跨過某個區間門檻才換模型（模型此時通常早已預載完成，幾乎秒切）；
  // 區間內拖曳不重新載入，只是同一顆模型繼續轉動。
  useEffect(() => {
    if (phase !== 'ready' || !stages) return undefined;
    const scene = sceneRef.current;
    if (!scene) return undefined;
    const stage = stages[activeZone];
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
  }, [phase, activeZone, stages, retryTick]);

  if (!stages) return null;

  function handleSlider(event) {
    const value = Number(event.target.value);
    setSliderValue(value);
    const zone = zoneForSlider(value);
    if (zone !== activeZone) setActiveZone(zone);
  }

  const showStill = phase === 'intro' || modelStatus !== 'ready';
  const activeStillIndex = phase === 'intro' ? introFrame : activeZone;

  return (
    <div className="closeup-viewer" ref={wrapRef}>
      <canvas ref={canvasRef} style={{ visibility: phase === 'ready' ? 'visible' : 'hidden' }} />
      {/* 四張圖疊在一起用 opacity 交叉淡入淡出，絲滑無縫接軌，不是直接切換 src 的硬切。 */}
      <div className={`closeup-viewer__stills${showStill ? '' : ' is-hidden'}`}>
        {stages.map((s, i) => (
          <img
            key={s.slot}
            src={s.still}
            alt=""
            className={`closeup-viewer__still${i === activeStillIndex ? ' is-active' : ''}`}
          />
        ))}
      </div>

      {phase === 'intro' && (
        <div className="closeup-viewer__introbar">
          {stages.map((s, i) => (
            <span key={s.slot} className={`closeup-viewer__dot${i === introFrame ? ' is-active' : ''}`} />
          ))}
        </div>
      )}

      {phase === 'ready' && modelStatus === 'loading' && (
        <div className="closeup-viewer__hint">載入中…{progress > 0 ? `${Math.round(progress * 100)}%` : ''}</div>
      )}
      {phase === 'ready' && modelStatus === 'error' && (
        <button type="button" className="closeup-viewer__retry" onClick={() => setRetryTick((n) => n + 1)}>
          模型載入失敗，點一下重試
        </button>
      )}
      {phase === 'ready' && modelStatus === 'ready' && (
        <div className="closeup-viewer__tag">{stages[activeZone].stageLabel}．可拖曳旋轉／縮放</div>
      )}

      {phase === 'ready' ? (
        <div className="closeup-viewer__slider">
          <input
            type="range"
            min={0}
            max={100}
            value={sliderValue}
            onChange={handleSlider}
            className="closeup-viewer__range"
          />
          <div className="closeup-viewer__slider-labels">
            {stages.map((s) => (
              <span key={s.slot}>{s.slot}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="closeup-viewer__slider closeup-viewer__slider--locked">
          <div className="closeup-viewer__range closeup-viewer__range--disabled" />
          <div className="closeup-viewer__slider-labels">
            {stages.map((s) => (
              <span key={s.slot}>{s.slot}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
