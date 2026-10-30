import { useCallback, useEffect, useState } from 'react';
import { ensureLoggedIn, getAccessToken, getProfile } from '../lib/liff.js';
import { api } from '../lib/api.js';
import { PlantingForm } from '../components/PlantingForm.jsx';
import { PlantedScreen } from '../components/PlantedScreen.jsx';

export function PlayPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [displayName, setDisplayName] = useState(null);

  useEffect(() => {
    ensureLoggedIn()
      .then(() => {
        setReady(true);
        // 暱稱只用來預填「使用 LINE 暱稱」選項，拿不到也不擋主要功能。
        getProfile()
          .then((profile) => setDisplayName(profile.displayName))
          .catch(() => {});
      })
      .catch((err) => setError(err.message || 'LINE 登入失敗，請重新整理頁面再試一次'));
  }, []);

  const handleAgain = useCallback(() => setResult(null), []);

  async function handleSubmit({ plantType, message, nickname }) {
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
      const accessToken = getAccessToken();
      const { notice } = await api.submitPlanting({ accessToken, plantType, message, nickname });
      setResult({ notice, plantType, message: message.trim(), nickname });
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
    return <PlantedScreen {...result} onAgain={handleAgain} />;
  }

  return (
    <PlantingForm lineDisplayName={displayName} onSubmit={handleSubmit} submitting={submitting} error={error} />
  );
}
