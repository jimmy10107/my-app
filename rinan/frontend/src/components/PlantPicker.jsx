import { PLANTS } from '../lib/plants.js';
import { PlantIcon } from './PlantIcon.jsx';

export function PlantPicker({ value, onChange, onReadStory }) {
  return (
    <div className="plant-picker">
      {PLANTS.map((plant) => (
        <div
          key={plant.id}
          className={`plant-picker__item${value === plant.id ? ' plant-picker__item--selected' : ''}`}
        >
          <button type="button" className="plant-picker__select" onClick={() => onChange(plant.id)}>
            <PlantIcon type={plant.id} color={plant.color} size={40} />
            <span className="plant-picker__name">{plant.name}</span>
            <span className="plant-picker__meaning">{plant.meaning}</span>
          </button>
          <button type="button" className="plant-picker__story-btn" onClick={() => onReadStory(plant)}>
            讀故事
          </button>
        </div>
      ))}
    </div>
  );
}
