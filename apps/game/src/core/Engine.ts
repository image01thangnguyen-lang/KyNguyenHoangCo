// ====================================================
// MODULE: Engine.ts — THREE.JS WEBGL RENDERER & GRAPHICS PROFILES
// ====================================================

export const GRAPHICS_STORAGE_KEY = 'KY_NGUYEN_HOANG_CO_GRAPHICS_PROFILE';
export let currentGraphicsProfile = localStorage.getItem(GRAPHICS_STORAGE_KEY) || ((window.devicePixelRatio && window.devicePixelRatio >= 2) ? 'ultra' : 'balanced');

export const canvas = document.getElementById('game3d');
export const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
  depth: true
});
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93c5fd);
scene.fog = new THREE.FogExp2(0xdbeafe, 0.0045);

export const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 450);
camera.position.set(0, 16, 22);

export const ambientLight = new THREE.AmbientLight(0xd9eafd, 0.45);
scene.add(ambientLight);

export const sunLight = new THREE.DirectionalLight(0xfff2cc, 1.35);
sunLight.castShadow = currentGraphicsProfile !== 'performance';
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 75;
sunLight.shadow.camera.left = -22;
sunLight.shadow.camera.right = 22;
sunLight.shadow.camera.top = 22;
sunLight.shadow.camera.bottom = -22;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight);
scene.add(sunLight.target);

export const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.35);
scene.add(hemiLight);

export const activeMixers = [];

export function getPixelRatioForProfile(profile) {
  const dpr = window.devicePixelRatio || 1;
  if (profile === 'ultra') return Math.min(dpr, 2.25);
  if (profile === 'balanced') return Math.min(dpr, 1.75);
  return Math.min(dpr, 1.25);
}

export function applyGraphicsProfile(profile, isInit = false, grassTexture = null) {
  currentGraphicsProfile = profile;
  try {
    localStorage.setItem(GRAPHICS_STORAGE_KEY, profile);
  } catch (e) {}

  const pixelRatio = getPixelRatioForProfile(profile);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (profile === 'performance') {
    renderer.shadowMap.enabled = false;
    if (sunLight) sunLight.castShadow = false;
  } else {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    if (sunLight) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
    }
  }

  if (grassTexture) {
    const maxAniso = renderer.capabilities.getMaxAnisotropy() || 1;
    grassTexture.anisotropy = profile === 'ultra' ? Math.min(maxAniso, 4) : profile === 'balanced' ? Math.min(maxAniso, 2) : 1;
    grassTexture.needsUpdate = true;
  }
}

renderer.setPixelRatio(getPixelRatioForProfile(currentGraphicsProfile));
renderer.setSize(window.innerWidth, window.innerHeight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(getPixelRatioForProfile(currentGraphicsProfile));
});

export function freezeStaticModel(model) {
  model.matrixAutoUpdate = false;
  model.updateMatrix();
  model.traverse((child) => {
    if (child.isMesh) {
      child.matrixAutoUpdate = false;
      child.updateMatrix();
    }
  });
}

export function setupModelMesh(mesh) {
  mesh.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        node.material.roughness = 0.75;
        node.material.metalness = 0.1;
      }
    }
  });
}

export function setModelActualHeight(root, targetHeight, isFbx = false) {
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(root);
  const currentHeight = bbox.max.y - bbox.min.y;
  if (currentHeight > 0.001) {
    const s = targetHeight / currentHeight;
    root.scale.set(s, s, s);
    root.position.y = -bbox.min.y * s;
  }
}

export const _camForward = new THREE.Vector3();
export const _camRight = new THREE.Vector3();
export const _moveVec = new THREE.Vector3();
export const _targetCam = new THREE.Vector3();
export const _upVec = new THREE.Vector3(0, 1, 0);
