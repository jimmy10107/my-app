import { useRef } from 'react';
import { PlantCloseupViewer } from './PlantCloseupViewer.jsx';
import { PlantShareButton } from './PlantShareButton.jsx';

export function StoryModal({ plant, displayName, onClose }) {
  const viewerRef = useRef(null);
  if (!plant) return null;
  const planterName = displayName?.trim();
  return (
    <div className="story-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="story-card">
        <button type="button" className="story-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
        <PlantCloseupViewer key={plant.id} plantId={plant.id} ref={viewerRef} />
        <div className="story-head">
          <div>
            <div className="story-role">{plant.role}</div>
            <div className="story-name">{planterName ? `${planterName}的${plant.name}` : plant.name}</div>
            <div className="story-meaning">象徵｜{plant.meaning}</div>
          </div>
        </div>
        {planterName && <PlantShareButton key={`${plant.id}:${planterName}`} plant={plant} displayName={planterName}
          capturePlant={() => viewerRef.current?.captureFrame()} />}
        <div className="story-body">{plant.desc}</div>
      </div>
    </div>
  );
}
