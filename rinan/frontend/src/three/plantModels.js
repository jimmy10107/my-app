import * as THREE from 'three';

// 低多邊形、風格化的程序生成植物模型。
// 每種植物有 4 個生長階段（幼苗／生長／盛開／凋萎），對應 lib/plants.js 的 stageColors。
// 幾何體與材質都是輕量的（Cone/Sphere/Cylinder/Extrude），適合在投影用的一般電腦上大量同時渲染。

function material(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.05,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    flatShading: true,
  });
}

function mesh(geometry, color, opts) {
  return new THREE.Mesh(geometry, material(color, opts));
}

function trunk(height, radiusTop, radiusBottom, color) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 6);
  geo.translate(0, height / 2, 0);
  return mesh(geo, color, { roughness: 0.95 });
}

function leafShape(width, length) {
  // 寬圓的葉片輪廓（最寬處在葉柄與葉尖中間偏後），適合芋頭／構樹這類闊葉。
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(width, length * 0.42, 0, length);
  shape.quadraticCurveTo(-width, length * 0.42, 0, 0);
  return shape;
}

// 建一片「攤平躺著、葉柄在原點、葉尖朝 -Z 延伸」的葉片幾何體，
// 這樣之後只要用 pivot.rotation.y 決定葉片朝哪個水平方向長、
// 再用 leaf.rotation.x 決定下垂幅度，兩個旋轉互不干擾、好預測。
function flatLeafGeometry(width, length, depth = 0.012) {
  const geo = new THREE.ExtrudeGeometry(leafShape(width, length), { depth, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function leafMeshGroup(count, baseHeight, width, length, color, opts = {}) {
  const group = new THREE.Group();
  const droop = opts.droop ?? 0.4;
  for (let i = 0; i < count; i += 1) {
    const pivot = new THREE.Group();
    pivot.position.set(0, baseHeight, 0);
    pivot.rotation.y = (i / count) * Math.PI * 2 + i * 0.9;

    const geo = flatLeafGeometry(width, length);
    const leaf = mesh(geo, color, { roughness: 0.55 });
    // 負角度讓葉尖（-Z 那端）往下垂，角度越大垂得越低（凋萎階段用大角度）。
    leaf.rotation.x = -(droop + Math.abs(Math.sin(i * 2.3)) * 0.12);
    leaf.scale.setScalar(0.85 + (i % 3) * 0.08);
    pivot.add(leaf);
    group.add(pivot);
  }
  return group;
}

function canopyCluster(lobeCount, radius, height, color, opts = {}) {
  const group = new THREE.Group();
  for (let i = 0; i < lobeCount; i += 1) {
    const r = radius * (0.55 + Math.random() * 0.5);
    const geo = new THREE.IcosahedronGeometry(r, 0);
    const lobe = mesh(geo, color, { roughness: 0.85 });
    const a = (i / lobeCount) * Math.PI * 2;
    const rad = radius * 0.5 * Math.random();
    lobe.position.set(Math.cos(a) * rad, height + Math.random() * radius * 0.6, Math.sin(a) * rad);
    group.add(lobe);
  }
  if (opts.dots) {
    const dotColor = opts.dotColor ?? color;
    for (let i = 0; i < opts.dots; i += 1) {
      const geo = new THREE.SphereGeometry(radius * 0.09, 5, 4);
      const dot = mesh(geo, dotColor, { roughness: 0.4, metalness: 0.1 });
      const a = Math.random() * Math.PI * 2;
      const rad = radius * (0.6 + Math.random() * 0.5);
      dot.position.set(Math.cos(a) * rad, height + Math.random() * radius, Math.sin(a) * rad);
      group.add(dot);
    }
  }
  return group;
}

// 木麻黃細長下垂的針葉束：每一束針葉都是「從樹幹上一點往外、往下垂」，
// 跟葉片用同一種 pivot 技巧（先攤平沿 -Z 延伸，再用 rotation.y 決定水平方向、
// rotation.x 決定下垂幅度），才會像真的從枝條垂下來，而不是亂飛的碎片。
function needleTiers(tiers, baseHeight, tierGap, needlesPerTier, needleLength, color) {
  const group = new THREE.Group();
  for (let t = 0; t < tiers; t += 1) {
    const y = baseHeight + t * tierGap;
    for (let i = 0; i < needlesPerTier; i += 1) {
      const pivot = new THREE.Group();
      pivot.position.set(0, y, 0);
      pivot.rotation.y = (i / needlesPerTier) * Math.PI * 2 + t * 0.7;

      const geo = new THREE.ConeGeometry(0.01, needleLength, 4);
      geo.translate(0, needleLength / 2, 0); // 錐底（粗端）移到原點，錐尖朝 +Y 延伸
      geo.rotateX(-Math.PI / 2); // 攤平，錐尖改朝 -Z 延伸
      const needle = mesh(geo, color, { roughness: 0.9 });
      needle.rotation.x = -0.55; // 往下垂
      pivot.add(needle);
      group.add(pivot);
    }
  }
  return group;
}

function grassBlades(count, height, spread, color, opts = {}) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i += 1) {
    const h = height * (0.75 + Math.random() * 0.5);
    const geo = new THREE.CylinderGeometry(0.008, 0.018, h, 4);
    geo.translate(0, h / 2, 0);
    const blade = mesh(geo, color, { roughness: 0.7 });
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;
    blade.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    blade.rotation.z = (Math.random() - 0.5) * (opts.lean ?? 0.35);
    blade.rotation.x = (Math.random() - 0.5) * (opts.lean ?? 0.35);
    group.add(blade);
  }
  return group;
}

function plumeCluster(count, height, radius, color) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i += 1) {
    const geo = new THREE.ConeGeometry(radius * 0.35, radius, 4);
    const tuft = mesh(geo, color, { roughness: 0.5 });
    const a = (i / count) * Math.PI * 2;
    tuft.position.set(Math.cos(a) * radius * 0.3, height, Math.sin(a) * radius * 0.3);
    tuft.rotation.z = Math.cos(a) * 0.5;
    tuft.rotation.x = Math.sin(a) * 0.5;
    group.add(tuft);
  }
  return group;
}

// ---------------------------------------------------------------------------
// 每種植物 4 個生長階段的建構函式
// ---------------------------------------------------------------------------

const BUILDERS = {
  rice: (stage, colors) => {
    const g = new THREE.Group();
    const c = colors[stage];
    if (stage === 0) {
      g.add(trunk(0.18, 0.006, 0.01, c));
    } else if (stage === 1) {
      g.add(trunk(0.42, 0.008, 0.012, c));
      const tip = grassBlades(3, 0.12, 0.012, c, { lean: 0.2 });
      tip.position.y = 0.4;
      g.add(tip);
    } else if (stage === 2) {
      g.add(trunk(0.6, 0.008, 0.014, colors[1]));
      const head = grassBlades(0, 0, 0, c); // placeholder group anchor
      head.position.y = 0.58;
      head.rotation.z = 0.55;
      for (let i = 0; i < 9; i += 1) {
        const grain = mesh(new THREE.SphereGeometry(0.02, 5, 4), c, { roughness: 0.4, metalness: 0.15 });
        grain.position.set(Math.sin(i * 0.9) * 0.02, -i * 0.035, Math.cos(i * 0.9) * 0.015);
        head.add(grain);
      }
      g.add(head);
    } else {
      g.add(trunk(0.5, 0.007, 0.012, colors[3]));
      const head = new THREE.Group();
      head.position.y = 0.48;
      head.rotation.z = 0.95;
      for (let i = 0; i < 6; i += 1) {
        const grain = mesh(new THREE.SphereGeometry(0.018, 5, 4), colors[3], { roughness: 0.7 });
        grain.position.set(Math.sin(i * 0.9) * 0.018, -i * 0.03, Math.cos(i * 0.9) * 0.012);
        head.add(grain);
      }
      g.add(head);
    }
    return g;
  },

  taro: (stage, colors) => {
    const g = new THREE.Group();
    const c = colors[stage];
    const counts = [1, 2, 4, 3];
    const heights = [0.14, 0.26, 0.42, 0.34];
    // 芋頭葉近似盾形（寬≈長的8成），才會讀成「大雨傘葉」而不是一片細長刀葉。
    const widths = [0.08, 0.12, 0.18, 0.15];
    const lengths = [0.1, 0.15, 0.22, 0.19];
    const droops = [0.15, 0.3, 0.42, 0.95];
    g.add(trunk(heights[stage], 0.01, 0.014, colors[1]));
    g.add(leafMeshGroup(counts[stage], heights[stage], widths[stage], lengths[stage], c, { droop: droops[stage] }));
    return g;
  },

  koelreuteria: (stage, colors) => {
    const g = new THREE.Group();
    const c = colors[stage];
    const trunkH = [0.16, 0.32, 0.48, 0.46][stage];
    const canopyR = [0.06, 0.12, 0.2, 0.18][stage];
    g.add(trunk(trunkH, 0.014, 0.02, '#5a4632'));
    const dots = stage === 2 ? 14 : stage === 3 ? 6 : 0;
    g.add(canopyCluster(stage === 0 ? 3 : 7, canopyR, trunkH, c, { dots, dotColor: stage === 2 ? '#fff3d0' : '#e08aa0' }));
    return g;
  },

  casuarina: (stage, colors) => {
    const g = new THREE.Group();
    const c = colors[stage];
    const trunkH = [0.15, 0.34, 0.62, 0.5][stage];
    g.add(trunk(trunkH, 0.01, 0.018, '#3a3226'));
    const tiers = [0, 2, 5, 3][stage];
    if (tiers > 0) g.add(needleTiers(tiers, trunkH * 0.35, trunkH * 0.16, 7, trunkH * 0.22, c));
    return g;
  },

  miscanthus: (stage, colors) => {
    const g = new THREE.Group();
    const c = colors[stage];
    const counts = [3, 6, 8, 6];
    const heights = [0.14, 0.3, 0.48, 0.4];
    g.add(grassBlades(counts[stage], heights[stage], 0.05, c, { lean: 0.3 }));
    if (stage === 2) g.add(plumeCluster(6, heights[2], 0.09, colors[2]));
    if (stage === 3) g.add(plumeCluster(3, heights[3] * 0.9, 0.06, '#a89f8c'));
    return g;
  },

  broussonetia: (stage, colors) => {
    const g = new THREE.Group();
    const c = colors[stage];
    const counts = [1, 3, 6, 4];
    const heights = [0.12, 0.22, 0.36, 0.3];
    // 構樹葉偏橢圓，比芋頭窄一些。
    const widths = [0.05, 0.07, 0.1, 0.09];
    const lengths = [0.08, 0.12, 0.17, 0.15];
    const droops = [0.15, 0.28, 0.38, 0.85];
    g.add(trunk(heights[stage], 0.008, 0.012, '#6b5a3f'));
    g.add(leafMeshGroup(counts[stage], heights[stage], widths[stage], lengths[stage], c, { droop: droops[stage] }));
    if (stage === 2) {
      for (let i = 0; i < 10; i += 1) {
        const berry = mesh(new THREE.SphereGeometry(0.014, 5, 4), '#c0503f', { roughness: 0.35, metalness: 0.1 });
        const a = Math.random() * Math.PI * 2;
        const r = widths[2] * 1.6 * Math.random();
        berry.position.set(Math.cos(a) * r, heights[2] * (0.6 + Math.random() * 0.4), Math.sin(a) * r);
        g.add(berry);
      }
    }
    return g;
  },
};

/**
 * 建立一種植物在某個生長階段的 3D 模型（每次呼叫都會產生新的 mesh 實例，
 * 因為每筆種植紀錄需要獨立控制位置、縮放與透明度，不能共用同一個 Object3D）。
 */
export function buildStage(speciesId, stage, stageColors) {
  const builder = BUILDERS[speciesId];
  if (!builder) return new THREE.Group();
  return builder(stage, stageColors);
}

export function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}
