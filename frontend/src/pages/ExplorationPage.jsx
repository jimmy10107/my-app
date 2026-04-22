import { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';

export function ExplorationPage() {
  const [catalog, setCatalog] = useState({ careers: [], values: [], abilities: [] });
  const [session, setSession] = useState(null);
  const [form, setForm] = useState({
    holland: { top3: [] },
    value: { top3: [], definitions: {} },
    ability: { possessed: [] },
    actions: { nextWeek: '', nextMonth: '' },
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/modules/cards').then(setCatalog);
  }, []);

  const summaryPayload = useMemo(() => ({
    holland: form.holland,
    value: form.value,
    ability: form.ability,
    actions: form.actions,
  }), [form]);

  async function startSession() {
    const result = await api('/modules/sessions', { method: 'POST', body: JSON.stringify({ entryMode: 'member' }) });
    setSession(result);
    setMessage(`已建立 session ${result.id}`);
  }

  async function saveModule(moduleCode, inputPayload, outputPayload) {
    if (!session) {
      setMessage('請先建立 session');
      return;
    }
    await api('/modules/runs', {
      method: 'POST',
      body: JSON.stringify({ sessionId: session.id, moduleCode, inputPayload, outputPayload }),
    });
    setMessage(`已儲存 ${moduleCode}`);
  }

  async function finishSession() {
    if (!session) return;
    await saveModule('holland_interest', form.holland, form.holland);
    await saveModule('value_sort', form.value, form.value);
    await saveModule('ability_inventory', form.ability, form.ability);
    await saveModule('action_plan', form.actions, form.actions);
    const snapshot = await api(`/modules/sessions/${session.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ payload: summaryPayload }),
    });
    setMessage(`已完成探索，snapshot=${snapshot.id}`);
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2>完整探索流程</h2>
      <button onClick={startSession}>1. 建立 Session</button>
      {message && <div>{message}</div>}

      <section style={cardStyle}>
        <h3>2. Holland Top 3</h3>
        <div style={gridStyle}>
          {catalog.careers.map((career) => (
            <label key={career.id}>
              <input
                type="checkbox"
                checked={form.holland.top3.includes(career.title)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...form.holland.top3, career.title].slice(0, 3)
                    : form.holland.top3.filter((item) => item !== career.title);
                  setForm((prev) => ({ ...prev, holland: { ...prev.holland, top3: next } }));
                }}
              />
              {career.title}
            </label>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <h3>3. 價值 Top 3</h3>
        <div style={gridStyle}>
          {catalog.values.map((value) => (
            <label key={value.id}>
              <input
                type="checkbox"
                checked={form.value.top3.includes(value.title)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...form.value.top3, value.title].slice(0, 3)
                    : form.value.top3.filter((item) => item !== value.title);
                  setForm((prev) => ({ ...prev, value: { ...prev.value, top3: next } }));
                }}
              />
              {value.title}
            </label>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <h3>4. 能力盤點</h3>
        <div style={gridStyle}>
          {catalog.abilities.map((ability) => (
            <label key={ability.id}>
              <input
                type="checkbox"
                checked={form.ability.possessed.includes(ability.title)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...form.ability.possessed, ability.title]
                    : form.ability.possessed.filter((item) => item !== ability.title);
                  setForm((prev) => ({ ...prev, ability: { possessed: next } }));
                }}
              />
              {ability.title}
            </label>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <h3>5. 行動計畫</h3>
        <textarea placeholder="下週行動" value={form.actions.nextWeek} onChange={(e) => setForm((prev) => ({ ...prev, actions: { ...prev.actions, nextWeek: e.target.value } }))} />
        <textarea placeholder="下月行動" value={form.actions.nextMonth} onChange={(e) => setForm((prev) => ({ ...prev, actions: { ...prev.actions, nextMonth: e.target.value } }))} />
      </section>

      <button onClick={finishSession}>完成並產出 Snapshot</button>
      <section style={cardStyle}><pre>{JSON.stringify(summaryPayload, null, 2)}</pre></section>
    </div>
  );
}

const cardStyle = { background: 'white', border: '1px solid #ddd3c5', borderRadius: 12, padding: 16, display: 'grid', gap: 12 };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 };
