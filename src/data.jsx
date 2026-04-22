// 薪資水瓶 Salary Bottle — real 108-card methodology
// 職業卡 54 (vocation) / 能力卡 31 (ability) / 價值卡 15 (value) / 輔助卡 8 (aid)

// Holland color system (R 土棕 / I 靛藍 / A 酒紅 / S 橙褐 / E 金黃 / C 青綠)
const HOLLAND = {
  R: { name: "實作型", solid: "#8B6849", deep: "#5E4631", wash: "#E8DDD1", letter: "R", cn: "實" },
  I: { name: "研究型", solid: "#3E5A8C", deep: "#243E6A", wash: "#D6DFEE", letter: "I", cn: "研" },
  A: { name: "藝術型", solid: "#8E3A4A", deep: "#5E1E2A", wash: "#ECD3D7", letter: "A", cn: "藝" },
  S: { name: "社交型", solid: "#B8693A", deep: "#7E4221", wash: "#EDD6C2", letter: "S", cn: "社" },
  E: { name: "企業型", solid: "#C99A2E", deep: "#8E6A14", wash: "#F3E6C0", letter: "E", cn: "企" },
  C: { name: "常規型", solid: "#4B8676", deep: "#295C4E", wash: "#D0E1DA", letter: "C", cn: "常" },
};

// Vocation cards (54) — [id, title, Holland primary/secondary]
const VOCATIONS = [
  // R — 實作型
  ["V01","機械工程師","R/I"],["V02","木工職人","R/A"],["V03","廚師","R/A"],["V04","農夫","R/I"],
  ["V05","獸醫","R/S"],["V06","消防員","R/S"],["V07","運動員","R/S"],["V08","飛行員","R/C"],["V09","汽車維修師","R/C"],
  // I — 研究型
  ["V10","資料科學家","I/C"],["V11","醫師","I/S"],["V12","心理諮商師","I/S"],["V13","科學研究員","I/A"],
  ["V14","UX 研究員","I/A"],["V15","軟體工程師","I/R"],["V16","策略顧問","I/E"],["V17","律師","I/E"],["V18","投資分析師","I/C"],
  // A — 藝術型
  ["V19","平面設計師","A/E"],["V20","作家","A/I"],["V21","電影導演","A/E"],["V22","音樂人","A/S"],
  ["V23","攝影師","A/E"],["V24","建築師","A/I"],["V25","室內設計師","A/R"],["V26","舞者","A/S"],["V27","時尚設計師","A/E"],
  // S — 社交型
  ["V28","教師","S/A"],["V29","社工","S/E"],["V30","護理師","S/I"],["V31","人力資源","S/E"],
  ["V32","職涯教練","S/A"],["V33","導遊","S/E"],["V34","非營利組織工作者","S/E"],["V35","客戶成功經理","S/E"],["V36","地方創生工作者","S/A"],
  // E — 企業型
  ["V37","創業家","E/A"],["V38","產品經理","E/I"],["V39","行銷企劃","E/A"],["V40","業務經理","E/S"],
  ["V41","房地產經紀","E/S"],["V42","活動策劃","E/A"],["V43","公關","E/S"],["V44","品牌總監","E/A"],["V45","新創營運","E/I"],
  // C — 常規型
  ["V46","會計師","C/I"],["V47","公務員","C/S"],["V48","專案管理","C/E"],["V49","行政主管","C/E"],
  ["V50","資料庫管理","C/I"],["V51","品管工程師","C/R"],["V52","財務規劃師","C/E"],["V53","保險精算師","C/I"],["V54","編輯","C/A"],
].map(([id,title,holland]) => ({ id, title, cat: "vocation", holland, hKey: holland.split("/")[0] }));

// Value cards (15)
const VALUES = [
  { id: "P01", title: "經濟報酬", hint: "收入達到什麼數字算滿意？" },
  { id: "P02", title: "獨立自主", hint: "你希望在工作中掌控哪些決定？" },
  { id: "P03", title: "生活平衡", hint: "理想工時是幾小時？是否接受加班？" },
  { id: "P04", title: "持續進步", hint: "什麼樣的成長讓你最有感？" },
  { id: "P05", title: "思考與學習", hint: "你想鑽研的主題是什麼？" },
  { id: "P06", title: "同事關係", hint: "怎樣的團隊氛圍讓你安心？" },
  { id: "P07", title: "認同感", hint: "你希望被誰、被什麼認可？" },
  { id: "P08", title: "上司關係", hint: "你想向怎樣的人學習？" },
  { id: "P09", title: "安定感", hint: "你無法忍受哪種不確定？" },
  { id: "P10", title: "情緒穩定", hint: "怎樣的工作環境讓你平靜？" },
  { id: "P11", title: "利他助人", hint: "你想幫助的是誰？" },
  { id: "P12", title: "環境永續", hint: "你想守護的是什麼？" },
  { id: "P13", title: "社會影響力", hint: "你想改變的是什麼？" },
  { id: "P14", title: "創造表達", hint: "你想創造什麼樣的作品？" },
  { id: "P15", title: "冒險挑戰", hint: "什麼樣的挑戰讓你熱血？" },
].map(v => ({ ...v, cat: "value" }));

// Ability cards (31) — hard (專業) or soft (可轉移)
const ABILITIES = [
  // Hard skills (16)
  ["A01","程式開發","hard"],["A02","數據分析","hard"],["A03","財務會計","hard"],["A04","法律知識","hard"],
  ["A05","醫學專業","hard"],["A06","機械操作","hard"],["A07","設計工具","hard"],["A08","外語能力","hard"],
  ["A09","行銷企劃","hard"],["A10","簡報製作","hard"],["A11","統計建模","hard"],["A12","文案寫作","hard"],
  ["A13","影像製作","hard"],["A14","UI/UX 設計","hard"],["A15","專案管理","hard"],["A16","銷售技巧","hard"],
  // Soft / transferable (15)
  ["A17","溝通表達","soft"],["A18","同理傾聽","soft"],["A19","結構化思考","soft"],["A20","問題解決","soft"],
  ["A21","時間管理","soft"],["A22","團隊合作","soft"],["A23","領導統御","soft"],["A24","談判協商","soft"],
  ["A25","抗壓能力","soft"],["A26","自主學習","soft"],["A27","跨域整合","soft"],["A28","創意發想","soft"],
  ["A29","決策判斷","soft"],["A30","情緒管理","soft"],["A31","敘事影響力","soft"],
].map(([id,title,kind]) => ({ id, title, cat: "ability", kind }));

// Aid cards (8) — facilitator-triggered prompts
const AIDS = [
  ["D01","如果現在有無限的勇氣……"],["D02","十年後回頭看自己……"],["D03","如果薪水不是問題……"],["D04","你會推薦給誰這份工作？"],
  ["D05","上一次你工作到忘記時間……"],["D06","你在哪裡感到最像自己？"],["D07","你最害怕別人怎麼看你？"],["D08","如果只能留下一張卡……"],
].map(([id,title]) => ({ id, title, cat: "aid" }));

const ALL_CARDS = [...VOCATIONS, ...VALUES, ...ABILITIES, ...AIDS];

// Job-to-ability requirements (simplified — map a subset for demo)
const JOB_REQS = {
  V15: ["A01","A02","A19","A20","A22"],      // 軟體工程師
  V19: ["A07","A14","A28","A12","A17"],      // 平面設計師
  V32: ["A17","A18","A20","A31","A27"],      // 職涯教練
  V38: ["A09","A15","A19","A20","A29"],      // 產品經理
  V37: ["A16","A23","A29","A25","A28"],      // 創業家
  V28: ["A17","A18","A19","A21","A22"],      // 教師
  V36: ["A17","A23","A27","A31","A28"],      // 地方創生
  V46: ["A03","A11","A15","A21","A29"],      // 會計
  V20: ["A12","A28","A26","A19","A31"],      // 作家
  V11: ["A05","A18","A25","A29","A20"],      // 醫師
};
const getJobReqs = (id) => JOB_REQS[id] || ["A17","A19","A20","A21","A22"];

// Dashboard scoring criteria (transparent definition)
const SCORE_CRITERIA = [
  { key: "自主性", basis: "「獨立自主 + 生活平衡」於 Top 3 × 目標職業屬 E/A 加權", source: "value × holland" },
  { key: "專業精通", basis: "目標職業硬實力具備率 ≥ 70% + 「持續進步 / 思考學習」入選", source: "ability gap × value" },
  { key: "持續成長", basis: "行動計畫有 Prototype 與停損時機 + 學習型卡權重", source: "action plan × value" },
  { key: "關係連結", basis: "「同事關係 / 上司 / 認同感」入選 × Holland 含 S 型", source: "value × holland" },
  { key: "安全感", basis: "「經濟報酬 / 安定感 / 情緒穩定」優先級 — 焦慮自評扣分", source: "value × self-rating" },
  { key: "社會貢獻", basis: "「利他 / 環境 / 影響力」權重 + 行動計畫回饋社會", source: "value × action plan" },
];

// Sample saved top 5 for dashboard
const SAMPLE_TOP5 = ["V32","V20","V38","P02","P14"];

// Student data (12) — restructured for new model
const STUDENTS = [
  { id: "S01", alias: "雲雀",   progress: 98,  stage: 4, top3Jobs:["V19","V20","V32"], topValues:["獨立自主","創造表達","利他助人"], holland:"A/S/I", flag:null,     friction:1.2, words:142, gaps:2 },
  { id: "S02", alias: "北辰",   progress:100,  stage: 4, top3Jobs:["V38","V16","V37"], topValues:["持續進步","社會影響力","獨立自主"], holland:"I/E/A", flag:null,     friction:0.8, words:210, gaps:1 },
  { id: "S03", alias: "溪石",   progress: 64,  stage: 2, top3Jobs:["V47","V49","—"], topValues:["安定感","同事關係","利他助人"], holland:"S/C/E", flag:"yellow", friction:2.4, words:38,  gaps:4, note:"安定感 × 滿意度落差"  },
  { id: "S04", alias: "遠帆",   progress: 86,  stage: 3, top3Jobs:["V37","V44","V21"], topValues:["社會影響力","獨立自主","創造表達"], holland:"E/A/S", flag:null,     friction:1.1, words:98,  gaps:2 },
  { id: "S05", alias: "榕蔭",   progress: 44,  stage: 2, top3Jobs:["V46","—","—"], topValues:["安定感","同事關係","經濟報酬"], holland:"C/S/R", flag:"red",    friction:3.2, words:12,  gaps:6, note:"Stage 2 停滯 · 二選一卡關" },
  { id: "S06", alias: "霜竹",   progress: 92,  stage: 4, top3Jobs:["V13","V15","V10"], topValues:["思考與學習","獨立自主","持續進步"], holland:"I/R/C", flag:null,     friction:0.9, words:176, gaps:1 },
  { id: "S07", alias: "雨燕",   progress: 78,  stage: 3, top3Jobs:["V30","V12","V28"], topValues:["利他助人","同事關係","安定感"], holland:"S/E/C", flag:null,     friction:1.4, words:88,  gaps:3 },
  { id: "S08", alias: "青苔",   progress: 58,  stage: 2, top3Jobs:["V25","V24","—"], topValues:["創造表達","獨立自主","持續進步"], holland:"A/I/E", flag:null,     friction:1.7, words:54,  gaps:3 },
  { id: "S09", alias: "晨霧",   progress: 82,  stage: 3, top3Jobs:["V40","V39","V37"], topValues:["持續進步","社會影響力","利他助人"], holland:"E/I/S", flag:null,     friction:1.0, words:132, gaps:2 },
  { id: "S10", alias: "星砂",   progress: 70,  stage: 3, top3Jobs:["V23","V44","V42"], topValues:["同事關係","創造表達","安定感"], holland:"A/S/C", flag:null,     friction:1.3, words:76,  gaps:3 },
  { id: "S11", alias: "木棉",   progress: 36,  stage: 1, top3Jobs:["—","—","—"], topValues:["—","—","—"], holland:"—",     flag:null,     friction:0,   words:0,   gaps:0, idle:true },
  { id: "S12", alias: "潭心",   progress: 88,  stage: 4, top3Jobs:["V18","V53","V46"], topValues:["持續進步","經濟報酬","獨立自主"], holland:"I/C/R", flag:null,     friction:1.1, words:168, gaps:2 },
];

// Group value heat for console
const VALUE_HEAT = [
  { name: "獨立自主",   weight: 72, delta: +12 },
  { name: "持續進步",   weight: 68, delta: +8 },
  { name: "利他助人",   weight: 61, delta: +4 },
  { name: "同事關係",   weight: 54, delta: -2 },
  { name: "思考與學習", weight: 49, delta: +6 },
  { name: "創造表達",   weight: 44, delta: +10 },
  { name: "社會影響力", weight: 38, delta: -3 },
  { name: "安定感",     weight: 35, delta: -14 },
  { name: "經濟報酬",   weight: 28, delta: -8 },
  { name: "生活平衡",   weight: 22, delta: -1 },
  { name: "冒險挑戰",   weight: 14, delta: +2, island: true },
  { name: "環境永續",   weight: 9,  delta: 0,  island: true },
];

// Career snapshots for timeline
const SNAPSHOTS = [
  { date: "2024.03", values: { 自主性: 55, 專業精通: 48, 持續成長: 42, 關係連結: 68, 安全感: 72, 社會貢獻: 40 } },
  { date: "2024.11", values: { 自主性: 62, 專業精通: 55, 持續成長: 50, 關係連結: 58, 安全感: 54, 社會貢獻: 48 } },
  { date: "2026.04", values: { 自主性: 78, 專業精通: 70, 持續成長: 65, 關係連結: 56, 安全感: 40, 社會貢獻: 62 } },
];

Object.assign(window, {
  HOLLAND, VOCATIONS, VALUES, ABILITIES, AIDS, ALL_CARDS,
  getJobReqs, SCORE_CRITERIA, SAMPLE_TOP5,
  STUDENTS, VALUE_HEAT, SNAPSHOTS,
});
