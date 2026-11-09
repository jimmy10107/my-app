import { plantById, PLANTS } from './plants.js';

// 投影牆天空的文字雲：把訪客留言切成詞，同一個詞越多則留言提到，字就越大。
// 中文沒有空白可以分詞，用瀏覽器內建的 Intl.Segmenter；但它對地名、在地用語常常
// 一個字一個字切（九|降|風、日|南|稻|站），所以要把連續的單字黏回一個詞，
// 再用虛字（的、了、好、都…）當斷點，避免整句黏成一長串。

const MAX_TERM_LENGTH = 8;
const MEANING_WEIGHT = 0.25; // 每種下一株就幫它的象徵詞（守護、耕作…）加一點分量

// 單字虛字：出現時當成斷點，不會被黏進詞裡
const BREAK_CHARS = new Set(
  '的了是在和跟與也很好都就還又再這那我你他她它吧啊呀喔哦耶嗎呢啦嘛囉太超最真有沒不被把給對從到讓會要愛去來說看更為得地著過們'
);

// 整個詞都是虛詞，或「好美、很棒」這種到處都會出現、看不出內容的形容
const STOP_TERMS = new Set([
  '我們', '你們', '他們', '大家', '都是', '都有', '一起', '真的', '非常', '因為', '所以', '但是', '可以', '這裡',
  '那裡', '這個', '那個', '一個', '什麼', '還是', '就是', '已經', '自己', '覺得', '一下', '一定', '有點',
  '我是', '這是', '那是', '也是', '不是', '這樣', '那樣', '你好', '您好', '希望', '喜歡', '認識',
  '一切', '下次', '一日', '之間', '整片', '一片', '一株', '一棵', '一座', '種下', '長出', '長出來', '吹著',
  'the', 'and', 'you', 'for', 'are', 'this', 'that', 'with', 'is', 'to', 'of', 'in', 'it', 'so', 'a', 'an', 'i',
]);
const DEGREE_PREFIX = /^[好很超太最真蠻挺]./u;

const HAN = /\p{Script=Han}/u;
const WORDLIKE = /[\p{L}\p{N}]/u;

// 先辨認完整的地方與植物詞，再處理其餘文字，避免把「日南稻站」拆成「日南稻／站長出」。
// 這些詞只在留言實際提到時擷取，不會額外產生留言沒有的內容。
const LOCAL_TERMS = [
  '日南稻站', '日南火車站', '日南車站', '日南人', '日南', '大甲芋頭', '大甲溪', '大安溪',
  '強勁的東北季風', '東北季風', '九降風', '東北風', '舊鐵橋', '人情味', '火車站', '八月雪', '黃金稻浪', '鐵道便當', '芋頭米粉',
  '地方創生', '鐵道文化', '日常生活', '臺灣欒樹',
];
const escapePattern = (term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PHRASES = new RegExp([...new Set([...LOCAL_TERMS, ...PLANTS.flatMap((plant) => [plant.name, plant.meaning])])]
  .sort((a, b) => b.length - a.length).map(escapePattern).join('|'), 'gu');
const FILLERS = new RegExp([...STOP_TERMS].filter((term) => HAN.test(term))
  .sort((a, b) => b.length - a.length).map(escapePattern).join('|'), 'gu');
const SINGLE_FILLERS = new RegExp([...BREAK_CHARS].join('|'), 'gu');

// 舊留言中的地方稱呼統一換成展場上較容易理解的用語。
const DISPLAY_TERMS = new Map([
  ['九降風', '東北風'],
  ['東北季風', '東北風'],
  ['強勁的東北季風', '東北風'],
]);

function fallbackTokens(text) {
  const cleaned = text.replace(FILLERS, ' ').replace(SINGLE_FILLERS, ' ');
  return [...cleaned.matchAll(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu)]
    .map(([segment]) => ({ segment, isWordLike: WORDLIKE.test(segment) }));
}

let segmenter;
function getSegmenter() {
  if (segmenter === undefined) {
    segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh-Hant', { granularity: 'word' }) : null;
  }
  return segmenter;
}

function isStop(term) {
  const lower = term.toLowerCase();
  if (STOP_TERMS.has(lower)) return true;
  if (!lower.replace(FILLERS, '').replace(SINGLE_FILLERS, '')) return true;
  return term.length === 2 && DEGREE_PREFIX.test(term);
}

// 一組連續、中間沒有斷點的片段 → 詞。連續的單字先黏成一串；落單的單字
// 再黏到相鄰的詞上（八月＋雪 → 八月雪、甜＋根子＋草 → 甜根子草）。
function mergeGroup(group) {
  const runs = [];
  group.forEach((seg) => {
    const single = seg.length === 1 && HAN.test(seg);
    const last = runs[runs.length - 1];
    if (single && last?.singles) last.text += seg;
    else runs.push({ text: seg, singles: single });
  });

  const out = [];
  runs.forEach((run, i) => {
    const lone = run.singles && run.text.length === 1;
    if (!lone) {
      out.push(run.text);
      return;
    }
    if (out.length > 0) out[out.length - 1] += run.text;
    else if (runs[i + 1]) runs[i + 1].text = run.text + runs[i + 1].text;
  });
  return out;
}

/** 一則留言切出來的關鍵詞（同一則裡重複的只算一次）。 */
export function extractTerms(message) {
  const text = (message || '').normalize('NFKC').trim();
  if (!text) return [];

  const seg = getSegmenter();
  const terms = new Set();
  const readFragment = (fragment) => {
    if (!fragment) return;
    const before = terms.size;
    let group = [];
    let sawContent = false;
    const flush = () => {
      mergeGroup(group).forEach((t) => {
        if (t.length >= 2 && t.length <= MAX_TERM_LENGTH && !isStop(t)) terms.add(t);
      });
      group = [];
    };
    const tokens = seg ? seg.segment(fragment) : fallbackTokens(fragment);
    for (const { segment, isWordLike } of tokens) {
      if (!isWordLike || !WORDLIKE.test(segment)) {
        flush();
      } else if (isStop(segment) || (segment.length === 1 && BREAK_CHARS.has(segment))) {
        flush();
      } else if (!HAN.test(segment)) {
        // 英文、數字自成一詞，不跟中文黏在一起
        flush();
        if (segment.length >= 2 && segment.length <= MAX_TERM_LENGTH * 2 && !isStop(segment)) terms.add(segment);
      } else {
        sawContent = true;
        group.push(segment);
      }
    }
    flush();
    // 保留「田好香」這類有內容的短句；純虛詞及自我介紹片段不再從備援規則回流。
    if (terms.size === before && sawContent) {
      const compact = fragment.replace(/[\s\p{P}\p{S}]/gu, '');
      if (compact.length >= 2 && compact.length <= MAX_TERM_LENGTH && !isStop(compact)
        && !/^[我你他她它這那]/u.test(compact)
        && compact.replace(FILLERS, '').replace(SINGLE_FILLERS, '').length >= 2) terms.add(compact);
    }
  };
  const readRest = (fragment) => fragment.split(/[^\p{L}\p{N}]+/u).forEach(readFragment);

  let start = 0;
  for (const match of text.matchAll(PHRASES)) {
    readRest(text.slice(start, match.index));
    terms.add(DISPLAY_TERMS.get(match[0]) || match[0]);
    start = match.index + match[0].length;
  }
  readRest(text.slice(start));
  return [...terms];
}

/**
 * 算出文字雲要顯示的詞與分量。
 * rows：牆上的種植紀錄（新到舊、舊到新都可以）；freshIds：剛落地的那幾筆，
 * 它們的詞會被標成 fresh，在天空中亮一下。
 */
export function buildCloud(rows, { freshIds = new Set(), limit = 36 } = {}) {
  const words = new Map();
  const bump = (term, weight, kind, fresh) => {
    const key = term.toLowerCase();
    const word = words.get(key) ?? { term, weight: 0, count: 0, kind, fresh: false };
    word.weight += weight;
    if (kind === 'message') {
      word.count += 1;
      word.kind = 'message';
    }
    word.fresh ||= fresh;
    words.set(key, word);
  };

  rows.forEach((row) => {
    const fresh = freshIds.has(row.id);
    extractTerms(row.message).forEach((term) => bump(term, 1, 'message', fresh));
    const meaning = plantById(row.plant_type)?.meaning;
    if (meaning) bump(meaning, MEANING_WEIGHT, 'meaning', false);
  });

  // 開展第一天天空也不會空著：六種植物的象徵詞永遠在。
  ['守護', '耕作', '實踐', '日常', '韌性', '生命力'].forEach((meaning) => {
    if (!words.has(meaning)) bump(meaning, MEANING_WEIGHT, 'meaning', false);
  });

  // 排序只看分量，不看 fresh：同一批詞在亮起／熄滅前後的位置才不會跳動。
  const sorted = [...words.values()].sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));
  // 剛落地那則留言的詞一定要上天空，就算分量還排不進前幾名：
  // 擠掉同樣數量、分量最輕的舊詞，天空的總詞數不變，才確定排得進去。
  const extraFresh = sorted.slice(limit).filter((word) => word.fresh);
  const shown = sorted.slice(0, limit);
  for (let i = shown.length - 1; i >= 0 && extraFresh.length > 0 && shown.length + extraFresh.length > limit; i -= 1) {
    if (!shown[i].fresh) shown.splice(i, 1);
  }
  return [...shown, ...extraFresh];
}
