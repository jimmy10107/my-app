import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { plantById } from '../lib/plants.js';
import { PlantIcon } from '../components/PlantIcon.jsx';

// 用固定亂數種子把每一筆種植紀錄映射到畫面上的位置，
// 這樣同一筆資料重新整理後也會出現在差不多的地方，看起來像一片持續生長的田。
function positionFor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const left = 6 + (hash % 88);
  const top = 15 + ((hash >> 8) % 70);
  return { left: `${left}%`, top: `${top}%` };
}

export function WallPage() {
  const [plantings, setPlantings] = useState([]);
  const [latestMessage, setLatestMessage] = useState(null);
  const messageTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('plantings')
      .select('id, plant_type, message, created_at')
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
          announce(row);
        }
      )
      .subscribe();

    function announce(row) {
      setLatestMessage(row);
      clearTimeout(messageTimer.current);
      messageTimer.current = setTimeout(() => setLatestMessage(null), 8000);
    }

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearTimeout(messageTimer.current);
    };
  }, []);

  return (
    <div className="page wall-page">
      <header className="wall-page__header">
        <h1>Grounded in Rinan｜日南生根</h1>
        <p>{plantings.length} 株，一起長出來的日南</p>
      </header>

      <div className="wall-page__garden">
        {plantings.map((planting) => {
          const plant = plantById(planting.plant_type);
          const pos = positionFor(planting.id);
          return (
            <div key={planting.id} className="wall-page__plant" style={pos} title={plant?.name}>
              <PlantIcon type={planting.plant_type} color={plant?.color} size={36} />
            </div>
          );
        })}
      </div>

      {latestMessage && (
        <div className="wall-page__ticker">
          {plantById(latestMessage.plant_type)?.name}：{latestMessage.message || '（沒有留言）'}
        </div>
      )}
    </div>
  );
}
