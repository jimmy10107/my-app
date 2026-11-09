import { useCallback, useEffect, useState } from 'react';
import { ensureLoggedIn, getAccessToken, getProfile } from '../lib/liff.js';
import { api } from '../lib/api.js';
import { PlantingForm } from '../components/PlantingForm.jsx';
import { PlantedScreen } from '../components/PlantedScreen.jsx';
import { LineEntry } from '../components/LineEntry.jsx';

export function PlayPage() {
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [displayName, setDisplayName] = useState(null);

  useEffect(() => {
    let active = true;
    ensureLoggedIn()
      .then((loggedIn) => {
        if (!active || !loggedIn) return;
        setReady(true);
        // 暱稱只用來預填「使用 LINE 暱稱」選項，拿不到也不擋主要功能。
        getProfile()
          .then((profile) => { if (active) setDisplayName(profile.displayName); })
          .catch(() => {});
      })
      .catch(() => {
        if (active) setConnectionError('暫時無法連接 LINE，請點上方按鈕重新開啟。');
      })
      .finally(() => { if (active) setConnecting(false); });
    return () => { active = false; };
  }, []);

  async function handleBrowserLogin() {
    setConnecting(true);
    setConnectionError(null);
    try {
      await ensureLoggedIn({ loginIfNeeded: true });
      setReady(true);
      getProfile().then((profile) => setDisplayName(profile.displayName)).catch(() => {});
    } catch {
      setConnectionError('網頁登入暫時無法使用，請點上方按鈕在 LINE 開啟。');
    } finally {
      setConnecting(false);
    }
  }

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
      const { notice, planting } = await api.submitPlanting({ accessToken, plantType, message, nickname });
      setResult({ notice, plantType, message: message.trim(), nickname, plantingId: planting?.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <LineEntry loading={connecting} error={connectionError} onBrowserLogin={handleBrowserLogin} />;
  }

  if (result) {
    return <PlantedScreen {...result} onAgain={handleAgain} />;
  }

  return (
    <PlantingForm lineDisplayName={displayName} onSubmit={handleSubmit} submitting={submitting} error={error} />
  );
}
