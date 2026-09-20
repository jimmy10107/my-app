import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { PlantingForm } from '../components/PlantingForm.jsx';

// 現場固定平板用，不需要 LINE。一進頁面就跟後端要一組流水編號（同時計一次人流），
// 之後同一次平板使用期間送出的每一株都算同一個編號，直到頁面被重新整理／重置。
export function KioskPage() {
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api
      .createKioskSession()
      .then(({ sessionId: id }) => setSessionId(id))
      .catch((err) => setError(err.message || '無法連線，請通知工作人員'));
  }, []);

  async function handleSubmit({ plantType, message, nickname }) {
    if (!sessionId) {
      setError('尚未取得互動編號，請稍候再試');
      return;
    }
    if (!plantType) {
      setError('請先選一株植物');
      return;
    }
    if (!nickname) {
      setError('請填寫暱稱');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { notice } = await api.submitPlanting({ kioskSessionId: sessionId, plantType, message, nickname });
      setResult(notice);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!sessionId && !error) {
    return <div className="page page--center">連線中…</div>;
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

  return <PlantingForm onSubmit={handleSubmit} submitting={submitting} error={error} />;
}
