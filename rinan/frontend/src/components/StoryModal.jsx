import { PlantCloseupViewer } from './PlantCloseupViewer.jsx';

export function StoryModal({ plant, displayName, onClose }) {
  if (!plant) return null;
  const planterName = displayName?.trim();
  return (
    <div className="story-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="story-card">
        <button type="button" className="story-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
        <PlantCloseupViewer plantId={plant.id} />
        <div className="story-head">
          <div>
            <div className="story-role">{plant.role}</div>
            <div className="story-name">{planterName ? `${planterName}的${plant.name}` : plant.name}</div>
            <div className="story-meaning">象徵｜{plant.meaning}</div>
          </div>
        </div>
        <div className="story-body">{plant.desc}</div>
      </div>
    </div>
  );
}
