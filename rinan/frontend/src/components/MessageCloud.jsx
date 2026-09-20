import { plantById } from '../lib/plants.js';

// 投影頁下方 15% 的文字雲跑馬燈。清單重複一次＋CSS animation 位移 -50%，
// 做成視覺上無縫循環的跑馬燈，不用量測文字寬度。
export function MessageCloud({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="message-cloud message-cloud--empty">
        <span>還沒有人留言——掃碼種下第一句話</span>
      </div>
    );
  }

  const track = [...entries, ...entries];

  return (
    <div className="message-cloud">
      <div className="message-cloud__track">
        {track.map((entry, i) => {
          const plant = plantById(entry.plant_type);
          return (
            <span
              key={`${entry.id}-${i}`}
              className="message-cloud__pill"
              style={{ borderColor: plant?.color }}
            >
              <strong style={{ color: plant?.color }}>{entry.display_name || plant?.name}</strong>
              {entry.message && <span className="message-cloud__text">「{entry.message}」</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
