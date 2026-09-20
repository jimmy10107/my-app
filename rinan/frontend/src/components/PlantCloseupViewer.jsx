import { useEffect, useRef, useState } from 'react';
import { CloseupScene } from '../three/closeupScene.js';
import { closeupModelFor } from '../lib/closeupModels.js';

export function PlantCloseupViewer({ plantId }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [status, setStatus] = useState('loading');

  const model = closeupModelFor(plantId);

  useEffect(() => {
    if (!model) return undefined;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const scene = new CloseupScene(canvas);
    sceneRef.current = scene;
    scene.resize(wrap.clientWidth, wrap.clientHeight);
    scene.start();

    setStatus('loading');
    scene
      .load(model.file, model.bounds)
      .then(() => setStatus('ready'))
      .catch(() => setStatus('error'));

    const resizeObserver = new ResizeObserver(() => {
      scene.resize(wrap.clientWidth, wrap.clientHeight);
    });
    resizeObserver.observe(wrap);

    return () => {
      resizeObserver.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [model]);

  if (!model) return null;

  return (
    <div className="closeup-viewer" ref={wrapRef}>
      <canvas ref={canvasRef} />
      {status === 'loading' && <div className="closeup-viewer__hint">載入 3D 模型中…</div>}
      {status === 'error' && <div className="closeup-viewer__hint">模型載入失敗，可稍後重試</div>}
      {status === 'ready' && <div className="closeup-viewer__tag">{model.stageLabel}．可拖曳旋轉</div>}
    </div>
  );
}
