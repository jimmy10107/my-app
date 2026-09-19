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
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(width, length * 0.3, 0, length);
  shape.quadraticCurveTo(-width, length * 0.3, 0, 0);
  return shape;
}

function leafMeshGroup(count, baseHeight, width, length, color, opts = {}) {
  const group = new THREE.Group();
  const droop = opts.droop ?? 0.35;
  for (let i = 0; i < count; i += 1) {
    const geo = new THREE.ExtrudeGeometry(leafShape(width, length), { depth: 0.015, bevelEnabled: false });
    const leaf = mesh(geo, color, { roughness: 0.6 });
    const angle = (i / count) * Math.PI * 2 + i * 0.9;
    leaf.position.set(0, baseHeight, 0);
    leaf.rotation.y = angle;
    leaf.rotation.x = -Math.PI / 2 + droop + (Math.sin(i * 3.1) * 0.12);
    leaf.scale.setScalar(0.85 + (i % 3) * 0.08);
    group.add(leaf);
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

function needleTiers(tiers, baseHeight, tierGap, needlesPerTier, needleLength, color) {
  const group = new THREE.Group();
  for (let t = 0; t < tiers; t += 1) {
    const y = baseHeight + t * tierGap;
    const spread = 0.14 + t * 0.02;
    for (let i = 0; i < needlesPerTier; i += 1) {
      const geo = new THREE.ConeGeometry(0.012, needleLength, 4);
      const needle = mesh(geo, color, { roughness: 0.9 });
      const angle = (i / needlesPerTier) * Math.PI * 2 + t * 0.7;
      needle.position.set(Math.cos(angle) * spread, y, Math.sin(angle) * spread);
      needle.rotation.z = Math.cos(angle) * 1.1 + Math.PI;
      needle.rotation.x = Math.sin(angle) * 1.1;
      group.add(needle);
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
      g.add(canopyCluster(3, 0.05, 0.4, c));
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
    const widths = [0.05, 0.08, 0.13, 0.11];
    const lengths = [0.1, 0.16, 0.24, 0.2];
    const droop = stage === 3 ? 0.75 : 0.3;
    g.add(trunk(heights[stage], 0.01, 0.014, colors[1]));
    g.add(leafMeshGroup(counts[stage], heights[stage], widths[stage], lengths[stage], c, { droop }));
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
    const widths = [0.04, 0.06, 0.09, 0.08];
    const lengths = [0.08, 0.13, 0.18, 0.15];
    const droop = stage === 3 ? 0.7 : 0.25;
    g.add(trunk(heights[stage], 0.008, 0.012, '#6b5a3f'));
    g.add(leafMeshGroup(counts[stage], heights[stage], widths[stage], lengths[stage], c, { droop }));
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
