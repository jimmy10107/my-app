// 六種植物的簡化 SVG 圖示，用同一套 viewBox 方便在 PlantPicker 與 Wall 上共用與縮放。
const PATHS = {
  casuarina: 'M32 58V20M32 20l-14 10M32 26l14-10M32 32l-12 9M32 38l12 9',
  rice: 'M32 58V26M32 26c-6-2-9-9-8-16 7 1 12 6 12 12M32 30c6-2 9-9 8-16-7 1-12 6-12 12M32 34c-5-1-8-6-7-12',
  taro: 'M32 58V34M32 34c-10 0-16-8-14-18 10 0 16 8 14 18ZM32 34c10 0 16-8 14-18-10 0-16 8-14 18Z',
  koelreuteria: 'M32 58V30M32 30c8 0 14-6 14-14-8 0-14 6-14 14ZM32 30c-8 0-14-6-14-14 8 0 14 6 14 14ZM32 22c5 0 9-4 9-9-5 0-9 4-9 9Z',
  miscanthus: 'M32 58V24M32 24c-3-8-2-16 3-20M32 24c3-8 2-16-3-20M32 30c-4-6-4-13 0-18M32 30c4-6 4-13 0-18',
  broussonetia: 'M32 58V28M32 28c-9 2-16-4-16-13 9-2 16 4 16 13ZM32 28c9 2 16-4 16-13-9-2-16 4-16 13Z',
};

export function PlantIcon({ type, color = '#4a5a3f', size = 48 }) {
  const d = PATHS[type] || PATHS.rice;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d={d} stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="58" r="3" fill={color} opacity="0.6" />
    </svg>
  );
}
