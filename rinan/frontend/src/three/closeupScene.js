import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const loader = new GLTFLoader();
const gltfCache = new Map();

// 模型＋貼圖有機會到 10~20MB，慢速網路下 load 事件可能真的要等好幾秒；
// 用 onProgress 讓使用者看到百分比而不是死掉的「載入中」，並設一個上限
// timeout，逾時就明確報錯（可重試），不要讓 Promise 無限期掛著。
const LOAD_TIMEOUT_MS = 30000;

function loadGltf(url, onProgress) {
  if (!gltfCache.has(url)) {
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS);
      loader.load(
        url,
        (gltf) => {
          clearTimeout(timer);
          resolve(gltf);
        },
        (event) => {
          if (event.total) onProgress?.(event.loaded / event.total);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    }).catch((err) => {
      gltfCache.delete(url);
      throw err;
    });
    gltfCache.set(url, promise);
  }
  return gltfCache.get(url);
}

// 進彈窗時提前在背景預載每個階段的 glTF（走同一個 gltfCache），
// 等使用者點到那個階段，load() 直接命中快取、幾乎秒開。
export function preloadGltf(url, onProgress) {
  return loadGltf(url, onProgress);
}

export class CloseupScene {
  constructor(canvas) {
    this.canvas = canvas;
    this._destroyed = false;
    this.clock = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.02, 50);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.4;

    const hemi = new THREE.HemisphereLight('#f6f2e8', '#2a2f26', 0.9);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight('#fff4e0', 1.6);
    key.position.set(2.4, 3.2, 2.2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#6f93a8', 0.55);
    rim.position.set(-2.6, 1.6, -1.8);
    this.scene.add(rim);

    this.model = null;
  }

  resize(width, height) {
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  frameToBounds(bounds) {
    const [min, max] = bounds;
    const center = new THREE.Vector3(
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) * 0.42,
      (min[2] + max[2]) / 2
    );
    const size = new THREE.Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    const radius = Math.max(size.length() * 0.5, 0.05);
    const distance = (radius / Math.sin((this.camera.fov * Math.PI) / 360)) * 1.25;

    this.controls.target.copy(center);
    this.camera.position.set(center.x + distance * 0.55, center.y + distance * 0.35, center.z + distance * 0.75);
    this.camera.near = Math.max(distance / 100, 0.01);
    this.camera.far = distance * 20;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = distance * 0.35;
    this.controls.maxDistance = distance * 2.2;
    this.controls.update();
  }

  async load(url, bounds, onProgress) {
    const gltf = await loadGltf(url, onProgress);
    if (this._destroyed) return;
    if (this.model) {
      this.scene.remove(this.model);
    }
    this.model = gltf.scene.clone(true);
    this.model.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = obj.material.clone();
        obj.material.side = THREE.DoubleSide;
      }
    });
    this.scene.add(this.model);
    this.frameToBounds(bounds);
  }

  start() {
    const loop = () => {
      if (this._destroyed) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  dispose() {
    // 模型幾何／貼圖來自模組層級的 gltfCache（同物種重複開故事彈窗會重用），
    // 這裡只清掉這個 viewer 自己的東西（renderer／controls／複製出來的 material），
    // 不動 geometry／texture，避免下次開同一物種時資源已經被 dispose 掉。
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.controls.dispose();
    if (this.model) {
      this.model.traverse((obj) => {
        if (obj.isMesh) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
    }
    this.renderer.dispose();
  }
}
