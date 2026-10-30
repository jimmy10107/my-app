import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { plantById } from '../lib/plants.js';
import { buildCloud } from '../lib/wordCloud.js';
import { GardenScene } from '../three/scene.js';
import { StoryModal } from '../components/StoryModal.jsx';
import { WordCloud } from '../components/WordCloud.jsx';
import { JoinCard } from '../components/JoinCard.jsx';
import { MessageTicker } from '../components/MessageTicker.jsx';

const WALL_LIMIT = 300; // 牆上同時長最新的 300 株，再多畫面會擠成一團
const POLL_MS = 10000; // 即時通道之外的保底同步：漏接的新植株、後台下架的植株都靠這個對齊
const FRESH_MS = 15000; // 剛落地那則留言的詞在天空亮多久
const COLUMNS = 'id, plant_type, display_name, message, created_at';

function byCreatedAt(a, b) {
  if (a.created_at === b.created_at) return a.id < b.id ? -1 : 1;
  return a.created_at < b.created_at ? -1 : 1;
}

export function WallPage() {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const sceneRef = useRef(null);
  const rowsRef = useRef([]);
  const prevIdsRef = useRef(null);

  const [rows, setRows] = useState(null); // null：第一次讀取還沒回來
  const [total, setTotal] = useState(0);
  const [flyingIds, setFlyingIds] = useState(() => new Set());
  const [freshIds, setFreshIds] = useState(() => new Set());
  const [launching, setLaunching] = useState(false);
  const [offline, setOffline] = useState(false);
  const [storyPlant, setStoryPlant] = useState(null);

  // Three.js 場景只建立一次；資料更新時用 setEntries() 局部同步，
  // 不重新建立整個 WebGL context（避免每次有人種下都重新編譯 shader）。
  useEffect(() => {
    const stage = stageRef.current;
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };

    const scene = new GardenScene(canvasRef.current, {
      overlay: overlayRef.current,
      onSelect: (entryId) => {
        const row = rowsRef.current.find((p) => p.id === entryId);
        if (row) setStoryPlant(plantById(row.plant_type));
      },
      onLaunch: () => {
        setLaunching(true);
        later(() => setLaunching(false), 1600);
      },
      onLanded: (row) => {
        setFlyingIds((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
        setFreshIds((prev) => new Set(prev).add(row.id));
        later(
          () =>
            setFreshIds((prev) => {
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            }),
          FRESH_MS
        );
      },
    });
    sceneRef.current = scene;

    // 種子從 QR 卡片的 QR 中間飛出來；手機版沒有 QR 時從卡片中間
    const layout = () => {
      scene.resize(stage.clientWidth, stage.clientHeight);
      const card = cardRef.current;
      if (!card) return;
      const qr = card.querySelector('.join-card__qr');
      const box = stage.getBoundingClientRect();
      const r = (qr && qr.offsetWidth > 0 ? qr : card).getBoundingClientRect();
      scene.setArrivalOrigin(r.left - box.left + r.width / 2, r.top - box.top + r.height / 2);
    };
    layout();
    scene.start();

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(stage);
    if (cardRef.current) resizeObserver.observe(cardRef.current);

    return () => {
      resizeObserver.disconnect();
      timers.forEach(clearTimeout);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // 資料：先讀最新 300 株＋總數；之後即時通道（Supabase Realtime）一有新植株就推進來，
  // 另外每 10 秒再完整對一次，即時通道沒開、斷線或後台下架時牆面一樣會更新。
  useEffect(() => {
    let cancelled = false;
    let inflight = false;
    const receivedAt = new Map();

    async function refresh() {
      if (inflight || document.visibilityState === 'hidden') return;
      inflight = true;
      const startedAt = Date.now();
      const [list, count] = await Promise.all([
        supabase
          .from('plantings')
          .select(COLUMNS)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(WALL_LIMIT),
        supabase.from('plantings').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      ]);
      inflight = false;
      if (cancelled) return;
      if (list.error) {
        setOffline(true);
        return;
      }
      setOffline(false);
      const ids = new Set(list.data.map((r) => r.id));
      // 這次查詢送出之後才從即時通道進來的植株，查詢結果本來就看不到，先留著別拿掉
      setRows((prev) =>
        [...list.data, ...(prev ?? []).filter((r) => !ids.has(r.id) && (receivedAt.get(r.id) ?? 0) > startedAt)].sort(
          byCreatedAt
        )
      );
      if (typeof count.count === 'number') setTotal(count.count);
    }

    function accept(row) {
      if (!row?.id || row.status !== 'approved') return;
      if (rowsRef.current.some((r) => r.id === row.id)) return;
      receivedAt.set(row.id, Date.now());
      const picked = {
        id: row.id,
        plant_type: row.plant_type,
        display_name: row.display_name,
        message: row.message,
        created_at: row.created_at,
      };
      setRows((prev) => (prev && !prev.some((r) => r.id === row.id) ? [...prev, picked].sort(byCreatedAt) : prev));
      setTotal((t) => t + 1);
    }

    refresh();
    const interval = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);

    const channel = supabase
      .channel('wall-plantings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'plantings' }, (payload) => accept(payload.new))
      // 後台把下架的植株恢復時是 UPDATE；下架本身看不到（匿名身分讀不到下架的資料），交給定時同步拿掉
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'plantings' }, (payload) => accept(payload.new))
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!rows) return;
    rowsRef.current = rows;
    // 開機時已經在牆上的植株直接長好；之後才出現的會先飛進花園，落地之後
    // 才算數（文字雲、留言條、總數都等落地那一刻才更新，畫面上的順序才對得起來）。
    const ids = new Set(rows.map((r) => r.id));
    const newIds = prevIdsRef.current === null ? [] : [...ids].filter((id) => !prevIdsRef.current.has(id));
    prevIdsRef.current = ids;
    // 還在飛就被下架的植株永遠不會落地，順手從清單拿掉
    setFlyingIds((prev) => {
      const kept = [...prev].filter((id) => ids.has(id));
      if (newIds.length === 0 && kept.length === prev.size) return prev;
      return new Set([...kept, ...newIds]);
    });
    sceneRef.current?.setEntries(rows);
  }, [rows]);

  const landed = useMemo(() => (rows ?? []).filter((r) => !flyingIds.has(r.id)), [rows, flyingIds]);
  // 資料還沒回來前天空先空著：第一次排版就用真的資料，大詞才會在正中間
  const cloudWords = useMemo(() => (rows ? buildCloud(landed, { freshIds, limit: 30 }) : []), [rows, landed, freshIds]);
  const tickerEntries = useMemo(() => landed.slice(-31).reverse(), [landed]);
  const shownTotal = rows ? Math.max(landed.length, total - (rows.length - landed.length)) : null;

  return (
    <div className="wall">
      <div className="wall__stage" ref={stageRef}>
        <canvas className="wall__canvas" ref={canvasRef} />
        <canvas className="wall__overlay" ref={overlayRef} />
      </div>

      <div className="wall__hud">
        <header className="wall__header">
          <span className="wall__eyebrow">TO AND FROM｜往返．日南稻站</span>
          <h1>Grounded in Rinan｜日南生根</h1>
          <p>
            {shownTotal === null ? (
              '花園甦醒中…'
            ) : (
              <>
                <strong>{shownTotal}</strong> 株，一起長出來的日南
              </>
            )}
            {offline && <span className="wall__offline">連線不穩，重新連線中</span>}
          </p>
        </header>

        <WordCloud words={cloudWords} />
        <JoinCard ref={cardRef} highlight={launching} />
        <MessageTicker entries={tickerEntries} />
      </div>

      <StoryModal plant={storyPlant} onClose={() => setStoryPlant(null)} />
    </div>
  );
}
