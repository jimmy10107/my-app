import { useEffect, useState } from 'react';
import { api } from '../utils/api';

export function ConsolePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard/console').then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <div>{error}</div>;
  if (!data) return <div>載入 Console…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2>執行師 Console</h2>
      <section style={cardStyle}>
        <h3>群體摘要</h3>
        <pre>{JSON.stringify(data.summary, null, 2)}</pre>
      </section>
      <section style={cardStyle}>
        <h3>個案列表</h3>
        <pre>{JSON.stringify(data.cases, null, 2)}</pre>
      </section>
    </div>
  );
}

const cardStyle = { background: 'white', border: '1px solid #ddd3c5', borderRadius: 12, padding: 16 };
