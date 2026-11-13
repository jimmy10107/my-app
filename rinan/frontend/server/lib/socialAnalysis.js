// 社群洞察分析（純函式，不打任何 API）：吃 socialCollect.js 整理好的原始資料，
// 算出 KPI 變化、內容格式／時段／標籤表現、社群與植生牆的關聯，再依規則產生「洞察」與「行銷策略」。
//
// 判斷原則：
// - 跨平台比較一律用「互動指數」（貼文互動率 ÷ 該平台本期互動率中位數，1.0＝平台平常水準），
//   FB 與 IG 的互動率基準不同，直接比會誤導。
// - 每個結論都有最低樣本數；不夠就明講「樣本太少」，不硬下結論。

export const FORMAT_LABELS = {
  photo: '相片',
  video: '影片',
  reel: 'Reels',
  carousel: '輪播',
  link: '連結分享',
  text: '純文字',
  event: '活動',
};

export const PLATFORM_LABELS = { facebook: 'Facebook', instagram: 'Instagram' };

export const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

export const DAYPARTS = [
  { id: 'morning', label: '早上 6–11 點', from: 6, to: 11 },
  { id: 'noon', label: '中午 11–14 點', from: 11, to: 14 },
  { id: 'afternoon', label: '下午 14–18 點', from: 14, to: 18 },
  { id: 'evening', label: '晚上 18–22 點', from: 18, to: 22 },
  { id: 'night', label: '深夜 22–6 點', from: 22, to: 30 },
];

const MIN_GROUP = 2; // 一個分組至少幾篇才拿來比較
const MIN_POSTS = 5; // 全部至少幾篇才談格式／時段
const TARGET_PER_WEEK = { facebook: 3, instagram: 4 };
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// 基本工具
// ---------------------------------------------------------------------------
export function pctChange(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / previous;
}

export function median(values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export function taipeiParts(iso) {
  const d = new Date(new Date(iso).getTime() + TAIPEI_OFFSET_MS);
  return { weekday: d.getUTCDay(), hour: d.getUTCHours(), date: d.toISOString().slice(0, 10) };
}

export function daypartOf(hour) {
  const h = hour < 6 ? hour + 24 : hour;
  return DAYPARTS.find((p) => h >= p.from && h < p.to);
}

export function hashtagsOf(text = '') {
  return [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) || []).map((t) => t.toLowerCase()))];
}

// 有觸及就用觸及當分母（最準）；拿不到觸及才退而用粉絲數。
export function engagementRate(post, followers) {
  if (post.reach > 0) return { rate: post.engagement / post.reach, basis: 'reach' };
  if (followers > 0) return { rate: post.engagement / followers, basis: 'followers' };
  return { rate: null, basis: null };
}

function lengthBucket(text) {
  const n = [...(text || '')].length;
  if (n < 50) return 'short';
  if (n <= 150) return 'medium';
  return 'long';
}

const LENGTH_LABELS = { short: '短文（50 字內）', medium: '中篇（50–150 字）', long: '長文（150 字以上）' };

export function groupStats(posts, keyFn, labelFn = (k) => k) {
  const groups = new Map();
  for (const post of posts) {
    const keys = [].concat(keyFn(post) ?? []);
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(post);
    }
  }
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      label: labelFn(key),
      count: items.length,
      index: median(items.map((p) => p.index)),
      rate: median(items.map((p) => p.rate)),
      reach: median(items.map((p) => p.reach)),
      engagement: median(items.map((p) => p.engagement)),
    }))
    .sort((a, b) => (b.index ?? -1) - (a.index ?? -1) || b.count - a.count);
}

const pct = (v, digits = 0) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;
const ratePct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const num = (v) => (v == null ? '—' : Math.round(v).toLocaleString('zh-TW'));
const snippet = (text, n = 24) => {
  const chars = [...(text || '').replace(/\s+/g, ' ').trim()];
  if (chars.length === 0) return '（沒有文字）';
  return chars.length > n ? `${chars.slice(0, n).join('')}…` : chars.join('');
};

// ---------------------------------------------------------------------------
// 主分析
// ---------------------------------------------------------------------------
export function analyzeSocial(raw) {
  const fb = raw.facebook || {};
  const ig = raw.instagram || {};
  const weeks = raw.days / 7;

  const followers = {
    facebook: fb.page?.followers ?? null,
    instagram: ig.account?.followers ?? null,
  };

  // 本期貼文加上互動率與互動指數
  const enrich = (posts = [], platform) => {
    const current = posts
      .filter((p) => p.period === 'current')
      .map((p) => {
        const { rate, basis } = engagementRate(p, followers[platform]);
        return { ...p, rate, rateBasis: basis, ...taipeiParts(p.createdAt) };
      });
    const base = median(current.map((p) => p.rate));
    return current.map((p) => ({ ...p, index: base > 0 && p.rate != null ? p.rate / base : null }));
  };
  const fbPosts = enrich(fb.posts, 'facebook');
  const igPosts = enrich(ig.posts, 'instagram');
  const allPosts = [...fbPosts, ...igPosts];

  const cadence = {};
  for (const [platform, data] of [
    ['facebook', fb],
    ['instagram', ig],
  ]) {
    if (data.error) continue;
    const current = (data.posts || []).filter((p) => p.period === 'current').length;
    const previous = (data.posts || []).filter((p) => p.period === 'previous').length;
    cadence[platform] = { current, previous, perWeek: current / weeks, target: TARGET_PER_WEEK[platform] };
  }

  const kpis = {
    facebook: fb.error ? null : buildFacebookKpis(fb),
    instagram: ig.error ? null : buildInstagramKpis(ig),
    plantings: raw.plantings
      ? {
          current: raw.plantings.totals.current,
          previous: raw.plantings.totals.previous,
          change: pctChange(raw.plantings.totals.current, raw.plantings.totals.previous),
        }
      : null,
  };

  const formats = {
    facebook: groupStats(fbPosts, (p) => p.format, (k) => FORMAT_LABELS[k] || k),
    instagram: groupStats(igPosts, (p) => p.format, (k) => FORMAT_LABELS[k] || k),
  };
  const timeSlots = {
    weekday: groupStats(allPosts, (p) => p.weekday, (k) => WEEKDAY_LABELS[k]),
    daypart: groupStats(allPosts, (p) => daypartOf(p.hour).id, (k) => DAYPARTS.find((d) => d.id === k).label),
  };
  const captionLength = groupStats(allPosts, (p) => lengthBucket(p.text), (k) => LENGTH_LABELS[k]);
  const hashtags = groupStats(allPosts, (p) => hashtagsOf(p.text))
    .filter((h) => h.count >= MIN_GROUP)
    .slice(0, 10);

  const ranked = allPosts.filter((p) => p.index != null).sort((a, b) => b.index - a.index);
  const topPosts = ranked.slice(0, 5).map(publicPost);
  const weakPosts = ranked.length >= 6 ? ranked.slice(-3).reverse().map(publicPost) : [];

  const offline = offlineLink(raw, allPosts);

  const analysis = {
    followers,
    cadence,
    kpis,
    formats,
    timeSlots,
    captionLength,
    hashtags,
    topPosts,
    weakPosts,
    offline,
    postCount: allPosts.length,
  };
  analysis.insights = buildInsights(raw, analysis);
  analysis.strategy = buildStrategy(raw, analysis);
  return analysis;
}

function publicPost(p) {
  return {
    platform: p.platform,
    id: p.id,
    createdAt: p.createdAt,
    text: snippet(p.text, 60),
    permalink: p.permalink,
    image: p.image,
    format: p.format,
    reach: p.reach,
    views: p.views,
    engagement: p.engagement,
    saves: p.saves,
    shares: p.shares,
    rate: p.rate,
    rateBasis: p.rateBasis,
    index: p.index,
  };
}

function kpi(id, label, current, previous, note) {
  return { id, label, current, previous, change: pctChange(current, previous), ...(note ? { note } : {}) };
}

function buildFacebookKpis(fb) {
  const c = fb.totals?.current || {};
  const p = fb.totals?.previous || {};
  const netCur = c.newFollows == null ? null : c.newFollows - (c.unfollows || 0);
  const netPrev = p.newFollows == null ? null : p.newFollows - (p.unfollows || 0);
  return [
    kpi('followers', '粉絲（追蹤者）', fb.page?.followers ?? null, null),
    kpi('views', '觀看次數', c.views, p.views),
    kpi('reach', '觸及人數', c.reach, p.reach, '每日不重複人數加總'),
    kpi('engagements', '貼文互動', c.engagements, p.engagements),
    kpi('netFollows', '淨增追蹤', netCur, netPrev),
    kpi('pageViews', '粉專造訪', c.pageViews, p.pageViews),
  ];
}

function buildInstagramKpis(ig) {
  const c = ig.totals?.current || {};
  const p = ig.totals?.previous || {};
  return [
    kpi('followers', '粉絲', ig.account?.followers ?? null, null),
    kpi('reach', '觸及帳號', c.reach, p.reach),
    kpi('views', '觀看次數', c.views, p.views),
    kpi('accountsEngaged', '互動帳號', c.accountsEngaged, p.accountsEngaged),
    kpi('totalInteractions', '總互動', c.totalInteractions, p.totalInteractions),
    kpi('newFollowers', '新增粉絲', c.newFollowers, p.newFollowers),
    kpi('profileLinksTaps', '個人檔案連結點擊', c.profileLinksTaps, p.profileLinksTaps),
  ];
}

// 發文當天＋隔天 vs 其它日子的平均種植數：社群貼文有沒有把人帶到現場／LINE 種植頁。
export function offlineLink(raw, posts) {
  const daily = raw.plantings?.daily;
  if (!daily || daily.length === 0) return null;
  const total = daily.reduce((a, d) => a + d.count, 0);
  const postDays = new Set(posts.map((p) => p.date));
  const boosted = new Set();
  for (const key of postDays) {
    boosted.add(key);
    const next = new Date(`${key}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    boosted.add(next.toISOString().slice(0, 10));
  }
  const on = daily.filter((d) => boosted.has(d.date)).map((d) => d.count);
  const off = daily.filter((d) => !boosted.has(d.date)).map((d) => d.count);
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const onAvg = avg(on);
  const offAvg = avg(off);
  return {
    total,
    postDays: postDays.size,
    onDays: on.length,
    offDays: off.length,
    onAvg,
    offAvg,
    lift: onAvg != null && offAvg > 0 ? onAvg / offAvg - 1 : null,
    reliable: total >= 10 && on.length >= 3 && off.length >= 3,
  };
}

// ---------------------------------------------------------------------------
// 洞察
// ---------------------------------------------------------------------------
function buildInsights(raw, a) {
  const out = [];
  const add = (tone, scope, title, detail) => out.push({ tone, scope, title, detail });

  for (const platform of ['facebook', 'instagram']) {
    const data = raw[platform];
    const name = PLATFORM_LABELS[platform];
    if (data?.error) {
      add('warn', platform, `${name} 資料讀取失敗`, data.error);
      continue;
    }
    const list = a.kpis[platform] || [];
    const headline = list.find((k) => k.id === (platform === 'facebook' ? 'views' : 'reach'));
    if (headline?.change != null) {
      if (headline.change >= 0.2) {
        add('good', platform, `${name}${headline.label}成長 ${pct(headline.change)}`, `本期 ${num(headline.current)}，上一期 ${num(headline.previous)}。找出帶動成長的貼文（見「表現最好的貼文」），把同樣的題材或格式再做一輪。`);
      } else if (headline.change <= -0.2) {
        add('warn', platform, `${name}${headline.label}下滑 ${pct(headline.change)}`, `本期 ${num(headline.current)}，上一期 ${num(headline.previous)}。先檢查發文數是否變少、是否缺少影音內容，再對照上一期表現好的貼文。`);
      } else {
        add('info', platform, `${name}${headline.label}持平（${pct(headline.change)}）`, `本期 ${num(headline.current)}，上一期 ${num(headline.previous)}。`);
      }
    }
    const engaged = list.find((k) => k.id === (platform === 'facebook' ? 'engagements' : 'totalInteractions'));
    if (engaged?.change != null && headline?.change != null && engaged.change - headline.change >= 0.25) {
      add('good', platform, `${name}互動成長快過${headline.label}`, `互動 ${pct(engaged.change)}、${headline.label} ${pct(headline.change)}：既有受眾對內容的反應變好，現在適合加強擴散（分享誘因、合作轉發、少量廣告加熱）。`);
    } else if (engaged?.change != null && headline?.change != null && headline.change - engaged.change >= 0.25) {
      add('warn', platform, `${name}${headline.label}增加但互動沒跟上`, `${headline.label} ${pct(headline.change)}、互動 ${pct(engaged.change)}：新看到的人沒有被打動，貼文開頭要更快給出「為什麼跟我有關」，並加上明確的行動呼籲。`);
    }

    const c = a.cadence[platform];
    if (c) {
      if (c.current === 0) {
        add('warn', platform, `${name}本期沒有發文`, '演算法會降低久未更新帳號的觸及，至少維持每週固定更新。');
      } else if (c.perWeek < c.target) {
        add('info', platform, `${name}每週 ${c.perWeek.toFixed(1)} 篇，低於建議的 ${c.target} 篇`, `本期 ${c.current} 篇，上一期 ${c.previous} 篇。`);
      }
    }
  }

  // 格式
  for (const platform of ['facebook', 'instagram']) {
    const groups = a.formats[platform].filter((g) => g.count >= MIN_GROUP && g.index != null);
    const total = a.formats[platform].reduce((s, g) => s + g.count, 0);
    if (total >= MIN_POSTS && groups.length >= 2) {
      const best = groups[0];
      const worst = groups.at(-1);
      if (best.index / worst.index >= 1.3) {
        add('good', platform, `${PLATFORM_LABELS[platform]}「${best.label}」互動表現最好`, `${best.label}互動率中位數 ${ratePct(best.rate)}（${best.count} 篇），是「${worst.label}」的 ${(best.index / worst.index).toFixed(1)} 倍。`);
      }
    }
  }

  // 時段
  if (a.postCount >= MIN_POSTS) {
    const parts = a.timeSlots.daypart.filter((g) => g.count >= MIN_GROUP && g.index != null);
    const days = a.timeSlots.weekday.filter((g) => g.count >= MIN_GROUP && g.index != null);
    if (parts.length >= 2) {
      add('info', 'cross', `${parts[0].label}發文的互動最好`, `互動指數 ${parts[0].index.toFixed(2)}（1.00＝平常水準），${parts[0].count} 篇。${parts.length > 1 ? `最弱的是${parts.at(-1).label}（${parts.at(-1).index.toFixed(2)}）。` : ''}`);
    }
    if (days.length >= 2) {
      add('info', 'cross', `${days[0].label}發文表現最好`, `互動指數 ${days[0].index.toFixed(2)}，${days[0].count} 篇。`);
    }
    const len = a.captionLength.filter((g) => g.count >= MIN_GROUP && g.index != null);
    if (len.length >= 2 && len[0].index / len.at(-1).index >= 1.3) {
      add('info', 'cross', `${len[0].label}的貼文反應較好`, `互動指數 ${len[0].index.toFixed(2)}，比${len.at(-1).label}（${len.at(-1).index.toFixed(2)}）高。`);
    }
    if (a.hashtags.length > 0 && a.hashtags[0].index >= 1.2) {
      add('info', 'cross', `標籤 ${a.hashtags[0].key} 的貼文表現較好`, `互動指數 ${a.hashtags[0].index.toFixed(2)}，用過 ${a.hashtags[0].count} 次。`);
    }
  } else {
    add('info', 'cross', '本期貼文數太少，格式與時段的比較還不可靠', `兩個平台合計 ${a.postCount} 篇，至少累積 ${MIN_POSTS} 篇以上再看這部分的結論。`);
  }

  // IG 收藏／分享：代表內容有「留著再看、傳給朋友」的價值
  const igPosts = (raw.instagram?.posts || []).filter((p) => p.period === 'current');
  const saves = igPosts.reduce((s, p) => s + (p.saves || 0), 0);
  const shares = igPosts.reduce((s, p) => s + (p.shares || 0), 0);
  const likes = igPosts.reduce((s, p) => s + (p.reactions || 0), 0);
  if (likes > 0 && saves + shares >= likes * 0.15) {
    add('good', 'instagram', 'IG 收藏＋分享比例高', `收藏 ${num(saves)}、分享 ${num(shares)}，對比按讚 ${num(likes)}：受眾把內容當成值得保存或轉傳的資訊，適合多做植物故事、在地文史這類「知識型」輪播。`);
  }

  // 社群 × 現場
  const o = a.offline;
  if (o) {
    if (o.total === 0) {
      add('info', 'offline', '本期植生牆沒有新的種植紀錄', '可能是非展期；展期內可以對照社群貼文與種植數的變化。');
    } else if (o.reliable && o.lift != null) {
      if (o.lift >= 0.2) {
        add('good', 'offline', `發文當天與隔天，植生牆種植數多 ${pct(o.lift)}`, `平均每天 ${o.onAvg.toFixed(1)} 株 vs 其它日子 ${o.offAvg.toFixed(1)} 株。社群貼文確實有把人帶到種植頁，貼文要固定附上參加連結。`);
      } else if (o.lift <= -0.1) {
        add('info', 'offline', '發文日的種植數沒有比較多', `平均每天 ${o.onAvg.toFixed(1)} 株 vs 其它日子 ${o.offAvg.toFixed(1)} 株。目前現場參與主要靠實體人流，社群貼文可以更直接地邀請「來現場種一株」。`);
      } else {
        add('info', 'offline', '發文日與其它日子的種植數差不多', `平均每天 ${o.onAvg.toFixed(1)} 株 vs ${o.offAvg.toFixed(1)} 株。`);
      }
    }
  }

  const unavailable = [...(raw.facebook?.unavailable || []), ...(raw.instagram?.unavailable || [])];
  if (unavailable.length > 0) {
    add('info', 'cross', 'Meta 有部分指標目前拿不到', `已自動略過：${unavailable.join('、')}。通常是 Meta 汰換指標或帳號資料不足，其它數字不受影響。`);
  }

  const order = { warn: 0, good: 1, info: 2 };
  return out.sort((x, y) => order[x.tone] - order[y.tone]);
}

// ---------------------------------------------------------------------------
// 行銷策略：資料推導的行動 ＋ 日南稻站的內容支柱
// ---------------------------------------------------------------------------
export const CONTENT_PILLARS = [
  {
    title: '六種植物故事',
    detail: '木麻黃（守護）、水稻（耕作）、芋頭（實踐）、台灣欒樹（日常）、甜根子草（韌性）、構樹（生命力）各做一篇輪播或短影音，結尾邀請「你會種下哪一株？」並附參加連結。',
  },
  {
    title: '種下就上牆（UGC）',
    detail: '徵求觀眾分享自己的植物照片（互動頁已有分享按鈕），標記官方帳號就轉發到限時動態；每週挑選牆上的留言做成「本週日南留言牆」貼文。',
  },
  {
    title: '在地文史與風土',
    detail: '大安溪水源、日南車站、東北季風等《往返》展覽的文史內容，用「一張圖＋三句話」的知識卡呈現，引導收藏與分享。',
  },
  {
    title: '活動與講者',
    detail: '走傱日南系列講座：活動前 7 天預告、前 1 天提醒、當天現場限動、隔天精華回顧，四段式節奏。',
  },
];

function buildStrategy(raw, a) {
  const actions = [];
  const add = (priority, horizon, channel, action, why, metric) =>
    actions.push({ priority, horizon, channel, action, why, metric });

  for (const platform of ['facebook', 'instagram']) {
    if (raw[platform]?.error) {
      add('高', '本週', PLATFORM_LABELS[platform], `修復 ${PLATFORM_LABELS[platform]} 資料串接`, raw[platform].error, '後台社群洞察可正常讀取');
    }
  }

  // 發文節奏
  for (const [platform, c] of Object.entries(a.cadence)) {
    if (c.perWeek < c.target) {
      add(
        c.current === 0 ? '高' : '中',
        '本週',
        PLATFORM_LABELS[platform],
        `把 ${PLATFORM_LABELS[platform]} 發文提高到每週 ${c.target} 篇，排進固定的內容日曆`,
        `目前每週 ${c.perWeek.toFixed(1)} 篇；穩定更新是觸及的基本盤。`,
        `下一期 ${Math.ceil(c.target * (raw.days / 7))} 篇`
      );
    }
  }

  // 時段
  const bestPart = a.timeSlots.daypart.find((g) => g.count >= MIN_GROUP && g.index != null);
  const bestDay = a.timeSlots.weekday.find((g) => g.count >= MIN_GROUP && g.index != null);
  if (a.postCount >= MIN_POSTS && bestPart) {
    add('中', '本週', '雙平台', `重點貼文排在${bestDay ? `${bestDay.label}、` : ''}${bestPart.label}發布`, `這是本期互動指數最高的${bestDay ? '日子與' : ''}時段。`, '重點貼文互動指數 ≥ 1.2');
  }

  // 格式
  for (const platform of ['facebook', 'instagram']) {
    const groups = a.formats[platform].filter((g) => g.count >= MIN_GROUP && g.index != null);
    if (groups.length >= 2 && groups[0].index / groups.at(-1).index >= 1.3) {
      add('中', '本月', PLATFORM_LABELS[platform], `提高「${groups[0].label}」比例到每週至少一半，「${groups.at(-1).label}」改成搭配用`, `${groups[0].label}互動率中位數 ${ratePct(groups[0].rate)}，${groups.at(-1).label}只有 ${ratePct(groups.at(-1).rate)}。`, `${groups[0].label}佔發文 ≥ 50%`);
    }
  }
  const igFormats = a.formats.instagram.map((g) => g.key);
  if (!raw.instagram?.error && !igFormats.includes('reel')) {
    add('中', '本月', 'Instagram', '每週至少一支 15–30 秒 Reels：植生牆種下的瞬間、植物生長縮時、投影牆全景', '本期沒有 Reels，而 Reels 是 IG 觸及非粉絲最主要的入口。', '每週 1 支 Reels，觸及非粉絲比例提升');
  }

  // 互動 vs 觸及
  const top = a.topPosts[0];
  if (top) {
    add('中', '本週', PLATFORM_LABELS[top.platform], `把表現最好的貼文「${snippet(top.text, 18)}」延伸成系列或換格式再發一次`, `互動指數 ${top.index.toFixed(2)}，是本期最好的貼文。`, '延伸貼文互動指數 ≥ 1.0');
  }

  // 社群導流到植生牆
  const o = a.offline;
  if (o && o.total > 0) {
    if (o.reliable && o.lift >= 0.2) {
      add('高', '持續', '雙平台', '每篇貼文固定附上種植頁參加連結（IG 放個人檔案連結與限動連結貼紙）', `發文日的種植數比其它日子多 ${pct(o.lift)}，社群導流有效。`, '種植數較本期再成長 15%');
    } else {
      add('中', '本月', '雙平台', '貼文加入明確的現場行動呼籲：「來日南稻站種一株，3 秒上牆」，並附參加連結', '目前社群貼文和植生牆種植數的關聯不明顯。', '發文日種植數高於非發文日 20%');
    }
  }
  if (a.kpis.instagram?.find((k) => k.id === 'profileLinksTaps')?.current === 0) {
    add('中', '本週', 'Instagram', '在 IG 個人檔案放上種植頁連結，限時動態加上連結貼紙', '本期個人檔案連結點擊為 0。', '個人檔案連結點擊 > 0');
  }

  // 持續追蹤
  add('低', '持續', '後台', '每週一打開「社群洞察」看 7 天報表，每月初看 28 天報表並複製報告存檔', '固定節奏比較，才看得出策略調整有沒有效。', '每月一份報告');

  const rank = { 高: 0, 中: 1, 低: 2 };
  const horizon = { 本週: 0, 本月: 1, 持續: 2 };
  actions.sort((x, y) => rank[x.priority] - rank[y.priority] || horizon[x.horizon] - horizon[y.horizon]);

  return { actions, pillars: CONTENT_PILLARS, targets: buildTargets(raw, a) };
}

function buildTargets(raw, a) {
  const targets = [];
  const grow = (k, factor) => {
    if (k?.current == null) return null;
    const base = k.previous != null && k.previous > k.current ? k.previous : k.current; // 下滑時先追回上一期
    return Math.round(base * factor);
  };
  const fbViews = a.kpis.facebook?.find((k) => k.id === 'views');
  const igReach = a.kpis.instagram?.find((k) => k.id === 'reach');
  if (grow(fbViews, 1.1) != null) targets.push({ label: 'FB 觀看次數', current: fbViews.current, target: grow(fbViews, 1.1) });
  if (grow(igReach, 1.1) != null) targets.push({ label: 'IG 觸及帳號', current: igReach.current, target: grow(igReach, 1.1) });
  for (const [platform, c] of Object.entries(a.cadence)) {
    targets.push({
      label: `${PLATFORM_LABELS[platform]} 發文數`,
      current: c.current,
      target: Math.max(c.current, Math.ceil(c.target * (raw.days / 7))),
    });
  }
  if (a.kpis.plantings?.current) {
    targets.push({ label: '植生牆種植數', current: a.kpis.plantings.current, target: Math.round(a.kpis.plantings.current * 1.15) });
  }
  return targets;
}

// ---------------------------------------------------------------------------
// Markdown 報告（後台「複製報告」用，可以貼到記事本、Notion 或交給 AI 做更深入的企劃）
// ---------------------------------------------------------------------------
export function reportMarkdown(raw, a) {
  const lines = [];
  lines.push(`# 日南稻站 社群洞察報告（近 ${raw.days} 天）`);
  lines.push('');
  lines.push(`- 本期：${raw.range.current.start} ～ ${raw.range.current.end}`);
  lines.push(`- 對照上一期：${raw.range.previous.start} ～ ${raw.range.previous.end}`);
  lines.push(`- 產生時間：${new Date(raw.generatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);
  lines.push('');

  for (const platform of ['facebook', 'instagram']) {
    lines.push(`## ${PLATFORM_LABELS[platform]}`);
    const list = a.kpis[platform];
    if (!list) {
      lines.push(`- 讀取失敗：${raw[platform]?.error}`);
    } else {
      lines.push('| 指標 | 本期 | 上一期 | 變化 |');
      lines.push('| --- | ---: | ---: | ---: |');
      for (const k of list) lines.push(`| ${k.label} | ${num(k.current)} | ${num(k.previous)} | ${k.change == null ? '—' : pct(k.change)} |`);
      const c = a.cadence[platform];
      if (c) lines.push(`\n發文：本期 ${c.current} 篇（每週 ${c.perWeek.toFixed(1)} 篇），上一期 ${c.previous} 篇。`);
    }
    lines.push('');
  }

  if (a.kpis.plantings) {
    const p = a.kpis.plantings;
    lines.push('## 植生牆');
    lines.push(`- 種植數：本期 ${num(p.current)}，上一期 ${num(p.previous)}${p.change == null ? '' : `（${pct(p.change)}）`}`);
    lines.push('');
  }

  lines.push('## 洞察');
  for (const i of a.insights) lines.push(`- ${i.tone === 'good' ? '✅' : i.tone === 'warn' ? '⚠️' : 'ℹ️'} **${i.title}**：${i.detail}`);
  lines.push('');

  if (a.topPosts.length) {
    lines.push('## 表現最好的貼文');
    lines.push('| 平台 | 日期 | 格式 | 觸及 | 互動 | 互動率 | 互動指數 |');
    lines.push('| --- | --- | --- | ---: | ---: | ---: | ---: |');
    for (const p of a.topPosts) {
      lines.push(`| ${PLATFORM_LABELS[p.platform]} | ${taipeiParts(p.createdAt).date} | ${FORMAT_LABELS[p.format] || p.format} | ${num(p.reach)} | ${num(p.engagement)} | ${ratePct(p.rate)} | ${p.index.toFixed(2)} |`);
    }
    lines.push('');
  }

  lines.push('## 後續行銷策略');
  for (const s of a.strategy.actions) lines.push(`- 【${s.priority}｜${s.horizon}｜${s.channel}】${s.action}（${s.why} 目標：${s.metric}）`);
  lines.push('');
  lines.push('### 內容支柱');
  for (const p of a.strategy.pillars) lines.push(`- **${p.title}**：${p.detail}`);
  lines.push('');
  if (a.strategy.targets.length) {
    lines.push('### 下一期目標');
    for (const t of a.strategy.targets) lines.push(`- ${t.label}：${num(t.current)} → ${num(t.target)}`);
  }
  return lines.join('\n');
}
