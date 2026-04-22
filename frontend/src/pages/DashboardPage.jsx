import { useEffect, useState } from 'react';
import { api } from '../utils/api';

export function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard/member').then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <div>{error}</div>;
  if (!data) return <div>載入 Dashboard…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2>會員 Dashboard</h2>
      <section style={cardStyle}>
        <h3>最近一次快照</h3>
        <pre>{JSON.stringify(data.latestSnapshot, null, 2)}</pre>
      </section>
      <section style={cardStyle}>
        <h3>建議下一步</h3>
        <ul>{data.nextActions.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section style={cardStyle}>
        <h3>最新工具報表</h3>
        <pre>{JSON.stringify(data.latestRuns, null, 2)}</pre>
      </section>
    </div>
  );
}

const cardStyle = { background: 'white', border: '1px solid #ddd3c5', borderRadius: 12, padding: 16 };
