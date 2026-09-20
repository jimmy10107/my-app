// 基本的不雅／粗俗／歧視字詞比對，用在留言與暱稱送出前的第一道防線。
// 這是關鍵字比對，不是語意判斷，抓不完所有變形寫法（例如刻意分開的注音、同音異字）。
// 正式上線建議把這層當第一道防線，搭配後台人工審核（本系統本來就有 pending 審核），
// 未來也可以把 BLOCKED_WORDS 換成開源不雅字庫或第三方內容審查 API。
const BLOCKED_WORDS = [
  '幹', '屌', '你媽的', '他媽的', '媽的', '靠北', '靠杯', '三小',
  '干恁娘', '恁祖媽', '白癡', '智障', '低能',
  '賤人', '婊子', '破麻', '雞掰', '機掰', '肏', '操你',
  '去死', '死全家', '王八蛋', '龜孫子', '狗娘養',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy', 'retard',
];

// 正常詞語裡剛好含有上面單字的組合，比對前先從文字中移除，避免誤判（文字獄）。
const SAFE_COMPOUNDS = [
  '幹細胞', '幹部', '幹嘛', '幹麼', '幹道', '幹練', '幹活', '幹員', '幹事',
  '幹線', '苦幹', '實幹', '幹勁', '主幹', '軀幹', '公幹', '能幹', '幹校',
];

function normalizeForFilter(str) {
  let normalized = str.toLowerCase().replace(/[\s.,\-_*~！!？?、，。]/g, '');
  SAFE_COMPOUNDS.forEach((safe) => {
    normalized = normalized.split(safe).join('');
  });
  return normalized;
}

export function containsBlockedContent(str) {
  if (!str) return false;
  const normalized = normalizeForFilter(str);
  return BLOCKED_WORDS.some((word) => normalized.includes(word));
}
