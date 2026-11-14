import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { TrendChart } from './TrendChart.jsx';

// 長期趨勢：讀 social_daily 每日快照（Vercel Cron 每天存一份，打開報表時也會補齊報表期間）。
// Meta API 只給現在的粉絲數，粉絲成長曲線要靠這裡一天一天累積。
const RANGES = [30, 90, 180, 365];
const COLORS = { facebook: '#2f6aa8', instagram: '#c0701c', plantings: '#231f20' };

export function SocialHistory({ token, onAuthError, reloadKey }) {
  const [days, setDays] = useState(90);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setState(await api.socialHistory(token, days));
      setError(null);
    } catch (err) {
      if (err.status === 401) onAuthError(err);
      else setError(err.message);
    }
  }, [token, days, onAuthError]);

  // reloadKey 變了（報表重新抓過、可能剛寫入新快照）就跟著重讀
  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const history = state?.history || [];
  const series = (platform, field) => history.map((d) => ({ date: d.date, value: d[platform]?.[field] ?? null }));
  const hasFollowers = (platform) => history.filter((d) => d[platform]?.followers != null).length;

  return (
    <section className="social__history" id="social-history">
      <div className="social__history-head">
        <h2 className="admin-page__section-title">長期趨勢（每日快照）</h2>
        <div className="social__range" role="group" aria-label="長期趨勢期間">
          {RANGES.map((d) => (
            <button
              key={d}
              type="button"
              className={d === days ? 'is-active' : ''}
              aria-pressed={d === days}
              onClick={() => setDays(d)}
            >
              {d === 365 ? '一年' : `${d} 天`}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="page__error">{error}</p>}
      {state && !state.available && <p className="social__notice">{state.reason}</p>}
      {state?.available && history.length === 0 && (
        <p className="social__notice">還沒有快照。打開上面的報表或等每天凌晨的排程執行後，這裡就會開始累積。</p>
      )}

      {history.length > 0 && (
        <>
          <div className="social__trends">
            <TrendChart
              title="FB 粉絲數"
              color={COLORS.facebook}
              fromZero={false}
              summary="last"
              data={series('facebook', 'followers')}
            />
            <TrendChart
              title="IG 粉絲數"
              color={COLORS.instagram}
              fromZero={false}
              summary="last"
              data={series('instagram', 'followers')}
            />
            <TrendChart
              title="植生牆每日種植"
              unit=" 株"
              color={COLORS.plantings}
              data={series('plantings', 'count')}
            />
            <TrendChart title="FB 每日觀看" color={COLORS.facebook} data={series('facebook', 'views')} />
            <TrendChart title="IG 每日觸及" color={COLORS.instagram} data={series('instagram', 'reach')} />
            <TrendChart
              title="FB＋IG 每日發文"
              unit=" 篇"
              color={COLORS.plantings}
              data={history.map((d) => ({
                date: d.date,
                value: d.facebook || d.instagram ? (d.facebook?.posts || 0) + (d.instagram?.posts || 0) : null,
              }))}
            />
          </div>
          {(hasFollowers('facebook') < 2 || hasFollowers('instagram') < 2) && (
            <p className="social__muted">
              粉絲數每天只記一筆（凌晨排程時的總數），所以粉絲曲線要累積幾天才看得出變化；其它每日數字打開報表時就會補齊。
            </p>
          )}
        </>
      )}
    </section>
  );
}
