// 投影牆用的植物圖像：由素材包真實 glTF 模型以 CloseupScene 同一套打光預先渲染成透明底圖，
// 以面向鏡頭的 sprite 顯示，取代原本的低多邊形程序化模型——畫面質感等同真實模型，
// 但牆上同時長幾十株也幾乎沒有 GPU 負擔。
// size 為實際公尺尺寸 [寬, 高]；anchor 為植株基部在圖上的位置（UV，y 由下往上）。
export const PLANT_SPRITES = {
  casuarina: [
    { file: '/models/sprites/casuarina_seedling.webp', anchor: [0.4641, 0.0195], size: [0.2336, 0.4001] },
    { file: '/models/sprites/casuarina_growth.webp', anchor: [0.4542, 0.0239], size: [1.3221, 2.2126] },
    { file: '/models/sprites/casuarina_bloom.webp', anchor: [0.485, 0.0241], size: [6.5133, 8.165] },
    { file: '/models/sprites/casuarina_decline.webp', anchor: [0.5061, 0.0248], size: [6.5994, 8.4895] },
  ],
  rice: [
    { file: '/models/sprites/rice_seedling.webp', anchor: [0.5869, 0.042], size: [0.1919, 0.2115] },
    { file: '/models/sprites/rice_growth.webp', anchor: [0.487, 0.0479], size: [0.6361, 0.5936] },
    { file: '/models/sprites/rice_bloom.webp', anchor: [0.4603, 0.0323], size: [1.1309, 1.1427] },
    { file: '/models/sprites/rice_decline.webp', anchor: [0.471, 0.1117], size: [1.0064, 1.3139] },
  ],
  taro: [
    { file: '/models/sprites/taro_seedling.webp', anchor: [0.6416, 0.091], size: [0.2205, 0.2915] },
    { file: '/models/sprites/taro_growth.webp', anchor: [0.5432, 0.0491], size: [0.4931, 0.6691] },
    { file: '/models/sprites/taro_bloom.webp', anchor: [0.428, 0.0343], size: [1.0861, 1.2685] },
    { file: '/models/sprites/taro_decline.webp', anchor: [0.5376, 0.035], size: [0.7906, 1.1475] },
  ],
  koelreuteria: [
    { file: '/models/sprites/koelreuteria_seedling.webp', anchor: [0.4984, 0.0305], size: [0.4836, 0.3182] },
    { file: '/models/sprites/koelreuteria_growth.webp', anchor: [0.4608, 0.0292], size: [2.5608, 1.5299] },
    { file: '/models/sprites/koelreuteria_bloom.webp', anchor: [0.5062, 0.0289], size: [4.6688, 3.4543] },
    { file: '/models/sprites/koelreuteria_decline.webp', anchor: [0.5369, 0.0245], size: [4.3357, 3.7097] },
  ],
  miscanthus: [
    { file: '/models/sprites/saccharum_seedling.webp', anchor: [0.5058, 0.0486], size: [0.2182, 0.3161] },
    { file: '/models/sprites/saccharum_growth.webp', anchor: [0.4895, 0.1178], size: [0.8369, 1.0625] },
    { file: '/models/sprites/saccharum_bloom.webp', anchor: [0.5004, 0.1158], size: [1.5938, 2.5809] },
    { file: '/models/sprites/saccharum_decline.webp', anchor: [0.5329, 0.1397], size: [1.3729, 2.4416] },
  ],
  broussonetia: [
    { file: '/models/sprites/broussonetia_seedling.webp', anchor: [0.4482, 0.0334], size: [0.5077, 0.2971] },
    { file: '/models/sprites/broussonetia_growth.webp', anchor: [0.4628, 0.0286], size: [2.2419, 1.5976] },
    { file: '/models/sprites/broussonetia_bloom.webp', anchor: [0.5222, 0.0252], size: [3.5972, 2.6638] },
    { file: '/models/sprites/broussonetia_decline.webp', anchor: [0.4843, 0.0241], size: [3.6698, 2.7388] },
  ],
};
