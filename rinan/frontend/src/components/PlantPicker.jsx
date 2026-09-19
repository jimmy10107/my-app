import { PLANTS } from '../lib/plants.js';
import { PlantIcon } from './PlantIcon.jsx';

export function PlantPicker({ value, onChange }) {
  return (
    <div className="plant-picker">
      {PLANTS.map((plant) => (
        <button
          key={plant.id}
          type="button"
          className={`plant-picker__item${value === plant.id ? ' plant-picker__item--selected' : ''}`}
          onClick={() => onChange(plant.id)}
        >
          <PlantIcon type={plant.id} color={plant.color} size={40} />
          <span className="plant-picker__name">{plant.name}</span>
          <span className="plant-picker__meaning">{plant.meaning}</span>
        </button>
      ))}
    </div>
  );
}
