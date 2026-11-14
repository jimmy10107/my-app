import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { plantById } from '../lib/plants.js';
import { buildCloud } from '../lib/wordCloud.js';
import { GardenScene } from '../three/scene.js';
import { StoryModal } from '../components/StoryModal.jsx';
import { WordCloud } from '../components/WordCloud.jsx';
import { JoinCard } from '../components/JoinCard.jsx';
import { MessageTicker } from '../components/MessageTicker.jsx';
import { BackgroundMusic } from '../components/BackgroundMusic.jsx';
import { PlantSearch } from '../components/PlantSearch.jsx';
import { linkedPlantingId } from '../lib/plantingLink.js';

const WALL_LIMIT = 300; // 牆上同時長最新的 300 株，再多畫面會擠成一團
const POLL_MS = 10000; // 即時通道之外的保底同步：漏接的新植株、後台下架的植株都靠這個對齊
const FRESH_MS = 15000; // 剛落地那則留言的詞在天空亮多久
const COLUMNS = 'id, plant_type, display_name, message, created_at';

function byCreatedAt(a, b) {
  if (a.created_at === b.created_at) return a.id < b.id ? -1 : 1;
  return a.created_at < b.created_at ? -1 : 1;
}

export function WallPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPlantId = linkedPlantingId(searchParams);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const tooltipRef = useRef(null);
  const sceneRef = useRef(null);
  const rowsRef = useRef([]);
  const prevIdsRef = useRef(null);
  const hoveredIdRef = useRef(null);
  const locationMarkerRef = useRef(null);
  const locateRequestRef = useRef(0);

  const [rows, setRows] = useState(null); // null：第一次讀取還沒回來
  const [total, setTotal] = useState(0);
  const [flyingIds, setFlyingIds] = useState(() => new Set());
  const [freshIds, setFreshIds] = useState(() => new Set());
  const [launching, setLaunching] = useState(false);
  const [offline, setOffline] = useState(false);
  const [storyEntry, setStoryEntry] = useState(null);
  const [hoveredPlant, setHoveredPlant] = useState(null);
  const [locatedEntry, setLocatedEntry] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

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
        if (row) setStoryEntry(row);
      },
      onFocusPosition: (point) => {
        const marker = locationMarkerRef.current;
        if (!marker) return;
        marker.style.visibility = point ? 'visible' : 'hidden';
        if (!point) return;
        marker.style.left = `${point.x}px`;
        marker.style.top = `${point.y}px`;
        marker.style.setProperty('--plant-height', `${Math.max(20, point.y - point.topY)}px`);
      },
      onHover: (entryId, point) => {
        if (!entryId || !point) {
          hoveredIdRef.current = null;
          setHoveredPlant(null);
          return;
        }
        const row = rowsRef.current.find((p) => p.id === entryId);
        if (!row) return;
        const stage = stageRef.current;
        const tooltip = tooltipRef.current;
        if (stage && tooltip) {
          const left = Math.max(8, Math.min(point.x + 16, stage.clientWidth - 250));
          const top = Math.max(8, Math.min(point.y + 16, stage.clientHeight - 88));
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;
        }
        if (hoveredIdRef.current !== entryId) {
          hoveredIdRef.current = entryId;
          setHoveredPlant({
            displayName: row.display_name || '日南的一位朋友',
            plantName: plantById(row.plant_type)?.name || '植物',
          });
        }
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
      locateRequestRef.current += 1;
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
    if (!rows && !locatedEntry) return;
    const visibleRows = rows ?? [];
    // 搜尋到較早的紀錄時暫時帶回花園，不改動總數、文字雲或新種植動畫。
    const gardenRows = locatedEntry && !visibleRows.some((row) => row.id === locatedEntry.id)
      ? [...visibleRows, locatedEntry] : visibleRows;
    rowsRef.current = gardenRows;
    // 開機時已經在牆上的植株直接長好；之後才出現的會先飛進花園，落地之後
    // 才算數（文字雲、留言條、總數都等落地那一刻才更新，畫面上的順序才對得起來）。
    const ids = new Set(visibleRows.map((r) => r.id));
    const firstLoad = prevIdsRef.current === null;
    const newIds = firstLoad ? [] : [...ids].filter((id) => !prevIdsRef.current.has(id));
    if (rows) prevIdsRef.current = ids;
    // 還在飛就被下架的植株永遠不會落地，順手從清單拿掉
    setFlyingIds((prev) => {
      const kept = [...prev].filter((id) => ids.has(id));
      if (newIds.length === 0 && kept.length === prev.size) return prev;
      return new Set([...kept, ...newIds]);
    });
    sceneRef.current?.setEntries(gardenRows, {
      existingIds: new Set(firstLoad ? gardenRows.map((row) => row.id) : locatedEntry ? [locatedEntry.id] : []),
    });
  }, [rows, locatedEntry]);

  useEffect(() => {
    sceneRef.current?.focusEntry(locatedEntry?.id ?? null);
  }, [locatedEntry]);

  // 較早的搜尋結果不在最新 300 株裡，也要遵守後台下架及更名的同步。
  useEffect(() => {
    const id = locatedEntry?.id;
    if (!id) return undefined;
    let cancelled = false;
    let inflight = false;
    const timer = setInterval(async () => {
      if (inflight || document.visibilityState === 'hidden') return;
      inflight = true;
      try {
        const { data, error } = await supabase.from('plantings').select(COLUMNS)
          .eq('id', id).eq('status', 'approved').maybeSingle();
        if (cancelled || error) return;
        if (!data) {
          setLocatedEntry((current) => current?.id === id ? null : current);
          setStoryEntry((current) => current?.id === id ? null : current);
          setLocationError('這株植物目前未公開，請搜尋其他紀錄。');
        } else {
          setLocatedEntry((current) => current?.id === id &&
            (current.display_name !== data.display_name || current.message !== data.message || current.plant_type !== data.plant_type)
            ? data : current);
        }
      } catch {
        // 暫時離線時保留目前定位，下次同步再確認公開狀態。
      } finally {
        inflight = false;
      }
    }, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [locatedEntry?.id]);

  const locatePlant = useCallback(async (entry) => {
    const request = ++locateRequestRef.current;
    setLocating(true);
    setLocationError('');
    try {
      const result = await supabase.from('plantings').select(COLUMNS)
        .eq('id', entry.id).eq('status', 'approved').maybeSingle();
      if (request !== locateRequestRef.current) return false;
      if (result.error) throw result.error;
      if (!result.data) {
        setLocationError('這株植物目前未公開，請搜尋其他紀錄。');
        return false;
      }
      setHoveredPlant(null);
      setStoryEntry(null);
      setLocatedEntry(result.data);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('plant', result.data.id);
        return next;
      }, { replace: true });
      return true;
    } catch {
      if (request === locateRequestRef.current) setLocationError('暫時無法定位，請再試一次。');
      return false;
    } finally {
      if (request === locateRequestRef.current) setLocating(false);
    }
  }, [setSearchParams]);

  useEffect(() => {
    if (requestedPlantId && requestedPlantId !== locatedEntry?.id) locatePlant({ id: requestedPlantId });
  }, [requestedPlantId, locatedEntry?.id, locatePlant]);

  function clearLocation() {
    locateRequestRef.current += 1;
    setLocatedEntry(null);
    setLocating(false);
    setLocationError('');
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('plant');
      return next;
    }, { replace: true });
  }

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
          <h1><span className="wall__title-en">Grounded in Rinan</span><span>日南生根</span></h1>
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
        <div className="wall__gesture-hint" aria-hidden="true"><span>↕ ↔</span> 拖曳探索花園</div>
        <PlantSearch rows={rows ?? []} selectedEntry={locatedEntry} locating={locating}
          locationError={locationError} onLocate={locatePlant} onClear={clearLocation} onReadStory={setStoryEntry} />
        {locatedEntry && <div className="wall__located-marker" ref={locationMarkerRef}>
          <span className="wall__located-ring" aria-hidden="true" />
          <span className="wall__located-line" aria-hidden="true" />
          <button type="button" onClick={() => setStoryEntry(locatedEntry)}>
            {locatedEntry.display_name || '日南的一位朋友'}的{plantById(locatedEntry.plant_type)?.name}
          </button>
        </div>}
        <div
          className={`wall__plant-tooltip${hoveredPlant ? ' wall__plant-tooltip--visible' : ''}`}
          ref={tooltipRef}
          role="status"
          aria-live="polite"
        >
          <span>種下這株的人</span>
          <strong>{hoveredPlant?.displayName}</strong>
          <span>{hoveredPlant?.plantName}</span>
        </div>
        <JoinCard ref={cardRef} highlight={launching} />
        <MessageTicker entries={tickerEntries} />
        <BackgroundMusic />
      </div>

      <StoryModal
        plant={storyEntry ? plantById(storyEntry.plant_type) : null}
        displayName={storyEntry?.display_name?.trim() || '日南的一位朋友'}
        onClose={() => setStoryEntry(null)}
      />
    </div>
  );
}
