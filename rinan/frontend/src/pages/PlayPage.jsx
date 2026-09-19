import { useEffect, useState } from 'react';
import { ensureLoggedIn, getAccessToken } from '../lib/liff.js';
import { api } from '../lib/api.js';
import { PlantPicker } from '../components/PlantPicker.jsx';

const MESSAGE_LIMIT = 60;

export function PlayPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [plantType, setPlantType] = useState(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    ensureLoggedIn()
      .then(() => setReady(true))
      .catch((err) => setError(err.message || 'LINE 登入失敗，請重新整理頁面再試一次'));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!plantType) {
      setError('請先選一株植物');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const accessToken = getAccessToken();
      const { notice } = await api.submitPlanting({ accessToken, plantType, message });
      setResult(notice);
      setPlantType(null);
      setMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready && !error) {
    return <div className="page page--center">正在連接 LINE…</div>;
  }

  if (result) {
    return (
      <div className="page page--center">
        <h1>種下了！</h1>
        <p>{result}</p>
        <button type="button" onClick={() => setResult(null)}>
          再種一株
        </button>
      </div>
    );
  }

  return (
    <form className="page play-page" onSubmit={handleSubmit}>
      <h1>種下日南</h1>
      <p className="play-page__hint">選一株植物，留下一句話，讓它出現在投影牆上。</p>

      <PlantPicker value={plantType} onChange={setPlantType} />

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

      <button type="submit" disabled={submitting || !plantType}>
        {submitting ? '送出中…' : '種下'}
      </button>
    </form>
  );
}
