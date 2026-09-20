import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { plantById } from '../lib/plants.js';
import { GardenScene } from '../three/scene.js';
import { StoryModal } from '../components/StoryModal.jsx';
import { MessageCloud } from '../components/MessageCloud.jsx';

export function WallPage() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const plantingsRef = useRef([]);

  const [plantings, setPlantings] = useState([]);
  const [storyPlant, setStoryPlant] = useState(null);

  // Three.js 場景只需要建立一次；資料更新時用 setEntries() 局部同步，
  // 不重新建立整個 WebGL context（避免每次 realtime 事件都重新編譯 shader）。
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const scene = new GardenScene(canvas, {
      onSelect: (entryId) => {
        const row = plantingsRef.current.find((p) => p.id === entryId);
        if (row) setStoryPlant(plantById(row.plant_type));
      },
    });
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
  }, []);

  useEffect(() => {
    plantingsRef.current = plantings;
    sceneRef.current?.setEntries(plantings);
  }, [plantings]);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('plantings')
      .select('id, plant_type, display_name, message, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setPlantings(data);
      });

    const channel = supabase
      .channel('wall-plantings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plantings', filter: 'status=eq.approved' },
        (payload) => {
          const row = payload.new;
          setPlantings((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // 文字雲只要最近的一批，太多的話跑馬燈會繞太久才重複，越晚種下的排越前面。
  const cloudEntries = useMemo(() => plantings.slice(-40).reverse(), [plantings]);

  return (
    <div className="wall-page">
      <div className="wall-page__stage-wrap" ref={wrapRef}>
        <header className="wall-page__header">
          <span className="wall-page__eyebrow">TO AND FROM｜日南稻站</span>
          <h1>Grounded in Rinan｜日南生根</h1>
          <p>{plantings.length} 株，一起長出來的日南 — 點一株看看它的故事</p>
        </header>
        <canvas ref={canvasRef} />
      </div>

      <MessageCloud entries={cloudEntries} />

      <StoryModal plant={storyPlant} onClose={() => setStoryPlant(null)} />
    </div>
  );
}
