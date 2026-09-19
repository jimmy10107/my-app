// 六種植物與其象徵意義，對應《往返》GROUND｜生根 展項的 Grounded in Rinan 數位互動植生牆
export const PLANTS = [
  { id: 'casuarina', name: '木麻黃', meaning: '守護', color: '#3b5a45' },
  { id: 'rice', name: '水稻', meaning: '耕作', color: '#c9a227' },
  { id: 'taro', name: '芋頭', meaning: '實踐', color: '#5a7247' },
  { id: 'koelreuteria', name: '台灣欒樹', meaning: '日常', color: '#d97b3f' },
  { id: 'miscanthus', name: '甜根子草', meaning: '韌性', color: '#c9c2a0' },
  { id: 'broussonetia', name: '構樹', meaning: '生命力', color: '#6b8f3f' },
];

export function plantById(id) {
  return PLANTS.find((p) => p.id === id);
}
