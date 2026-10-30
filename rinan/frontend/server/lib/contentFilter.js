// 基本的不雅／粗俗／歧視字詞比對，留言與暱稱送出時的第一道防線。
// 這是關鍵字比對，不是語意判斷，抓不完所有變形寫法（例如同音異字）。
// 種下後會立刻出現在投影牆，漏網的內容由值班人員在後台一鍵下架。
const BLOCKED_WORDS = [
  '幹', '屌', '你媽的', '他媽的', '媽的', '尼瑪', '靠北', '靠杯', '靠腰', '三小',
  '干恁娘', '恁祖媽', '白癡', '智障', '低能', 'ㄍㄢ',
  '賤人', '婊子', '破麻', '雞掰', '機掰', '雞巴', '肏', '屄', '傻逼', '操你',
  '去死', '死全家', '王八蛋', '龜孫子', '狗娘養', '支那', '台巴子',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy', 'retard', 'nigger', 'nigga',
];

// 正常詞語裡剛好含有上面單字的組合，比對前先從文字中移除，避免誤判（文字獄）。
const SAFE_COMPOUNDS = [
  '幹細胞', '幹部', '幹嘛', '幹麼', '幹道', '幹練', '幹活', '幹員', '幹事',
  '幹線', '苦幹', '實幹', '幹勁', '主幹', '軀幹', '公幹', '能幹', '幹校',
];

function normalizeForFilter(str) {
  // NFKC 把全形英數（ｆｕｃｋ）、相容字元折回一般寫法，避免用全形字繞過比對。
  let normalized = str.normalize('NFKC').toLowerCase().replace(/[\s.,\-_*~！!？?、，。]/g, '');
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
