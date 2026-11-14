import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { TrendChart } from './TrendChart.jsx';
import { SocialHistory } from './SocialHistory.jsx';

// 後台「社群洞察」分頁：FB 粉專＋IG 專業帳號的本期 vs 上一期、每日趨勢、洞察、行銷策略。
// 所有分析都在 /api/social/report 算好，這裡只負責呈現。
const RANGES = [7, 14, 28];
const RANGE_KEY = 'rinan_social_days';
const COLORS = { facebook: '#2f6aa8', instagram: '#c0701c', plantings: '#231f20' };
const PLATFORM = { facebook: 'Facebook', instagram: 'Instagram' };
const FORMAT = {
  photo: '相片',
  video: '影片',
  reel: 'Reels',
  carousel: '輪播',
  link: '連結分享',
  text: '純文字',
  event: '活動',
};
const TONE = {
  good: { icon: '✓', label: '亮點' },
  warn: { icon: '!', label: '注意' },
  info: { icon: 'i', label: '觀察' },
};
const SCOPE = { facebook: 'Facebook', instagram: 'Instagram', cross: '跨平台', offline: '社群 × 現場' };

const num = (v) => (v == null ? '—' : Math.round(v).toLocaleString('zh-TW'));
const ratePct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const dateOf = (iso) =>
  new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' });

function readDays() {
  try {
    const v = Number(localStorage.getItem(RANGE_KEY));
    return RANGES.includes(v) ? v : 28;
  } catch {
    return 28;
  }
}

const AUTO_REFRESH_MS = 15 * 60 * 1000;
const clock = (ms) =>
  new Date(ms).toLocaleTimeString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

// 儀表板模式：每 15 分鐘自動重抓（伺服器端也快取 15 分鐘，不會多打 Meta）；分頁在背景時暫停，回到前景立刻補抓。
export function SocialInsights({ token, onAuthError, autoRefreshMs = AUTO_REFRESH_MS }) {
  const [days, setDays] = useState(readDays);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [nextAt, setNextAt] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const next = await api.socialReport(token, { days, refresh });
        setReport(next);
        if (next.cached === false) setHistoryKey((k) => k + 1);
      } catch (err) {
        if (err.status === 401) onAuthError(err);
        else setError(err.message);
      } finally {
        setLoading(false);
        setNextAt(Date.now() + autoRefreshMs);
      }
    },
    [token, days, onAuthError, autoRefreshMs]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefreshMs) return undefined;
    let last = Date.now();
    const tick = () => {
      if (document.hidden || Date.now() - last < autoRefreshMs) return;
      last = Date.now();
      load();
    };
    const interval = setInterval(tick, 30 * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load, autoRefreshMs]);

  function pickDays(d) {
    setDays(d);
    try {
      localStorage.setItem(RANGE_KEY, String(d));
    } catch {
      // 存不了只是下次回到預設 28 天
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('複製這份報告：', report.markdown);
    }
  }

  if (report && report.configured === false) {
    return <SetupGuide missing={report.missing} />;
  }

  const a = report?.analysis;

  return (
    <div className={`social${loading && report ? ' is-refreshing' : ''}`}>
      <div className="social__controls">
        <div className="social__range" role="group" aria-label="統計期間">
          {RANGES.map((d) => (
            <button
              key={d}
              type="button"
              className={d === days ? 'is-active' : ''}
              aria-pressed={d === days}
              onClick={() => pickDays(d)}
            >
              近 {d} 天
            </button>
          ))}
        </div>
        <button type="button" className="social__ghost" onClick={() => load(true)} disabled={loading}>
          {loading ? '讀取中…' : '重新抓取'}
        </button>
        {report?.markdown && (
          <button type="button" className="social__ghost" onClick={copyReport}>
            {copied ? '已複製' : '複製報告（Markdown）'}
          </button>
        )}
      </div>

      {report && (
        <p className="social__meta">
          本期 {report.range.current.start} ～ {report.range.current.end}，對照上一期 {report.range.previous.start} ～{' '}
          {report.range.previous.end}（不含今天）。資料時間{' '}
          {new Date(report.generatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
          {report.cached && '（伺服器快取）'}
          {autoRefreshMs > 0 && nextAt && (
            <span className="social__live">
              <span className="social__live-dot" aria-hidden="true" />
              自動更新中，下次 {clock(nextAt)}
            </span>
          )}
        </p>
      )}

      {error && <p className="page__error">{error}</p>}
      {!report && loading && <p>正在向 Meta 讀取資料，第一次大約需要 10–20 秒…</p>}

      {a && (
        <>
          <div className="social__platforms">
            <PlatformCard
              platform="facebook"
              title={report.facebook.page?.name || 'Facebook 粉專'}
              link={report.facebook.page?.link}
              error={report.facebook.error}
              kpis={a.kpis.facebook}
              cadence={a.cadence.facebook}
            />
            <PlatformCard
              platform="instagram"
              title={report.instagram.account ? `@${report.instagram.account.username}` : 'Instagram'}
              link={report.instagram.account ? `https://www.instagram.com/${report.instagram.account.username}/` : null}
              error={report.instagram.error}
              kpis={a.kpis.instagram}
              cadence={a.cadence.instagram}
            />
          </div>

          <h2 className="admin-page__section-title">每日趨勢</h2>
          <div className="social__trends">
            {!report.facebook.error && (
              <TrendChart
                title="FB 觀看次數"
                color={COLORS.facebook}
                data={report.facebook.daily.map((d) => ({ date: d.date, value: d.views }))}
              />
            )}
            {!report.instagram.error && (
              <TrendChart
                title="IG 觸及帳號"
                color={COLORS.instagram}
                data={report.instagram.daily.map((d) => ({ date: d.date, value: d.reach }))}
              />
            )}
            {report.plantings && (
              <TrendChart
                title="植生牆種植數"
                unit=" 株"
                color={COLORS.plantings}
                data={report.plantings.daily.map((d) => ({ date: d.date, value: d.count }))}
              />
            )}
          </div>

          <SocialHistory token={token} onAuthError={onAuthError} reloadKey={historyKey} />

          <h2 className="admin-page__section-title">洞察</h2>
          <ul className="social__insights">
            {a.insights.map((i, idx) => (
              <li key={idx} className={`social__insight is-${i.tone}`}>
                <span className="social__tone" aria-hidden="true">
                  {TONE[i.tone].icon}
                </span>
                <div>
                  <p className="social__insight-title">
                    <span className="social__tag">
                      {TONE[i.tone].label}・{SCOPE[i.scope] || i.scope}
                    </span>
                    {i.title}
                  </p>
                  <p>{i.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="admin-page__section-title">後續行銷策略</h2>
          <ol className="social__actions">
            {a.strategy.actions.map((s, idx) => (
              <li key={idx}>
                <div className="social__action-tags">
                  <span className={`social__priority is-p${s.priority}`}>優先 {s.priority}</span>
                  <span className="social__tag">{s.horizon}</span>
                  <span className="social__tag">{s.channel}</span>
                </div>
                <p className="social__action">{s.action}</p>
                <p className="social__why">
                  {s.why}
                  <span className="social__metric">目標：{s.metric}</span>
                </p>
              </li>
            ))}
          </ol>

          {a.strategy.targets.length > 0 && (
            <>
              <h2 className="admin-page__section-title">下一期目標</h2>
              <section className="admin-page__stats social__targets">
                {a.strategy.targets.map((t) => (
                  <div key={t.label}>
                    <span className="admin-page__stat-value">{num(t.target)}</span>
                    <span>{t.label}</span>
                    <span className="social__target-from">本期 {num(t.current)}</span>
                  </div>
                ))}
              </section>
            </>
          )}

          <h2 className="admin-page__section-title">內容支柱（日南稻站）</h2>
          <div className="social__pillars">
            {a.strategy.pillars.map((p) => (
              <article key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.detail}</p>
              </article>
            ))}
          </div>

          {a.topPosts.length > 0 && (
            <>
              <h2 className="admin-page__section-title">表現最好的貼文（互動指數 1.00＝該平台本期中位數）</h2>
              <PostList posts={a.topPosts} />
            </>
          )}
          {a.weakPosts.length > 0 && (
            <>
              <h2 className="admin-page__section-title">表現較弱的貼文</h2>
              <PostList posts={a.weakPosts} />
            </>
          )}

          {a.postCount > 0 && (
            <>
              <h2 className="admin-page__section-title">發文時段與格式</h2>
              <div className="social__breakdowns">
                <IndexBars title="時段（兩平台合併）" rows={a.timeSlots.daypart} />
                <IndexBars title="星期（兩平台合併）" rows={a.timeSlots.weekday} />
                {a.formats.facebook.length > 0 && (
                  <IndexBars title="Facebook 格式" rows={a.formats.facebook} showRate />
                )}
                {a.formats.instagram.length > 0 && (
                  <IndexBars title="Instagram 格式" rows={a.formats.instagram} showRate />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function PlatformCard({ platform, title, link, error, kpis, cadence }) {
  return (
    <section className={`social__platform is-${platform}`}>
      <header>
        <span className="social__platform-key" style={{ background: COLORS[platform] }} aria-hidden="true" />
        <span className="social__platform-name">{PLATFORM[platform]}</span>
        {link ? (
          <a href={link} target="_blank" rel="noreferrer">
            {title}
          </a>
        ) : (
          <span>{title}</span>
        )}
      </header>
      {error ? (
        <p className="page__error">{error}</p>
      ) : (
        <>
          <div className="social__kpis">
            {kpis.map((k) => (
              <div key={k.id} title={k.note || undefined}>
                <span className="social__kpi-value">{num(k.current)}</span>
                <span className="social__kpi-label">{k.label}</span>
                {k.id === 'followers' ? (
                  <span className="social__delta">目前總數</span>
                ) : (
                  <Delta change={k.change} previous={k.previous} />
                )}
              </div>
            ))}
          </div>
          {cadence && (
            <p className="social__cadence">
              本期發文 {cadence.current} 篇（每週 {cadence.perWeek.toFixed(1)} 篇，建議 {cadence.target} 篇）；上一期{' '}
              {cadence.previous} 篇
            </p>
          )}
        </>
      )}
    </section>
  );
}

// 變化一律「箭頭＋正負號＋文字」，不只靠顏色
function Delta({ change, previous }) {
  if (change == null) {
    return <span className="social__delta">{previous == null ? '無上期資料' : '—'}</span>;
  }
  const up = change > 0.005;
  const down = change < -0.005;
  return (
    <span className={`social__delta${up ? ' is-up' : down ? ' is-down' : ''}`}>
      {up ? '▲' : down ? '▼' : '＝'} {change >= 0 ? '+' : ''}
      {(change * 100).toFixed(0)}% <span className="social__delta-ref">上期 {num(previous)}</span>
    </span>
  );
}

function PostList({ posts }) {
  return (
    <ul className="social__posts">
      {posts.map((p) => (
        <li key={`${p.platform}-${p.id}`}>
          {p.image ? (
            <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <span className="social__post-noimg" aria-hidden="true" />
          )}
          <div className="social__post-body">
            <p className="social__post-meta">
              <span className="social__platform-key" style={{ background: COLORS[p.platform] }} aria-hidden="true" />
              {PLATFORM[p.platform]}・{dateOf(p.createdAt)}・{FORMAT[p.format] || p.format}
            </p>
            <p className="social__post-text">
              {p.permalink ? (
                <a href={p.permalink} target="_blank" rel="noreferrer">
                  {p.text}
                </a>
              ) : (
                p.text
              )}
            </p>
            <p className="social__post-stats">
              觸及 {num(p.reach)}・互動 {num(p.engagement)}・互動率 {ratePct(p.rate)}
              {p.rateBasis === 'followers' && '（以粉絲數計）'}
              {p.saves != null && `・收藏 ${num(p.saves)}`}
            </p>
          </div>
          <span className="social__post-index" title="互動指數">
            {p.index.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// 互動指數橫條：1.00 的位置畫一條參考線，樣本不足兩篇的分組淡化顯示
function IndexBars({ title, rows, showRate = false }) {
  const max = Math.max(1.5, ...rows.map((r) => r.index || 0));
  return (
    <section className="social__bars">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="social__muted">沒有資料</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.key} className={r.count < 2 ? 'is-thin' : ''}>
              <span className="social__bar-label">{r.label}</span>
              <span className="social__bar-track">
                <span className="social__bar-fill" style={{ width: `${((r.index || 0) / max) * 100}%` }} />
                <span className="social__bar-ref" style={{ left: `${(1 / max) * 100}%` }} aria-hidden="true" />
              </span>
              <span className="social__bar-value">
                {r.index == null ? '—' : r.index.toFixed(2)}
                <small>
                  {r.count} 篇{showRate && r.rate != null ? `・${ratePct(r.rate)}` : ''}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="social__muted">互動指數 1.00＝平常水準；淡色＝只有 1 篇，僅供參考</p>
    </section>
  );
}

function SetupGuide({ missing }) {
  return (
    <section className="social__setup">
      <h2>連結 Facebook 粉專與 Instagram</h2>
      <p>
        還沒設定：<code>{missing.join('、')}</code>。設定完成後，這裡會自動顯示 FB 與 IG 的觸及、互動、粉絲成長、
        表現最好的貼文、最佳發文時段，以及依數據產生的後續行銷策略。
      </p>
      <ol>
        <li>
          到{' '}
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
            Meta for Developers
          </a>{' '}
          建立「商家」類型的 App，加入 Facebook 登入與 Instagram Graph API。
        </li>
        <li>
          用{' '}
          <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">
            Graph API Explorer
          </a>{' '}
          取得使用者權杖， 勾選 <code>pages_show_list</code>、<code>pages_read_engagement</code>、
          <code>read_insights</code>、<code>instagram_basic</code>、<code>instagram_manage_insights</code>、
          <code>business_management</code>。
        </li>
        <li>
          把使用者權杖換成長效權杖，再呼叫 <code>/me/accounts</code> 取得日南稻站粉專的 ID
          與「粉專存取權杖」（不會過期）。
        </li>
        <li>
          在 Vercel → Settings → Environment Variables 填入 <code>META_PAGE_ID</code>、
          <code>META_PAGE_ACCESS_TOKEN</code>（建議再填 <code>META_APP_SECRET</code>），重新部署。
        </li>
        <li>確認 IG 已切換成專業帳號，並在 Meta Business Suite 裡跟粉專連結；系統會自動找到連結的 IG。</li>
      </ol>
      <p className="social__muted">
        詳細步驟見專案的 rinan/docs/SOCIAL_INSIGHTS.md。權杖只放在伺服器環境變數，不會出現在網頁裡。
      </p>
    </section>
  );
}
