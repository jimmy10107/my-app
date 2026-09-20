import { useEffect, useRef, useState } from 'react';
import { CloseupScene } from '../three/closeupScene.js';
import { closeupModelFor } from '../lib/closeupModels.js';

export function PlantCloseupViewer({ plantId }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [progress, setProgress] = useState(0);
  const [retryTick, setRetryTick] = useState(0);

  const model = closeupModelFor(plantId);

  useEffect(() => {
    if (!model) return undefined;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const scene = new CloseupScene(canvas);
    sceneRef.current = scene;
    scene.resize(wrap.clientWidth, wrap.clientHeight);
    scene.start();

    let cancelled = false;
    setStatus('loading');
    setProgress(0);
    scene
      .load(model.file, model.bounds, (ratio) => {
        if (!cancelled) setProgress(ratio);
      })
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    const resizeObserver = new ResizeObserver(() => {
      scene.resize(wrap.clientWidth, wrap.clientHeight);
    });
    resizeObserver.observe(wrap);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [model, retryTick]);

  if (!model) return null;

  return (
    <div className="closeup-viewer" ref={wrapRef}>
      <canvas ref={canvasRef} />
      {status === 'loading' && (
        <div className="closeup-viewer__hint">載入 3D 模型中…{progress > 0 ? `${Math.round(progress * 100)}%` : ''}</div>
      )}
      {status === 'error' && (
        <button type="button" className="closeup-viewer__retry" onClick={() => setRetryTick((n) => n + 1)}>
          模型載入失敗，點一下重試
        </button>
      )}
      {status === 'ready' && <div className="closeup-viewer__tag">{model.stageLabel}．可拖曳旋轉</div>}
    </div>
  );
}
