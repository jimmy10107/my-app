import { useState } from 'react';
import { PlantPicker } from './PlantPicker.jsx';
import { StoryModal } from './StoryModal.jsx';

const MESSAGE_LIMIT = 60;
const NICKNAME_LIMIT = 16;

// Play（有 LINE 暱稱可選）與 Kiosk（只能自己打暱稱）共用同一份表單，
// 差別只在有沒有傳入 lineDisplayName。
export function PlantingForm({ lineDisplayName, onSubmit, submitting, error }) {
  const [plantType, setPlantType] = useState(null);
  const [message, setMessage] = useState('');
  const [useLineName, setUseLineName] = useState(Boolean(lineDisplayName));
  const [customNickname, setCustomNickname] = useState('');
  const [storyPlant, setStoryPlant] = useState(null);

  const nickname = (useLineName && lineDisplayName ? lineDisplayName : customNickname).trim();
  const canSubmit = Boolean(plantType) && nickname.length > 0 && !submitting;

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ plantType, message, nickname });
  }

  return (
    <form className="page play-page" onSubmit={handleSubmit}>
      <h1>種下日南</h1>

      <div className="nickname-field">
        {lineDisplayName ? (
          <>
            <span className="nickname-field__label">要怎麼稱呼你？</span>
            <label className="nickname-field__option">
              <input type="radio" checked={useLineName} onChange={() => setUseLineName(true)} />
              使用 LINE 暱稱「{lineDisplayName}」
            </label>
            <label className="nickname-field__option">
              <input type="radio" checked={!useLineName} onChange={() => setUseLineName(false)} />
              自己打暱稱
            </label>
            {!useLineName && (
              <input
                className="nickname-field__input"
                value={customNickname}
                maxLength={NICKNAME_LIMIT}
                placeholder="例如：皮皮"
                onChange={(e) => setCustomNickname(e.target.value)}
              />
            )}
          </>
        ) : (
          <label className="nickname-field__solo">
            你的暱稱（會顯示在投影牆上）
            <input
              className="nickname-field__input"
              value={customNickname}
              maxLength={NICKNAME_LIMIT}
              placeholder="例如：皮皮"
              onChange={(e) => setCustomNickname(e.target.value)}
            />
          </label>
        )}
      </div>

      <p className="play-page__hint">選一株植物，留下一句話，讓它出現在投影牆上。</p>

      <PlantPicker value={plantType} onChange={setPlantType} onReadStory={setStoryPlant} />

      <label className="play-page__message-label">
        留一句話（{message.length}/{MESSAGE_LIMIT}）
        <textarea
          value={message}
          maxLength={MESSAGE_LIMIT}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="什麼讓你想到日南？"
        />
      </label>

      {error && <p className="page__error">{error}</p>}

      <button type="submit" disabled={!canSubmit}>
        {submitting ? '送出中…' : '種下'}
      </button>

      <StoryModal plant={storyPlant} onClose={() => setStoryPlant(null)} />
    </form>
  );
}
