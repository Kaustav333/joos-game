import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { messages } from './messages.js';
import './style.css';
import './mute.css';

/* ========================================================================
   UI REFERENCES & SAVED STATE
   ======================================================================== */
const $ = id => document.getElementById(id);
const ui = {
  game: $('game'), loading: $('loadingScreen'), welcome: $('welcomeCard'), begin: $('beginButton'),
  stars: $('starCount'), region: $('regionName'), regionNote: $('regionNote'), quest: $('questText'),
  questKicker: $('questKicker'), questIcon: $('questIcon'), interact: $('interactButton'),
  interactLabel: $('interactLabel'), interactIcon: $('interactIcon'), toast: $('toast'),
  modal: $('modal'), modalTitle: $('modalTitle'), modalBody: $('modalBody'),
  modalEyebrow: $('modalEyebrow'), modalContinue: $('modalContinue'), closeModal: $('closeModal'),
  help: $('helpButton'), sound: $('soundButton'), soundPanel: $('soundPanel'),
  volume: $('volumeSlider'), volumeValue: $('volumeValue'), joystick: $('joystick'),
  joyKnob: $('joyKnob'), touchAction: $('touchAction'), interactButton: $('interactButton'),
  mute: $('muteToggle')
};

const saveKey = 'joos-little-universe-save-v1';
const saved = (() => { try { return JSON.parse(localStorage.getItem(saveKey) || '{}'); } catch { return {}; } })();
const state = {
  started: false, stars: new Set(saved.stars || []), notes: new Set(saved.notes || []),
  catBond: Math.max(0, Number(saved.catBond) || 0), finale: Boolean(saved.finale),
  pos: new THREE.Vector3(saved.x || 0, 0, saved.z || 0), vel: new THREE.Vector3(),
  heading: Math.PI, active: null, toastTimer: 0, modalOpen: false
};

/* ========================================================================
   SCENE, RENDERER & STUDIO GHIBLI ATMOSPHERE
   ======================================================================== */
const scene = new THREE.Scene();
scene.background = new THREE.Color('#78c0f5');
scene.fog = new THREE.FogExp2('#b8e2f8', 0.0055);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 350);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
ui.game.appendChild(renderer.domElement);

// Warm Ghibli Golden Sunlight
const hemiLight = new THREE.HemisphereLight('#b8e6ff', '#4d8236', 1.3);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight('#fff4dc', 2.3);
sun.position.set(-35, 55, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 190;
sun.shadow.bias = -0.0004;
scene.add(sun);

// Soft Blue Shadow Fill (Iconic Ghibli blue shadow tint)
const coolFill = new THREE.DirectionalLight('#72aee6', 0.65);
coolFill.position.set(30, 20, -35);
scene.add(coolFill);

// Warm Amber Rim Light
const rimLight = new THREE.DirectionalLight('#ffe0b2', 0.45);
rimLight.position.set(-20, 15, -40);
scene.add(rimLight);

/* ========================================================================
   GHIBLI WATERCOLOR SKY DOME & PUFFY CLOUDS
   ======================================================================== */
const skyGeo = new THREE.SphereGeometry(220, 32, 24);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  vertexShader: `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vPos;
    void main() {
      float h = normalize(vPos).y;
      vec3 zenith = vec3(0.15, 0.45, 0.82);   // Deep cerulean
      vec3 mid    = vec3(0.44, 0.74, 0.95);   // Soft azure
      vec3 horizon= vec3(0.99, 0.88, 0.74);   // Warm peach gold
      vec3 sunset = vec3(0.98, 0.72, 0.58);   // Soft apricot

      vec3 col;
      if (h > 0.28) {
        col = mix(mid, zenith, smoothstep(0.28, 0.9, h));
      } else if (h > 0.0) {
        col = mix(horizon, mid, smoothstep(0.0, 0.28, h));
      } else {
        col = mix(sunset, horizon, smoothstep(-0.2, 0.0, h));
      }

      // Soft sun glare
      vec3 sunDir = normalize(vec3(-0.35, 0.45, 0.3));
      float sunGlow = pow(max(0.0, dot(normalize(vPos), sunDir)), 14.0);
      col += vec3(1.0, 0.92, 0.75) * sunGlow * 0.4;
      gl_FragColor = vec4(col, 1.0);
    }
  `
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// Fluffy Storybook Clouds
const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 });
for (let i = 0; i < 30; i++) {
  const ang = i * 2.399, rad = 95 + (i % 5) * 9;
  const cg = new THREE.Group();
  cg.position.set(Math.cos(ang) * rad, 25 + (i % 6) * 4.5, Math.sin(ang) * rad);
  scene.add(cg);
  for (let j = 0; j < 7; j++) {
    const r = 3.2 + Math.sin(j) * 0.9;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cloudMat);
    puff.position.set((j - 3) * 2.6, Math.sin(j * 0.8) * 0.6, (j % 2) * 0.9);
    puff.scale.set(1.6, 0.55, 1.1);
    cg.add(puff);
  }
}

/* ========================================================================
   PROCEDURAL GHIBLI WATERCOLOR TEXTURES
   ======================================================================== */
function makeWatercolorGrassCanvas() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  
  // Base vibrant meadow green
  ctx.fillStyle = '#62ab42';
  ctx.fillRect(0, 0, 512, 512);

  // Soft dabs of emerald and sunlit lime
  const shades = ['#4e9632', '#6ebd49', '#78cf52', '#418228', '#88db5f'];
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const r = 8 + Math.random() * 18;
    ctx.fillStyle = shades[i % shades.length];
    ctx.globalAlpha = 0.18 + Math.random() * 0.22;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Little clover & wildflower specks
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    ctx.fillStyle = i % 3 === 0 ? '#fae66e' : i % 3 === 1 ? '#ff94b2' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 1.6 + Math.random() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

const grassTexture = new THREE.CanvasTexture(makeWatercolorGrassCanvas());
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(16, 16);

/* ========================================================================
   TERRAIN HEIGHT MAP & SCULPTED FLOATING ISLAND
   ======================================================================== */
function getTerrainHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r > 64) return -14;
  const edge = Math.max(0, Math.min(1, (r - 42) / 18));
  
  // Castle hill
  const castleDist = Math.hypot(x, z - 48);
  const castleH = Math.max(0, 1 - castleDist / 20) * 4.2;
  
  // Café knoll
  const cafeDist = Math.hypot(x + 31, z + 20);
  const cafeH = Math.max(0, 1 - cafeDist / 16) * 1.4;
  
  // Garden hill & pond
  const gardenDist = Math.hypot(x - 29, z + 18);
  const gardenH = Math.max(0, 1 - gardenDist / 18) * 1.1;
  const pondDist = Math.hypot(x - 29, z + 18);
  const pondH = Math.max(0, 1 - pondDist / 6.0) * -0.55;

  const rolling = Math.sin(x * 0.11 + Math.cos(z * 0.08) * 1.3) * 0.45 +
                  Math.cos(z * 0.12 + Math.sin(x * 0.07)) * 0.38;
  return 0.5 + rolling + castleH + cafeH + gardenH + pondH - edge * edge * 4.0;
}

const world = new THREE.Group();
scene.add(world);
const interactables = [], starObjects = [], animated = [], floraAnim = [];
const cherryPetals = [], fireflies = [];

// Sculpted island terrain
const tGeo = new THREE.PlaneGeometry(160, 160, 120, 120);
tGeo.rotateX(-Math.PI / 2);
const tPos = tGeo.attributes.position;
const tCol = new THREE.BufferAttribute(new Float32Array(tPos.count * 3), 3);
const cMeadow = new THREE.Color('#62ab42');
const cLush   = new THREE.Color('#4c9131');
const cPath   = new THREE.Color('#edd9aa');
const cCliff  = new THREE.Color('#9e8264');

function pathWeight(x, z) {
  const d1 = segDist(x, z, 0, 0, -15, -9) + segDist(x, z, -15, -9, -31, -20);
  const d2 = segDist(x, z, 0, 0, 14, -7)  + segDist(x, z, 14, -7, 29, -18);
  const d3 = segDist(x, z, 0, 0, 0, 22)   + segDist(x, z, 0, 22, 0, 42);
  const d4 = segDist(x, z, -18, -12, 0, -20) + segDist(x, z, 0, -20, 18, -12);
  return Math.max(0, 1 - Math.min(d1, d2, d3, d4) / 3.0);
}
function segDist(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz;
  if (!l2) return Math.hypot(px - x1, pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / l2));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

for (let i = 0; i < tPos.count; i++) {
  const x = tPos.getX(i), z = tPos.getZ(i), r = Math.hypot(x, z);
  tPos.setY(i, getTerrainHeight(x, z));
  const pw = pathWeight(x, z);
  let vc = cMeadow.clone().lerp(cLush, Math.sin(x * 0.16 + z * 0.12) * 0.5 + 0.5);
  if (pw > 0.08) vc.lerp(cPath, Math.min(1, pw * 1.5));
  if (r > 46) vc.lerp(cCliff, Math.min(1, (r - 46) / 12));
  tCol.setXYZ(i, vc.r, vc.g, vc.b);
}
tGeo.setAttribute('color', tCol);
tGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
  map: grassTexture,
  vertexColors: true,
  roughness: 0.85,
  metalness: 0.05
});
const terrainMesh = new THREE.Mesh(tGeo, terrainMat);
terrainMesh.receiveShadow = true;
world.add(terrainMesh);

// Layered island cliffs
const cliffMat = new THREE.MeshStandardMaterial({ color: '#8c7356', roughness: 0.9 });
const cliffUpper = new THREE.Mesh(new THREE.CylinderGeometry(62, 54, 6.0, 64, 2, true), cliffMat);
cliffUpper.position.set(0, -3.0, 0); cliffUpper.receiveShadow = true; world.add(cliffUpper);

const cliffLower = new THREE.Mesh(new THREE.ConeGeometry(54, 18, 48), new THREE.MeshStandardMaterial({ color: '#6e5842', roughness: 0.95 }));
cliffLower.position.set(0, -15, 0); cliffLower.rotation.x = Math.PI; world.add(cliffLower);

// Ocean
const seaMat = new THREE.MeshStandardMaterial({ color: '#4daec4', roughness: 0.2, transparent: true, opacity: 0.82, metalness: 0.15 });
const seaMesh = new THREE.Mesh(new THREE.CircleGeometry(130, 64), seaMat);
seaMesh.position.set(0, -1.2, 0); seaMesh.rotation.x = -Math.PI / 2; world.add(seaMesh);

/* ========================================================================
   SWAYING 3D GHIBLI GRASS TUFTS
   ======================================================================== */
const grassTuftGeo = new THREE.PlaneGeometry(0.7, 0.65);
grassTuftGeo.translate(0, 0.32, 0);
const grassBladeMat = new THREE.MeshStandardMaterial({
  color: '#84cf4e', side: THREE.DoubleSide, roughness: 0.7, alphaTest: 0.5
});
// Generate grass tuft canvas
const gtCanvas = document.createElement('canvas');
gtCanvas.width = 64; gtCanvas.height = 64;
const gtCtx = gtCanvas.getContext('2d');
gtCtx.fillStyle = '#78cf48';
for (let b = 0; b < 5; b++) {
  const bx = 12 + b * 10;
  gtCtx.beginPath();
  gtCtx.moveTo(bx - 3, 64);
  gtCtx.quadraticCurveTo(bx + (b - 2) * 4, 30, bx + (b - 2) * 7, 6);
  gtCtx.quadraticCurveTo(bx + (b - 2) * 3, 30, bx + 3, 64);
  gtCtx.fill();
}
grassBladeMat.map = new THREE.CanvasTexture(gtCanvas);
grassBladeMat.transparent = true;

const grassTufts = [];
for (let i = 0; i < 90; i++) {
  const ang = Math.random() * Math.PI * 2, rad = 5 + Math.random() * 38;
  const gx = Math.cos(ang) * rad, gz = Math.sin(ang) * rad;
  if (Math.hypot(gx + 31, gz + 20) < 9 || Math.hypot(gx - 29, gz + 18) < 9 || Math.hypot(gx, gz - 48) < 14) continue;
  const gy = getTerrainHeight(gx, gz);
  const gGroup = new THREE.Group();
  gGroup.position.set(gx, gy, gz);
  const p1 = new THREE.Mesh(grassTuftGeo, grassBladeMat);
  const p2 = new THREE.Mesh(grassTuftGeo, grassBladeMat);
  p2.rotation.y = Math.PI / 2;
  gGroup.add(p1, p2);
  gGroup.scale.setScalar(0.7 + Math.random() * 0.6);
  world.add(gGroup);
  grassTufts.push({ group: gGroup, phase: Math.random() * Math.PI * 2 });
}

/* ========================================================================
   GLTF MODEL LOADER & WORLD POPULATION
   ======================================================================== */
const loader = new GLTFLoader();

function loadGLB(url, pos, scale = 1.0, rotY = 0, onLoaded = null) {
  const container = new THREE.Group();
  container.position.set(...pos);
  container.scale.setScalar(scale);
  container.rotation.y = rotY;
  world.add(container);

  loader.load(url, (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.roughness = Math.max(0.4, child.material.roughness || 0.6);
        }
      }
    });
    container.add(model);
    if (onLoaded) onLoaded(model, container);
  }, undefined, (err) => {
    console.warn(`Could not load ${url}, falling back`, err);
  });
  return container;
}

// 1. Fairytale Castle
const castleY = getTerrainHeight(0, 48);
const castleGroup = loadGLB('/models/castle.glb', [0, castleY, 48], 1.0, 0, (m) => {
  // Find heart monument inside model to animate
  m.traverse((child) => {
    if (child.name.includes('Heart')) {
      animated.push({ mesh: child, kind: 'float', phase: 1.0 });
    }
  });
});

// 2. The Little Cup Café
const cafeY = getTerrainHeight(-31, -20);
loadGLB('/models/cafe.glb', [-31, cafeY, -20], 1.0, 0.35);

// 3. Wishing Garden Sanctuary & Fountain
const gardenY = getTerrainHeight(29, -18);
loadGLB('/models/garden.glb', [29, gardenY, -18], 1.0, -0.2);

// 4. Groves of Ghibli Anime Trees
const treePositions = [
  // Sakura Cherry Blossom grove near the Wishing Garden
  { url: '/models/tree_cherry.glb', x: 20, z: -25, s: 1.1 },
  { url: '/models/tree_cherry.glb', x: 38, z: -15, s: 1.25 },
  { url: '/models/tree_cherry.glb', x: 26, z: -10, s: 0.95 },
  { url: '/models/tree_cherry.glb', x: 34, z: -27, s: 1.15 },
  
  // Summer Oaks around the Meadow & pathways
  { url: '/models/tree_oak.glb', x: -14, z: 12, s: 1.1 },
  { url: '/models/tree_oak.glb', x: 15, z: 10, s: 1.0 },
  { url: '/models/tree_oak.glb', x: -10, z: 24, s: 1.2 },
  { url: '/models/tree_oak.glb', x: 12, z: 26, s: 1.15 },
  { url: '/models/tree_oak.glb', x: -6, z: -18, s: 0.9 },
  { url: '/models/tree_oak.glb', x: 8, z: -16, s: 1.05 },
  
  // Golden Autumn trees near the Café
  { url: '/models/tree_autumn.glb', x: -24, z: -28, s: 1.1 },
  { url: '/models/tree_autumn.glb', x: -38, z: -12, s: 1.05 },
  { url: '/models/tree_autumn.glb', x: -40, z: -26, s: 0.95 },
  { url: '/models/tree_autumn.glb', x: -22, z: -12, s: 1.0 },

  // Flanking trees on Castle Hill approach
  { url: '/models/tree_oak.glb', x: -16, z: 40, s: 1.2 },
  { url: '/models/tree_oak.glb', x: 16, z: 40, s: 1.2 },
  { url: '/models/tree_cherry.glb', x: -14, z: 54, s: 1.1 },
  { url: '/models/tree_cherry.glb', x: 14, z: 54, s: 1.1 },
];

for (const tp of treePositions) {
  const ty = getTerrainHeight(tp.x, tp.z);
  loadGLB(tp.url, [tp.x, ty, tp.z], tp.s, Math.random() * Math.PI * 2);
}

// Additional scattered wild oaks
let rSeed = 48271;
const rnd = () => { rSeed = (rSeed * 16807) % 2147483647; return (rSeed - 1) / 2147483646; };
for (let i = 0; i < 18; i++) {
  const ang = rnd() * Math.PI * 2, rad = 14 + rnd() * 28;
  const tx = Math.cos(ang) * rad, tz = Math.sin(ang) * rad;
  if (Math.hypot(tx + 31, tz + 20) < 12 || Math.hypot(tx - 29, tz + 18) < 12 || Math.hypot(tx, tz - 48) < 18 || Math.hypot(tx, tz) < 7) continue;
  const ty = getTerrainHeight(tx, tz);
  const u = i % 3 === 0 ? '/models/tree_cherry.glb' : i % 3 === 1 ? '/models/tree_autumn.glb' : '/models/tree_oak.glb';
  loadGLB(u, [tx, ty, tz], 0.8 + rnd() * 0.45, rnd() * Math.PI * 2);
}

/* ========================================================================
   12 COLLECTIBLE CELESTIAL STARS
   ======================================================================== */
const starSpots = [
  [-39, -24], [-24, -27], [-36, -8], [-20, -16],
  [22, -26], [38, -19], [30, -8], [42, -14],
  [-8, 44], [14, 44], [0, 56], [0, 32]
];
const starMat = new THREE.MeshStandardMaterial({
  color: '#ffe880', emissive: '#f5b026', emissiveIntensity: 2.2, roughness: 0.25, metalness: 0.8
});
const starGlowMat = new THREE.MeshBasicMaterial({ color: '#ffea78', transparent: true, opacity: 0.35, side: THREE.DoubleSide });

starSpots.forEach(([sx, sz], i) => {
  const sy = getTerrainHeight(sx, sz) + 1.5;
  const id = `star-${i}`;
  const h = new THREE.Group();
  h.position.set(sx, sy, sz);
  world.add(h);

  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), starMat);
  gem.castShadow = true; h.add(gem);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 8, 24), starGlowMat);
  ring.rotation.x = Math.PI / 2; h.add(ring);

  const groundGlow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), starGlowMat);
  groundGlow.position.y = -0.4; groundGlow.rotation.x = -Math.PI / 2; h.add(groundGlow);

  h.userData = { type: 'star', id, label: 'A little star' };
  interactables.push(h);
  starObjects.push({ holder: h, gem, baseY: sy, phase: i * 0.85 });
  if (state.stars.has(id)) h.visible = false;
});

/* ========================================================================
   HIDDEN NOTE LANTERNS
   ======================================================================== */
const bronzeMat = new THREE.MeshStandardMaterial({ color: '#684d30', roughness: 0.7, metalness: 0.3 });
function noteLantern(x, z, idx) {
  const y = getTerrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  world.add(g);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8), bronzeMat);
  pole.position.y = 0.7; pole.castShadow = true; g.add(pole);

  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.8, 8), bronzeMat);
  lantern.position.y = 1.65; g.add(lantern);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), starMat);
  orb.position.y = 1.65; g.add(orb);

  const floatingStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), starMat);
  floatingStar.position.y = 2.6; g.add(floatingStar);
  animated.push({ mesh: floatingStar, kind: 'float', phase: idx * 2.1 });

  g.userData = { type: 'note', id: `note-${idx}`, noteIndex: idx, label: 'A hidden note' };
  interactables.push(g);
}
noteLantern(-22, -12, 0);
noteLantern(21, -11, 1);
noteLantern(-1, 31, 2);

/* ========================================================================
   INTERACTIVE PROPS & ANCHORS
   ======================================================================== */
// Café Treat Picnic
const snackAnchor = new THREE.Group();
snackAnchor.position.set(-29, getTerrainHeight(-29, -15), -15);
snackAnchor.userData = { type: 'snack', label: 'A little treat' };
interactables.push(snackAnchor); world.add(snackAnchor);

// Garden Yarn Ball
const yarnG = new THREE.Group();
yarnG.position.set(23, getTerrainHeight(23, -11), -11);
world.add(yarnG);
const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.5, 12), bronzeMat);
basket.position.y = 0.35; yarnG.add(basket);
const yarnMats = ['#f05d7b', '#b368db', '#f5b026', '#4fa9d8'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
yarnMats.forEach((m, i) => {
  const yBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), m);
  yBall.position.set(-0.35 + i * 0.24, 0.8, 0);
  yarnG.add(yBall);
});
yarnG.userData = { type: 'yarn', label: 'Play with the yarn' };
interactables.push(yarnG);

// Castle Finale Anchor (Sanctuary Heart)
const finaleAnchor = new THREE.Group();
finaleAnchor.position.set(0, getTerrainHeight(0, 39.5) + 0.8, 39.5);
finaleAnchor.userData = { type: 'finale', label: 'Open the castle surprise' };
interactables.push(finaleAnchor); world.add(finaleAnchor);

/* ========================================================================
   PLAYER ADVENTURER (Loaded from Blender GLB)
   ======================================================================== */
const playerG = new THREE.Group();
scene.add(playerG);
const avatar = new THREE.Group();
playerG.add(avatar);

// Load custom Ghibli Player model
loadGLB('/models/player.glb', [0, 0, 0], 1.0, 0, (m) => {
  avatar.add(m);
});

/* ========================================================================
   COMPANION CAT (Loaded from Blender GLB)
   ======================================================================== */
const catG = new THREE.Group();
scene.add(catG);
catG.position.set(-24, getTerrainHeight(-24, -13), -13);
catG.userData = { type: 'cat', label: 'Say hello to the cat' };
interactables.push(catG);

loadGLB('/models/cat.glb', [0, 0, 0], 1.0, 0, (m) => {
  catG.add(m);
});

const catS = {
  mode: 'idle', timer: 0, step: 0,
  base: new THREE.Vector3(-24, 0, -13), target: new THREE.Vector3(-24, 0, -13),
  follow: state.catBond >= 3
};

/* ========================================================================
   🌸 CHERRY BLOSSOM PETALS PARTICLE SYSTEM
   ======================================================================== */
const PETAL_COUNT = 80;
const petalGeo = new THREE.PlaneGeometry(0.18, 0.13);
const petalMats = [
  new THREE.MeshBasicMaterial({ color: '#ffb5ca', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  new THREE.MeshBasicMaterial({ color: '#ffcad9', side: THREE.DoubleSide, transparent: true, opacity: 0.82 }),
  new THREE.MeshBasicMaterial({ color: '#fca3bb', side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
];
for (let i = 0; i < PETAL_COUNT; i++) {
  const pMesh = new THREE.Mesh(petalGeo, petalMats[i % petalMats.length]);
  pMesh.position.set((Math.random() - 0.5) * 95, 14 + Math.random() * 12, (Math.random() - 0.5) * 95);
  scene.add(pMesh);
  cherryPetals.push({
    mesh: pMesh,
    vx: (Math.random() - 0.5) * 0.4,
    vy: -0.35 - Math.random() * 0.35,
    vz: (Math.random() - 0.5) * 0.4,
    rSpd: (Math.random() - 0.5) * 3.5,
    phase: Math.random() * Math.PI * 2
  });
}

/* ========================================================================
   ✨ AMBIENT GOLDEN FIREFLIES
   ======================================================================== */
const FIREFLY_COUNT = 36;
const ffMat = new THREE.MeshBasicMaterial({ color: '#ffea75', transparent: true, opacity: 0.9 });
for (let i = 0; i < FIREFLY_COUNT; i++) {
  const fx = (Math.random() - 0.5) * 75, fz = (Math.random() - 0.5) * 75;
  const fy = getTerrainHeight(fx, fz) + 1.2 + Math.random() * 2.8;
  const fm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), ffMat);
  fm.position.set(fx, fy, fz);
  scene.add(fm);
  fireflies.push({ mesh: fm, base: new THREE.Vector3(fx, fy, fz), phase: Math.random() * Math.PI * 2, speed: 0.25 + Math.random() * 0.45 });
}

/* ========================================================================
   COLLISIONS & BOUNDARIES
   ======================================================================== */
const solids = [
  { x: -31, z: -20, r: 5.2 }, // Café
  { x: 29, z: -18, r: 5.4 },  // Garden
  { x: 0, z: 50, r: 12.0 },   // Castle keep
  { x: -9, z: 42, r: 3.2 },   // Left turret
  { x: 9, z: 42, r: 3.2 },    // Right turret
  { x: 20, z: -25, r: 2.2 },  // Tree trunks
  { x: 38, z: -15, r: 2.2 },
  { x: -14, z: 12, r: 2.2 },
  { x: 15, z: 10, r: 2.2 }
];

function resolveCollisions(pos, vel) {
  for (const s of solids) {
    const dx = pos.x - s.x, dz = pos.z - s.z, d = Math.hypot(dx, dz);
    if (d < s.r) {
      const o = s.r - d, nx = dx / (d || 1), nz = dz / (d || 1);
      pos.x += nx * o; pos.z += nz * o;
      const vn = vel.x * nx + vel.z * nz;
      if (vn < 0) { vel.x -= vn * nx; vel.z -= vn * nz; }
    }
  }
  const maxR = 54, cr = Math.hypot(pos.x, pos.z);
  if (cr > maxR) {
    const nx = pos.x / cr, nz = pos.z / cr;
    pos.x = nx * maxR; pos.z = nz * maxR;
    const vn = vel.x * nx + vel.z * nz;
    if (vn > 0) { vel.x -= vn * nx; vel.z -= vn * nz; }
  }
}

/* ========================================================================
   CAMERA, REGIONS & HUD
   ======================================================================== */
const regions = [
  { name: 'Mosslight Meadow', note: 'THE WORLD IS YOURS TO WANDER', x: 0, z: 0, r: 22 },
  { name: 'The Little Cup Café', note: 'WARM TEA · WARMER COMPANY', x: -31, z: -20, r: 22 },
  { name: 'Wishing Garden', note: 'A QUIET PLACE FOR BRIGHT THOUGHTS', x: 29, z: -18, r: 22 },
  { name: 'The Starlit Castle', note: 'SOME SECRETS WAIT AT THE TOP', x: 0, z: 46, r: 26 }
];

let cameraYaw = -0.15, cameraPitch = 0.40, cameraDist = 13.5;
let drag = null, ptrDown = null;
const moveKeys = new Set(), joyVec = new THREE.Vector2();

function updateCamera(dt) {
  const ty = state.pos.y + 1.4;
  const look = new THREE.Vector3(state.pos.x, ty, state.pos.z);
  const cp = Math.cos(cameraPitch), sp = Math.sin(cameraPitch);
  const off = new THREE.Vector3(Math.sin(cameraYaw) * cp * cameraDist, sp * cameraDist, Math.cos(cameraYaw) * cp * cameraDist);
  camera.position.lerp(look.clone().add(off), 1 - Math.exp(-dt * 8.0));
  camera.lookAt(look);
}

function persist() {
  try {
    localStorage.setItem(saveKey, JSON.stringify({
      stars: [...state.stars], notes: [...state.notes],
      catBond: state.catBond, finale: state.finale,
      x: state.pos.x, z: state.pos.z
    }));
  } catch {}
}

function showToast(m) {
  ui.toast.textContent = m;
  ui.toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2400);
}

function openModal({ eyebrow = 'A NOTE FOR YOU', title, body, button = 'Keep wandering' }) {
  ui.modalEyebrow.textContent = eyebrow;
  ui.modalTitle.textContent = title;
  ui.modalBody.textContent = body;
  ui.modalContinue.innerHTML = `${button} <span>→</span>`;
  ui.modal.hidden = false;
  state.modalOpen = true;
}

function closeModal() {
  ui.modal.hidden = true;
  state.modalOpen = false;
}
ui.closeModal.addEventListener('click', closeModal);
ui.modalContinue.addEventListener('click', closeModal);
ui.modal.addEventListener('click', e => { if (e.target === ui.modal) closeModal(); });

function refreshQuest() {
  ui.stars.textContent = state.stars.size;
  if (state.finale) {
    ui.questKicker.textContent = 'A MOMENT TO KEEP';
    ui.quest.textContent = 'Your little universe is complete';
    ui.questIcon.textContent = '♡';
    return;
  }
  if (state.stars.size < 12) {
    ui.questKicker.textContent = 'A LITTLE ADVENTURE';
    ui.quest.textContent = `Find the golden glimmers · ${state.stars.size}/12`;
    ui.questIcon.textContent = '✦';
  } else if (state.catBond < 3) {
    ui.questKicker.textContent = 'ONE MORE THING';
    ui.quest.textContent = `Make a friend · ${state.catBond}/3`;
    ui.questIcon.textContent = '♡';
  } else {
    ui.questKicker.textContent = 'THE LAST LITTLE SECRET';
    ui.quest.textContent = 'Visit the castle heart';
    ui.questIcon.textContent = '⌂';
  }
}
refreshQuest();

/* ========================================================================
   AUDIO SYSTEM (Synthesized Chimes & Music)
   ======================================================================== */
let audioCtx = null, masterGain = null, musicGain = null, musicTimer = null;
let volume = Number(localStorage.getItem('joos-volume') || 70) / 100;
let muted = localStorage.getItem('joos-muted') === 'true';

ui.volume.value = String(Math.round(volume * 100));
ui.volumeValue.textContent = `${Math.round(volume * 100)}%`;
ui.sound.textContent = muted ? '◌' : '♫';

function startAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    musicGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : volume;
    musicGain.gain.value = 0.28;
    musicGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    const notes = [261.63, 329.63, 392, 440, 523.25, 392, 329.63, 293.66];
    let n = 0;
    musicTimer = setInterval(() => {
      if (!audioCtx || audioCtx.state !== 'running') return;
      const now = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = notes[n++ % notes.length];
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      osc.connect(gain); gain.connect(musicGain);
      osc.start(now); osc.stop(now + 1.85);
    }, 940);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function sfx(kind = 'sparkle') {
  if (!audioCtx) return;
  const now = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
  const cfg = {
    sparkle: [880, 0.26, 'sine'], pet: [560, 0.22, 'triangle'], feed: [430, 0.2, 'sine'],
    yarn: [720, 0.16, 'triangle'], note: [660, 0.48, 'sine'], finish: [523, 0.85, 'sine']
  };
  const [freq, dur, type] = cfg[kind] || cfg.sparkle;
  osc.type = type; osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + dur * 0.35);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + dur);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(kind === 'finish' ? 0.2 : 0.1, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain); gain.connect(masterGain);
  osc.start(now); osc.stop(now + dur + 0.02);
}

function setVol(v) {
  volume = v;
  localStorage.setItem('joos-volume', String(Math.round(v * 100)));
  ui.volumeValue.textContent = `${Math.round(v * 100)}%`;
  if (masterGain && audioCtx) masterGain.gain.setTargetAtTime(muted ? 0 : v, audioCtx.currentTime, 0.08);
}
ui.volume.addEventListener('input', () => setVol(Number(ui.volume.value) / 100));
ui.sound.addEventListener('click', () => { ui.soundPanel.hidden = !ui.soundPanel.hidden; });
ui.soundPanel.addEventListener('click', e => e.stopPropagation());

function toggleMute() {
  muted = !muted;
  localStorage.setItem('joos-muted', String(muted));
  ui.sound.textContent = muted ? '◌' : '♫';
  ui.mute.textContent = muted ? 'Turn sounds back on' : 'Mute all sounds';
  if (masterGain && audioCtx) masterGain.gain.setTargetAtTime(muted ? 0 : volume, audioCtx.currentTime, 0.08);
}
ui.mute.addEventListener('click', toggleMute);
ui.mute.textContent = muted ? 'Turn sounds back on' : 'Mute all sounds';
ui.help.addEventListener('click', () => openModal({
  eyebrow: 'HOW TO WANDER',
  title: 'Take your time.',
  body: 'Explore with WASD or arrow keys. On mobile, glide with the thumbstick. Drag to look around. Walk close to something glowing and press E or tap the heart. Find stars, make a friend, discover the castle secret.',
  button: "Let's go"
}));
ui.begin.addEventListener('click', () => {
  state.started = true;
  ui.welcome.classList.add('leaving');
  startAudio();
  showToast('Welcome to your little universe ✦');
});

/* ========================================================================
   INTERACTIONS
   ======================================================================== */
function nearest() {
  let best = null, bd = Infinity;
  for (const o of interactables) {
    if (!o.visible) continue;
    const p = new THREE.Vector3();
    o.getWorldPosition(p);
    const d = Math.hypot(state.pos.x - p.x, state.pos.z - p.z);
    if (d < 3.8 && d < bd) { best = o; bd = d; }
  }
  return best;
}

function interact(obj = state.active) {
  if (!obj || state.modalOpen) return;
  const t = obj.userData.type;

  if (t === 'star') {
    if (state.stars.has(obj.userData.id)) return;
    state.stars.add(obj.userData.id);
    obj.visible = false;
    persist(); refreshQuest(); sfx('sparkle');
    showToast(['A little light for your pocket ✦', 'One more star gathered ✧', 'The sky feels closer ♡'][state.stars.size % 3]);
    return;
  }
  if (t === 'note') {
    const i = obj.userData.noteIndex, id = obj.userData.id;
    if (state.notes.has(id)) { showToast("You've already tucked this one away ♡"); return; }
    state.notes.add(id); persist(); sfx('note');
    const n = messages.notes[i % messages.notes.length];
    openModal({ title: n.title, body: n.body });
    return;
  }
  if (t === 'cat') {
    const b = state.catBond;
    if (b === 0) {
      state.catBond++; catS.mode = 'purr'; catS.timer = 2.8; sfx('pet');
      openModal({
        eyebrow: 'A NEW LITTLE FRIEND', title: 'Oh, hello there.',
        body: 'The tiny garden cat leans into your hand and gives the softest purr. Looks like you\'ve made a friend.',
        button: 'Say hello'
      });
    } else if (b === 1) {
      state.catBond++; catS.mode = 'snack'; catS.timer = 3; sfx('feed');
      openModal({
        eyebrow: 'A VERY GOOD TREAT', title: 'The way to a heart…',
        body: 'A little treat, a little trust, and a very happy tail. Your new friend decides you\'re worth following.',
        button: "That's sweet"
      });
    } else {
      state.catBond++; catS.mode = 'play'; catS.timer = 3.4;
      catS.target.copy(catG.position); catS.follow = true; sfx('yarn');
      openModal({
        eyebrow: 'BEST FRIENDS', title: 'Your shadow, with whiskers.',
        body: 'A tumble through the yarn, a happy little chirp, and now you have a companion for the rest of your adventure.',
        button: "Let's go together"
      });
    }
    persist(); refreshQuest(); return;
  }
  if (t === 'snack') {
    if (catS.mode === 'snack') { showToast('Your friend already found the treats!'); return; }
    catS.mode = 'snack'; catS.timer = 3.2; catS.target.set(-29, 0, -15);
    sfx('feed'); showToast('A tiny picnic for two ♡'); return;
  }
  if (t === 'yarn') {
    catS.mode = 'play'; catS.timer = 3.6; catS.target.set(23, 0, -11);
    sfx('yarn'); showToast('A very serious game of yarn ✦'); return;
  }
  if (t === 'finale') {
    if (state.stars.size < 12) { showToast(`The castle heart waits for ${12 - state.stars.size} more stars ✦`); return; }
    if (state.catBond < 3) { showToast('Your little companion should come along ♡'); return; }
    if (state.finale) {
      openModal({
        eyebrow: 'YOUR FOREVER PLACE', title: messages.finale.title,
        body: `${messages.finale.body}\n\n${messages.finale.signOff}`, button: 'Keep this close'
      });
      return;
    }
    state.finale = true; persist(); refreshQuest(); sfx('finish');
    openModal({
      eyebrow: 'A LITTLE ROMANTIC SURPRISE', title: messages.finale.title,
      body: `${messages.finale.body}\n\n${messages.finale.signOff}`, button: 'Keep this close'
    });
    for (let i = 0; i < 50; i++) spawnSparkle();
    return;
  }
}

function spawnSparkle() {
  const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), starMat);
  m.position.set(state.pos.x + Math.cos(a) * r, state.pos.y + 1 + Math.random() * 4, state.pos.z + Math.sin(a) * r);
  scene.add(m);
  animated.push({ mesh: m, kind: 'burst', life: 3.2 });
}

function updateUI() {
  const f = nearest(); state.active = f;
  if (!f) { ui.interact.hidden = true; return; }
  let l = f.userData.label;
  if (f.userData.type === 'cat') l = state.catBond === 0 ? 'Pet the cat' : state.catBond === 1 ? 'Offer a little treat' : 'Play a little yarn';
  if (f.userData.type === 'finale') l = state.stars.size < 12 ? `Castle heart · ${state.stars.size}/12 stars` : state.catBond < 3 ? 'Bring your friend along' : 'Open the surprise';
  ui.interactLabel.textContent = l;
  ui.interactIcon.textContent = f.userData.type === 'star' ? '✦' : f.userData.type === 'finale' ? '♡' : '✧';
  ui.interact.hidden = false;
}

ui.interactButton.addEventListener('click', () => interact());
ui.touchAction.addEventListener('click', () => interact());

/* ========================================================================
   CONTROLS: KEYBOARD, JOYSTICK, TOUCH & ORBIT
   ======================================================================== */
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  moveKeys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'e' || e.key === 'Enter') interact();
  if (e.key === 'Escape') { closeModal(); ui.soundPanel.hidden = true; }
});
window.addEventListener('keyup', e => moveKeys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => moveKeys.clear());

let joyPtr = null;
ui.joystick.addEventListener('pointerdown', e => {
  joyPtr = e.pointerId; ui.joystick.setPointerCapture(e.pointerId); moveJoy(e);
});
ui.joystick.addEventListener('pointermove', e => {
  if (e.pointerId === joyPtr) moveJoy(e);
});
function moveJoy(e) {
  const r = ui.joystick.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width * 0.5), dy = e.clientY - (r.top + r.height * 0.5);
  const mx = 36, rd = Math.hypot(dx, dy), cd = Math.min(rd, mx), a = Math.atan2(dy, dx);
  ui.joyKnob.style.left = `calc(50% + ${Math.cos(a) * cd}px)`;
  ui.joyKnob.style.top = `calc(50% + ${Math.sin(a) * cd}px)`;
  const n = rd / mx, dz = 0.15;
  if (n < dz) joyVec.set(0, 0);
  else { const s = Math.min(1, (n - dz) / (1 - dz)); joyVec.set(Math.cos(a) * s, -Math.sin(a) * s); }
}
function clearJoy() {
  joyPtr = null; joyVec.set(0, 0);
  ui.joyKnob.style.left = '50%'; ui.joyKnob.style.top = '50%';
}
ui.joystick.addEventListener('pointerup', clearJoy);
ui.joystick.addEventListener('pointercancel', clearJoy);

const ray = new THREE.Raycaster(), pNdc = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.target.closest('button') || e.target.closest('.touch-controls')) return;
  ptrDown = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() };
  drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId) return;
  cameraYaw -= (e.clientX - drag.x) * 0.0055;
  cameraPitch = Math.max(0.12, Math.min(0.85, cameraPitch + (e.clientY - drag.y) * 0.004));
  drag.x = e.clientX; drag.y = e.clientY;
});
renderer.domElement.addEventListener('pointerup', e => {
  if (!ptrDown || ptrDown.id !== e.pointerId) return;
  const mv = Math.hypot(e.clientX - ptrDown.x, e.clientY - ptrDown.y), el = performance.now() - ptrDown.t;
  if (mv < 8 && el < 400) {
    pNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(pNdc, camera);
    const hits = ray.intersectObjects(interactables.filter(o => o.visible), true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !interactables.includes(o)) o = o.parent;
      if (o) {
        const p = new THREE.Vector3(); o.getWorldPosition(p);
        if (Math.hypot(state.pos.x - p.x, state.pos.z - p.z) < 7.5) interact(o);
        else showToast('Wander a little closer first ✧');
      }
    }
  }
  drag = null; ptrDown = null;
});
renderer.domElement.addEventListener('wheel', e => {
  cameraDist = Math.max(7, Math.min(26, cameraDist + Math.sign(e.deltaY) * 1.2));
}, { passive: true });

/* ========================================================================
   PLAYER LOCOMOTION (Camera-Relative, Smooth Glide)
   ======================================================================== */
let walkCycle = 0;
function updatePlayer(dt, t) {
  let ix = 0, iz = 0;
  if (moveKeys.has('w') || moveKeys.has('arrowup')) iz += 1;
  if (moveKeys.has('s') || moveKeys.has('arrowdown')) iz -= 1;
  if (moveKeys.has('a') || moveKeys.has('arrowleft')) ix -= 1;
  if (moveKeys.has('d') || moveKeys.has('arrowright')) ix += 1;
  ix += joyVec.x; iz += joyVec.y;

  const il = Math.hypot(ix, iz);
  let tSpd = 0; const tDir = new THREE.Vector3();
  if (il > 0.05) {
    const nl = Math.min(1, il), nx = ix / il, nz = iz / il;
    const fwd = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const rt = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    tDir.copy(fwd.multiplyScalar(nz).add(rt.multiplyScalar(nx))).normalize();
    tSpd = nl * 7.5;
  }
  const tVel = tDir.clone().multiplyScalar(tSpd);
  state.vel.lerp(tVel, 1 - Math.exp(-dt * (tSpd > 0.1 ? 14 : 11)));
  state.pos.x += state.vel.x * dt;
  state.pos.z += state.vel.z * dt;
  resolveCollisions(state.pos, state.vel);
  state.pos.y = getTerrainHeight(state.pos.x, state.pos.z);

  const spd = Math.hypot(state.vel.x, state.vel.z);
  if (spd > 0.15) {
    let diff = Math.atan2(state.vel.x, state.vel.z) - state.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.heading += diff * (1 - Math.exp(-dt * 15));
  }
  playerG.position.set(state.pos.x, state.pos.y, state.pos.z);
  avatar.rotation.y = state.heading;

  // Gentle walking bob
  const mv = spd > 0.15;
  if (mv) walkCycle += spd * dt * 1.5;
  avatar.position.y = mv ? Math.abs(Math.sin(walkCycle * 4.5)) * 0.08 : Math.sin(t * 2.2) * 0.024;

  const reg = regions.find(r => Math.hypot(state.pos.x - r.x, state.pos.z - r.z) < r.r) || regions[0];
  if (ui.region.textContent !== reg.name) {
    ui.region.textContent = reg.name; ui.regionNote.textContent = reg.note;
  }
}

/* ========================================================================
   COMPANION CAT AI
   ======================================================================== */
function updateCat(dt, t) {
  catS.timer = Math.max(0, catS.timer - dt);
  if (catS.mode === 'idle' && catS.timer === 0) {
    catS.timer = 3.5 + Math.random() * 4.5;
    catS.target.set(catS.base.x + (Math.random() - 0.5) * 5, 0, catS.base.z + (Math.random() - 0.5) * 5);
    catS.mode = 'wander';
  }
  const isF = catS.follow && catS.mode !== 'purr' && catS.mode !== 'play';
  if (isF || catS.mode === 'follow') {
    const dp = Math.hypot(catG.position.x - state.pos.x, catG.position.z - state.pos.z);
    if (dp > 3.6) {
      catS.target.set(state.pos.x, state.pos.y, state.pos.z); catS.mode = 'follow';
    } else if (catS.mode === 'follow' && dp < 2.5) {
      catS.mode = 'idle'; catS.timer = 1.8;
    }
  }
  if (['wander', 'follow', 'play'].includes(catS.mode)) {
    const d = new THREE.Vector3(catS.target.x - catG.position.x, 0, catS.target.z - catG.position.z);
    const dl = d.length();
    if (dl > 0.45) {
      d.normalize();
      catG.position.addScaledVector(d, dt * (catS.mode === 'follow' ? 3.0 : 1.35));
      catG.rotation.y = Math.atan2(d.x, d.z);
    } else if (catS.mode === 'wander') {
      catS.mode = 'idle'; catS.timer = 2;
    }
  } else if (catS.timer === 0) {
    catS.mode = catS.follow ? 'follow' : 'idle'; catS.timer = catS.follow ? 0 : 2;
  }
  catG.position.y = getTerrainHeight(catG.position.x, catG.position.z);
  if (catS.mode === 'play') {
    catG.position.x += Math.sin(t * 8) * dt * 0.7;
    catG.position.z += Math.cos(t * 8) * dt * 0.7;
    catG.rotation.y = t * 2.2;
  }
}

/* ========================================================================
   AMBIENT ANIMATION LOOP (Stars, Petals, Fireflies, Grass)
   ======================================================================== */
function updateAmbient(dt, t) {
  // Stars rotation & hover
  for (const s of starObjects) {
    if (s.holder.visible) {
      s.holder.position.y = s.baseY + Math.sin(t * 2.2 + s.phase) * 0.24;
      s.gem.rotation.y += dt * 1.2;
      s.gem.rotation.z = Math.sin(t * 1.8 + s.phase) * 0.14;
      if (Math.hypot(state.pos.x - s.holder.position.x, state.pos.z - s.holder.position.z) < 1.7) {
        interact(s.holder);
      }
    }
  }

  // Swaying grass tufts in the breeze
  for (const gt of grassTufts) {
    gt.group.rotation.z = Math.sin(t * 2.4 + gt.phase) * 0.09;
    gt.group.rotation.x = Math.cos(t * 2.0 + gt.phase) * 0.05;
  }

  // Animated scene items (heart, lanterns)
  for (let i = animated.length - 1; i >= 0; i--) {
    const a = animated[i];
    if (a.kind === 'float') {
      a.mesh.position.y += Math.sin(t * 2.2 + a.phase) * 0.0035;
    } else if (a.kind === 'burst') {
      a.life -= dt; a.mesh.position.y += dt * 1.6;
      if (a.mesh.material.opacity !== undefined) a.mesh.material.opacity = Math.max(0, a.life / 3.2);
      if (a.life <= 0) { scene.remove(a.mesh); animated.splice(i, 1); }
    }
  }

  // 🌸 Cherry blossom petals
  for (const p of cherryPetals) {
    p.mesh.position.x += p.vx * dt + Math.sin(t * 1.5 + p.phase) * dt * 0.35;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt + Math.cos(t * 1.2 + p.phase) * dt * 0.25;
    p.mesh.rotation.x += p.rSpd * dt;
    p.mesh.rotation.z += p.rSpd * 0.7 * dt;
    if (p.mesh.position.y < -2) {
      p.mesh.position.set((Math.random() - 0.5) * 95, 16 + Math.random() * 10, (Math.random() - 0.5) * 95);
    }
  }

  // ✨ Fireflies
  for (const f of fireflies) {
    f.mesh.position.x = f.base.x + Math.sin(t * f.speed + f.phase) * 2.5;
    f.mesh.position.y = f.base.y + Math.sin(t * f.speed * 1.3 + f.phase) * 0.9;
    f.mesh.position.z = f.base.z + Math.cos(t * f.speed * 0.8 + f.phase) * 2.5;
    f.mesh.material.opacity = 0.35 + Math.sin(t * 3.5 + f.phase) * 0.45;
  }

  // Ocean gentle swell
  seaMesh.position.y = -1.2 + Math.sin(t * 0.6) * 0.08;
}

/* ========================================================================
   MAIN RENDER LOOP
   ======================================================================== */
let last = performance.now(), elapsed = 0, saveTick = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.045, (now - last) / 1000);
  last = now; elapsed += dt;

  updatePlayer(dt, elapsed);
  updateCat(dt, elapsed);
  updateAmbient(dt, elapsed);
  updateCamera(dt);
  updateUI();

  saveTick += dt;
  if (saveTick > 5) { saveTick = 0; persist(); }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

setTimeout(() => ui.loading.classList.add('done'), 500);
if (innerWidth <= 700) document.body.classList.add('mobile');
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  document.body.classList.toggle('mobile', innerWidth <= 700);
});
