import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { plantById } from '../lib/plants.js';
import { matchingPlantings, mergeSearchResults, searchPlantings, SEARCH_LIMIT } from '../lib/plantSearch.js';

const plantedTime = (value) => new Date(value).toLocaleString('zh-TW', {
  timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

export function PlantSearch({ rows, selectedEntry, locating, locationError, onLocate, onClear, onReadStory }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [remote, setRemote] = useState({ query: '', rows: [], loading: false, error: false });
  const inputRef = useRef(null);
  const toggleRef = useRef(null);
  const keyword = input.trim();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || !keyword) return undefined;
    let cancelled = false;
    setRemote({ query: keyword, rows: [], loading: true, error: false });
    const timer = setTimeout(() => {
      searchPlantings(supabase, keyword).then(
        (found) => !cancelled && setRemote({ query: keyword, rows: found, loading: false, error: false }),
        () => !cancelled && setRemote({ query: keyword, rows: [], loading: false, error: true })
      );
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [keyword, open]);

  const current = remote.query === keyword ? remote : { rows: [], loading: Boolean(keyword), error: false };
  const results = useMemo(() => mergeSearchResults([
    ...matchingPlantings(rows, keyword), ...current.rows,
  ], keyword), [rows, keyword, current.rows]);

  function close() {
    setOpen(false);
    toggleRef.current?.focus();
  }

  async function locate(row) {
    if (await onLocate(row)) close();
  }

  return (
    <section className="plant-search" aria-label="尋找種下的植物" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
    }}>
      <button type="button" className="plant-search__toggle" ref={toggleRef}
        aria-expanded={open} aria-controls="plant-search-panel" onClick={() => open ? close() : setOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg>
        找我的植物
      </button>
      {open && (
        <div className="plant-search__panel" id="plant-search-panel">
          <div className="plant-search__heading"><strong>找回你種下的那一株</strong>
            <button type="button" onClick={close} aria-label="關閉植物搜尋">✕</button>
          </div>
          <label htmlFor="plant-search-input">輸入姓名、暱稱、留言或植物名稱</label>
          <input ref={inputRef} id="plant-search-input" type="search" value={input} maxLength={80}
            placeholder="例如：鄭宜豪、皮皮、芋頭" autoComplete="off"
            onChange={(event) => setInput(event.target.value)} />
          <p className="plant-search__status" role="status">
            {!keyword ? '搜尋後，點選結果就能定位植物。' : current.loading ? '搜尋中…' : current.error
              ? '連線不穩，先顯示目前花園中的結果。請稍後重新開啟搜尋。'
              : results.length ? results.length === SEARCH_LIMIT ? '顯示前 30 株，可用更完整的姓名或留言縮小範圍。'
                : `找到 ${results.length} 株，點選即可定位。`
                : '找不到符合的植物，試試其他暱稱或留言關鍵字。'}
          </p>
          {keyword && results.length > 0 && <ul className="plant-search__results">
            {results.map((row) => <li key={row.id}>
              <button type="button" disabled={locating} aria-pressed={selectedEntry?.id === row.id}
                onClick={() => locate(row)}>
                <strong>{row.display_name || '日南的一位朋友'}的{plantById(row.plant_type)?.name || '植物'}</strong>
                {row.message && <span className="plant-search__message">「{row.message}」</span>}
                <span className="plant-search__time">{plantedTime(row.created_at)} 種下 · 定位 →</span>
              </button>
            </li>)}
          </ul>}
        </div>
      )}
      {locating && <p className="plant-search__feedback" role="status">正在定位植物…</p>}
      {locationError && <p className="plant-search__feedback" role="alert">{locationError}</p>}
      {selectedEntry && <div className="plant-search__selection">
        <span role="status">已定位 · {selectedEntry.display_name || '日南的一位朋友'}的{plantById(selectedEntry.plant_type)?.name}</span>
        <div><button type="button" onClick={() => onReadStory(selectedEntry)}>看植物簡介</button>
          <button type="button" onClick={onClear}>回到整座花園</button></div>
      </div>}
    </section>
  );
}
