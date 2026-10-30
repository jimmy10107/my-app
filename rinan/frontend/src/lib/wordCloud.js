import { plantById } from './plants.js';

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
  'the', 'and', 'you', 'for', 'are', 'this', 'that', 'with', 'is', 'to', 'of', 'in', 'it', 'so', 'a', 'an', 'i',
]);
const DEGREE_PREFIX = /^[好很超太最真蠻挺]./u;

const HAN = /\p{Script=Han}/u;
const WORDLIKE = /[\p{L}\p{N}]/u;

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
  if (seg) {
    let group = [];
    const flush = () => {
      mergeGroup(group).forEach((t) => {
        if (t.length >= 2 && t.length <= MAX_TERM_LENGTH && !isStop(t)) terms.add(t);
      });
      group = [];
    };
    for (const { segment, isWordLike } of seg.segment(text)) {
      if (!isWordLike || !WORDLIKE.test(segment)) {
        flush();
      } else if (segment.length === 1 && BREAK_CHARS.has(segment)) {
        flush();
      } else if (!HAN.test(segment)) {
        // 英文、數字自成一詞，不跟中文黏在一起
        flush();
        if (segment.length >= 2 && segment.length <= MAX_TERM_LENGTH * 2 && !isStop(segment)) terms.add(segment);
      } else {
        group.push(segment);
      }
    }
    flush();
  }

  // 「田好香」這種短句切不出詞，就整句當一個詞，訪客寫的話不會憑空消失。
  if (terms.size === 0) {
    const compact = text.replace(/[\s\p{P}\p{S}]/gu, '');
    if (compact.length >= 2 && compact.length <= MAX_TERM_LENGTH) terms.add(compact);
  }
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
