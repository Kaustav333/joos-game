import * as THREE from 'three';
import { messages } from './messages.js';
import './style.css';
import './mute.css';

// ---------------------------------------------------------------------------
// UI & State Initialization
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
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
const saved = (() => {
  try { return JSON.parse(localStorage.getItem(saveKey) || '{}'); } catch { return {}; }
})();

const state = {
  started: false,
  stars: new Set(saved.stars || []),
  notes: new Set(saved.notes || []),
  catBond: Math.max(0, Number(saved.catBond) || 0),
  finale: Boolean(saved.finale),
  playerPos: new THREE.Vector3(saved.x || 0, 0, saved.z || 2),
  playerVel: new THREE.Vector3(),
  heading: Math.PI,
  active: null,
  toastTimer: 0,
  modalOpen: false
};

// ---------------------------------------------------------------------------
// Three.js Scene, Camera, Renderer, & Lighting
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b3e2ea');
scene.fog = new THREE.FogExp2('#cae8e1', 0.0075);

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 260);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
ui.game.appendChild(renderer.domElement);

// Warm storybook sunlight & skylight
const hemiLight = new THREE.HemisphereLight('#f1fdff', '#827855', 2.3);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight('#fff4d6', 3.2);
sun.position.set(-36, 64, 28);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 170;
sun.shadow.bias = -0.0003;
scene.add(sun);

const ambientFill = new THREE.DirectionalLight('#c5eaff', 0.8);
ambientFill.position.set(30, 25, -30);
scene.add(ambientFill);

// ---------------------------------------------------------------------------
// Material Palette (Cozy Stylized Film Finish)
// ---------------------------------------------------------------------------
const mat = (color, roughness = 0.88, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra });

const mats = {
  grass: mat('#88bd6b', 0.95),
  grassMeadow: mat('#a2cb72', 0.94),
  grassDark: mat('#6e9c56', 0.96),
  cliff: mat('#bca382', 0.98),
  cliffFoot: mat('#a88e6e', 0.98),
  path: mat('#edd5a6', 0.92),
  stonePave: mat('#d7ceb8', 0.9),
  water: mat('#72c8d2', 0.25, { transparent: true, opacity: 0.85 }),
  waterFoam: mat('#d7f7f4', 0.4, { transparent: true, opacity: 0.7 }),

  // Architecture & props
  woodDark: mat('#734d35', 0.86),
  woodPlank: mat('#8f6448', 0.88),
  woodWarm: mat('#aa7954', 0.85),
  plasterCream: mat('#fbf1df', 0.92),
  plasterMint: mat('#d2e5c8', 0.92),
  plasterRose: mat('#f7dccf', 0.92),
  stoneMasonry: mat('#e0d5be', 0.88),
  stoneTrim: mat('#c8bc9f', 0.85),
  roofTerracotta: mat('#d67156', 0.84),
  roofSage: mat('#6d9489', 0.84),
  roofGold: mat('#e5af54', 0.82),
  roofRoyal: mat('#5c7798', 0.84),
  awningCoral: mat('#e26d57', 0.85),
  awningCream: mat('#fff5dc', 0.85),
  glassAmber: mat('#ffe8a3', 0.25, { emissive: '#ffb845', emissiveIntensity: 0.35 }),
  glassAqua: mat('#94d7d9', 0.22, { emissive: '#3c7980', emissiveIntensity: 0.15 }),
  metalBronze: mat('#9c8052', 0.45, { metalness: 0.4 }),
  goldGleam: mat('#f3c65a', 0.32, { metalness: 0.35 }),

  // Nature & Foliage
  trunk: mat('#7f583e', 0.9),
  leafGreenA: mat('#70a961', 0.9),
  leafGreenB: mat('#8ec273', 0.9),
  leafGreenC: mat('#588e4f', 0.92),
  leafSakuraA: mat('#f7b9c9', 0.88),
  leafSakuraB: mat('#ffd4e0', 0.88),
  leafAutumn: mat('#e89753', 0.88),
  flowerRose: mat('#f2828b', 0.85),
  flowerYellow: mat('#fad466', 0.85),
  flowerViolet: mat('#bb9cd4', 0.85),
  flowerBlue: mat('#7bbde6', 0.85),
  flowerWhite: mat('#ffffff', 0.9),

  // Character & Cat
  charSkin: mat('#fad0b1', 0.9),
  charHair: mat('#40342b', 0.9),
  charCoat: mat('#d26750', 0.86),
  charScarf: mat('#f3dd97', 0.88),
  charPants: mat('#506e6a', 0.88),
  charBoots: mat('#60412e', 0.88),
  catCoat: mat('#e9af66', 0.9),
  catWhite: mat('#fdf7ea', 0.9),
  catPink: mat('#f4a8a5', 0.88),
  dark: mat('#383b37', 0.9),

  // Magic & Collectibles
  star: new THREE.MeshStandardMaterial({
    color: '#ffea94',
    emissive: '#f8be40',
    emissiveIntensity: 1.8,
    roughness: 0.28
  }),
  starGlow: new THREE.MeshBasicMaterial({
    color: '#ffe58e',
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide
  }),
  heartMagic: mat('#f2697e', 0.35, { emissive: '#e82f5b', emissiveIntensity: 1.2 })
};

const world = new THREE.Group();
scene.add(world);

const interactables = [];
const starObjects = [];
const animated = [];
const petals = [];
const butterflies = [];
const chimneys = [];

// ---------------------------------------------------------------------------
// Geometry Helper Functions
// ---------------------------------------------------------------------------
function addMesh(geometry, material, parent = world, pos = [0, 0, 0], cast = true, receive = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...pos);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function box(w, h, d, m, parent = world, pos = [0, 0, 0], cast = true) {
  return addMesh(new THREE.BoxGeometry(w, h, d), m, parent, pos, cast);
}

function cylinder(rt, rb, h, m, parent = world, pos = [0, 0, 0], seg = 14, cast = true) {
  return addMesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, parent, pos, cast);
}

function sphere(r, m, parent = world, pos = [0, 0, 0], scale = [1, 1, 1], detail = 1, cast = true) {
  const mesh = addMesh(new THREE.IcosahedronGeometry(r, detail), m, parent, pos, cast);
  mesh.scale.set(...scale);
  return mesh;
}

// ---------------------------------------------------------------------------
// Sculpted Storybook Terrain Elevation Function
// ---------------------------------------------------------------------------
export function getTerrainHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r > 64) return -12;

  // Gentle edge downward bevel
  const edgeT = Math.max(0, Math.min(1, (r - 42) / 18));
  const edgeDrop = edgeT * edgeT * 3.4;

  // Starlit Castle Northern Plateau: elevated to ~3.5 above sea level
  const castleDist = Math.hypot(x - 2, z - 44);
  const castlePlateau = Math.max(0, 1 - castleDist / 19) * 3.4;

  // Castle entrance terrace & stairway slope
  const stairsDist = Math.hypot(x - 2, z - 28);
  const stairsRise = Math.max(0, 1 - stairsDist / 11) * 1.5;

  // Café nook in the South-West: gentle sheltering knoll
  const cafeDist = Math.hypot(x + 31, z + 21);
  const cafeKnoll = Math.max(0, 1 - cafeDist / 16) * 1.1;

  // Wishing Garden in the South-East: gentle terrace with a natural pond hollow
  const gardenDist = Math.hypot(x - 29, z + 18);
  const gardenTerrace = Math.max(0, 1 - gardenDist / 18) * 0.9;
  const pondDist = Math.hypot(x - 28, z + 18);
  const pondBasin = Math.max(0, 1 - pondDist / 6.2) * -0.65;

  // Rolling storybook meadow knolls across the island
  const rolling =
    Math.sin(x * 0.11 + Math.cos(z * 0.08) * 1.3) * 0.42 +
    Math.cos(z * 0.12 + Math.sin(x * 0.07)) * 0.36 +
    Math.sin((x - z) * 0.06) * 0.22;

  return 0.5 + rolling + castlePlateau + stairsRise + cafeKnoll + gardenTerrace + pondBasin - edgeDrop;
}

// Build Island Surface with Vertex Coloring & Stratified Cliffs
const terrainGeo = new THREE.PlaneGeometry(160, 160, 120, 120);
terrainGeo.rotateX(-Math.PI / 2);
const posAttr = terrainGeo.attributes.position;
const colorAttr = new THREE.BufferAttribute(new Float32Array(posAttr.count * 3), 3);

const colGrass = new THREE.Color('#88bd6b');
const colMeadow = new THREE.Color('#a5ce76');
const colPath = new THREE.Color('#ebd6a9');
const colCastleStone = new THREE.Color('#dfd7c2');
const colCliff = new THREE.Color('#b39a79');

// Helper to determine if point is near main paths
function getPathWeight(x, z) {
  // Path from center (0,2) to Café (-31,-20)
  const dCafe = distToSegment(x, z, 0, 2, -15, -9) + distToSegment(x, z, -15, -9, -31, -20);
  // Path from center (0,2) to Garden (29,-18)
  const dGarden = distToSegment(x, z, 0, 2, 14, -7) + distToSegment(x, z, 14, -7, 29, -18);
  // Path from center (0,2) to Castle (2,43)
  const dCastle = distToSegment(x, z, 0, 2, 2, 20) + distToSegment(x, z, 2, 20, 2, 40);
  // Inter-region connecting promenade
  const dConnect = distToSegment(x, z, -20, -14, 0, -22) + distToSegment(x, z, 0, -22, 20, -13);

  const minD = Math.min(dCafe, dGarden, dCastle, dConnect);
  return Math.max(0, 1 - minD / 2.6);
}

function distToSegment(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const l2 = dx * dx + dz * dz;
  if (l2 === 0) return Math.hypot(px - x1, pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / l2));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i);
  const z = posAttr.getZ(i);
  const r = Math.hypot(x, z);
  const h = getTerrainHeight(x, z);
  posAttr.setY(i, h);

  const pathW = getPathWeight(x, z);
  const isCastleCourtyard = Math.hypot(x - 2, z - 44) < 12 && h > 2.8;

  let vertexCol = colGrass.clone().lerp(colMeadow, Math.sin(x * 0.2) * 0.5 + 0.5);
  if (pathW > 0.1) {
    vertexCol.lerp(colPath, Math.min(1, pathW * 1.3));
  }
  if (isCastleCourtyard) {
    vertexCol.lerp(colCastleStone, 0.85);
  }
  if (r > 48) {
    vertexCol.lerp(colCliff, Math.min(1, (r - 48) / 10));
  }

  colorAttr.setXYZ(i, vertexCol.r, vertexCol.g, vertexCol.b);
}

terrainGeo.setAttribute('color', colorAttr);
terrainGeo.computeVertexNormals();

const islandMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.94,
  flatShading: false
});
const terrainMesh = addMesh(terrainGeo, islandMat, world, [0, 0, 0], false, true);

// Stratified island under-cliffs
const shoreSkirt = addMesh(new THREE.CylinderGeometry(62, 55, 4.8, 96, 2, true), mats.cliff, world, [0, -1.8, 0], false);
const lowerStrata = addMesh(new THREE.CylinderGeometry(55, 38, 7.5, 96, 2, true), mats.cliffFoot, world, [0, -6.5, 0], false);
const bottomPeak = addMesh(new THREE.ConeGeometry(38, 14, 48), mats.cliffFoot, world, [0, -17, 0], false);
bottomPeak.rotation.x = Math.PI;

// Surrounding sea plane with gentle translucency
const sea = addMesh(new THREE.CircleGeometry(110, 80), mats.water, world, [0, -1.1, 0], false);
sea.rotation.x = -Math.PI / 2;

// Soft cloud wisps in the distance
for (let i = 0; i < 24; i++) {
  const ang = i * 2.399;
  const dist = 85 + (i % 5) * 8;
  const cloud = new THREE.Group();
  cloud.position.set(Math.cos(ang) * dist, 18 + (i % 4) * 4, Math.sin(ang) * dist);
  scene.add(cloud);
  for (let j = 0; j < 5; j++) {
    sphere(2.5, mat('#ffffff', 0.95, { transparent: true, opacity: 0.38 }), cloud,
      [(j - 2) * 2.5, Math.sin(j * 0.9) * 0.6, (j % 2) * 1.2],
      [1.7, 0.45, 1.1], 1, false);
  }
}

// ---------------------------------------------------------------------------
// Winding Stylized Paths with Cobblestone Edges
// ---------------------------------------------------------------------------
function createSmoothPath(points, width = 2.2) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([px, pz]) => new THREE.Vector3(px, getTerrainHeight(px, pz) + 0.05, pz))
  );
  const steps = 140;
  const vertices = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize().multiplyScalar(width * 0.5);

    const leftH = getTerrainHeight(p.x + side.x, p.z + side.z) + 0.035;
    const rightH = getTerrainHeight(p.x - side.x, p.z - side.z) + 0.035;

    vertices.push(p.x + side.x, leftH, p.z + side.z);
    vertices.push(p.x - side.x, rightH, p.z - side.z);
    uvs.push(0, t * 8, 1, t * 8);

    if (i < steps) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const pathMesh = addMesh(geo, mats.path, world, [0, 0, 0], false, true);
  pathMesh.material.side = THREE.DoubleSide;

  // Add occasional round cobblestones along the edges
  for (let i = 2; i < steps; i += 7) {
    const t = i / steps;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const sign = (i % 2 === 0 ? 1 : -1);
    const edgeX = p.x + side.x * (width * 0.52 * sign);
    const edgeZ = p.z + side.z * (width * 0.52 * sign);
    const h = getTerrainHeight(edgeX, edgeZ) + 0.04;
    sphere(0.24, mats.stoneTrim, world, [edgeX, h, edgeZ], [1.2, 0.45, 1], 1, true);
  }
}

createSmoothPath([[0, 2], [-8, -6], [-19, -12], [-30, -19]], 2.6);
createSmoothPath([[0, 2], [10, -5], [21, -11], [29, -17]], 2.6);
createSmoothPath([[0, 2], [1, 14], [2, 26], [2, 38]], 2.8);
createSmoothPath([[-18, -12], [-8, -20], [8, -22], [19, -14]], 1.9);

// Wooden Trail Signposts
function makeSignpost(x, z, labelL = 'Café ←', labelR = 'Garden →') {
  const y = getTerrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  world.add(g);

  cylinder(0.09, 0.11, 2.1, mats.woodDark, g, [0, 1.05, 0], 8);
  sphere(0.14, mats.goldGleam, g, [0, 2.15, 0], [1, 1, 1], 1);

  // Left pointer board
  const boardL = box(1.2, 0.28, 0.06, mats.woodWarm, g, [-0.48, 1.75, 0]);
  boardL.rotation.y = 0.18;
  boardL.rotation.z = 0.04;

  // Right pointer board
  const boardR = box(1.3, 0.28, 0.06, mats.woodPlank, g, [0.52, 1.38, 0.04]);
  boardR.rotation.y = -0.22;
  boardR.rotation.z = -0.04;

  // Small flower tuft at base
  for (let i = 0; i < 4; i++) {
    const a = i * 1.5;
    sphere(0.08, mats.flowerYellow, g, [Math.cos(a) * 0.25, 0.1, Math.sin(a) * 0.25], [1, 1, 1], 1);
  }
}
makeSignpost(0, 3);
makeSignpost(-18, -11, 'Café ←', 'Plaza →');
makeSignpost(18, -10, 'Plaza ←', 'Garden →');

// ---------------------------------------------------------------------------
// Foliage, Flowering Plants & Trees
// ---------------------------------------------------------------------------
function createStylizedTree(x, z, scale = 1, kind = 'oak') {
  const y = getTerrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  world.add(g);

  if (kind === 'cherry') {
    // Elegant sweeping blossom tree
    cylinder(0.24, 0.42, 2.6, mats.woodDark, g, [0, 1.2, 0], 9);
    cylinder(0.16, 0.22, 1.4, mats.woodDark, g, [0.4, 2.1, 0.2], 7).rotation.z = -0.35;
    cylinder(0.15, 0.2, 1.3, mats.woodDark, g, [-0.35, 2.2, -0.2], 7).rotation.z = 0.4;

    sphere(1.5, mats.leafSakuraA, g, [0, 3.1, 0], [1.2, 0.95, 1.15], 2);
    sphere(1.1, mats.leafSakuraB, g, [-0.85, 3.3, 0.3], [1, 0.9, 0.95], 2);
    sphere(1.15, mats.leafSakuraB, g, [0.8, 3.25, -0.25], [1.05, 0.9, 1], 2);
    sphere(0.85, mats.leafSakuraA, g, [0, 4.0, 0.2], [0.95, 0.85, 0.9], 1);
  } else if (kind === 'pine') {
    // Fairytale layered conical pine
    cylinder(0.22, 0.34, 1.8, mats.trunk, g, [0, 0.9, 0], 8);
    for (let i = 0; i < 4; i++) {
      const coneR = 1.6 - i * 0.32;
      const coneH = 1.35;
      const coneY = 1.4 + i * 0.9;
      const cone = addMesh(new THREE.ConeGeometry(coneR, coneH, 7), mats.leafGreenC, g, [0, coneY, 0]);
      cone.rotation.y = i * 0.45;
    }
    sphere(0.12, mats.goldGleam, g, [0, 4.9, 0], [1, 1, 1], 1);
  } else {
    // Lush storybook oak with soft cloud canopies
    cylinder(0.28, 0.46, 2.4, mats.trunk, g, [0, 1.1, 0], 9);
    // Root tapers
    for (let r = 0; r < 3; r++) {
      const ra = r * 2.1;
      cylinder(0.12, 0.22, 0.6, mats.trunk, g, [Math.cos(ra) * 0.38, 0.2, Math.sin(ra) * 0.38], 6)
        .rotation.z = Math.cos(ra) * 0.3;
    }
    sphere(1.4, mats.leafGreenA, g, [0, 2.7, 0], [1.15, 1.05, 1.05], 2);
    sphere(1.05, mats.leafGreenB, g, [-0.75, 2.9, 0.2], [1, 0.95, 0.95], 2);
    sphere(1.0, mats.leafGreenB, g, [0.72, 3.0, -0.15], [0.95, 0.9, 0.95], 2);
    sphere(0.9, mats.leafGreenC, g, [0.1, 3.65, 0.1], [0.9, 0.85, 0.9], 1);
  }

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// Rich flowerbed with swaying blossoms
function flowerCluster(cx, cz, count = 28, radius = 5, palette = [mats.flowerRose, mats.flowerYellow, mats.flowerViolet]) {
  for (let i = 0; i < count; i++) {
    const a = i * 2.399;
    const r = radius * Math.sqrt((i + 0.5) / count);
    const fx = cx + Math.cos(a) * r;
    const fz = cz + Math.sin(a) * r;
    const fy = getTerrainHeight(fx, fz);

    const stemH = 0.28 + (i % 3) * 0.08;
    cylinder(0.018, 0.024, stemH, mat('#56834d'), world, [fx, fy + stemH * 0.5, fz], 5, false);

    const bloomMat = palette[i % palette.length];
    const bloom = sphere(0.12, bloomMat, world, [fx, fy + stemH + 0.05, fz], [1.1, 0.75, 1.1], 1, false);
    petals.push({ mesh: bloom, baseY: fy + stemH + 0.05, phase: a });
  }
}

// ---------------------------------------------------------------------------
// The Little Cup Café (Charming Focal Point)
// ---------------------------------------------------------------------------
function buildLittleCupCafe() {
  const cx = -31, cz = -20;
  const cy = getTerrainHeight(cx, cz);
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  world.add(g);

  // Raised stone terrace / wooden porch
  box(9.2, 0.35, 7.8, mats.stoneTrim, g, [0, 0.18, 0.5]);
  box(8.8, 0.12, 7.4, mats.woodPlank, g, [0, 0.38, 0.5]);

  // Main Café Cottage Body (Cream Plaster with Warm Wood Trim)
  const wallW = 6.2, wallH = 4.2, wallD = 5.2;
  box(wallW, wallH, wallD, mats.plasterCream, g, [0, wallH * 0.5 + 0.38, 0]);

  // Timber framing beams
  for (const sx of [-1, 1]) {
    box(0.24, wallH, 0.24, mats.woodDark, g, [sx * (wallW * 0.5 - 0.12), wallH * 0.5 + 0.38, wallD * 0.5]);
    box(0.24, wallH, 0.24, mats.woodDark, g, [sx * (wallW * 0.5 - 0.12), wallH * 0.5 + 0.38, -wallD * 0.5]);
  }
  box(wallW, 0.22, 0.22, mats.woodDark, g, [0, wallH + 0.3, wallD * 0.5]);
  box(wallW, 0.22, 0.22, mats.woodDark, g, [0, 2.2, wallD * 0.5]);

  // Welcoming curved storybook roof
  const roof = addMesh(new THREE.ConeGeometry(5.2, 2.9, 4), mats.roofTerracotta, g, [0, wallH + 1.6, 0]);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1, 1.05);

  // Roof dormer window
  const dormer = box(1.4, 1.2, 1.3, mats.plasterCream, g, [0, wallH + 1.2, 1.8]);
  const dormerRoof = addMesh(new THREE.ConeGeometry(1.2, 1.1, 4), mats.roofTerracotta, g, [0, wallH + 2.1, 1.8]);
  dormerRoof.rotation.y = Math.PI / 4;
  box(0.7, 0.7, 0.1, mats.glassAmber, g, [0, wallH + 1.2, 2.45]);

  // Stone Chimney with Puffing Smoke
  const chim = box(0.9, 3.4, 0.9, mats.stoneMasonry, g, [2.1, wallH + 1.3, -1.2]);
  box(1.1, 0.25, 1.1, mats.stoneTrim, g, [2.1, wallH + 3.05, -1.2]);
  chimneys.push({ pos: new THREE.Vector3(cx + 2.1, cy + wallH + 3.3, cz - 1.2), timer: 0 });

  // Front Entrance Door
  const door = box(1.25, 2.3, 0.18, mats.woodWarm, g, [-1.2, 1.5, wallD * 0.5 + 0.05]);
  sphere(0.08, mats.goldGleam, g, [-0.75, 1.45, wallD * 0.5 + 0.15], [1, 1, 1], 1);
  box(1.45, 0.18, 0.25, mats.woodDark, g, [-1.2, 2.68, wallD * 0.5 + 0.08]);

  // Multi-pane glowing windows with flower boxes
  const winW = 1.3, winH = 1.3;
  box(winW, winH, 0.12, mats.glassAmber, g, [1.5, 1.9, wallD * 0.5 + 0.06]);
  box(winW + 0.2, 0.12, 0.16, mats.woodDark, g, [1.5, 1.9, wallD * 0.5 + 0.08]);
  box(0.12, winH + 0.2, 0.16, mats.woodDark, g, [1.5, 1.9, wallD * 0.5 + 0.08]);

  // Window flower box
  box(1.45, 0.32, 0.42, mats.woodWarm, g, [1.5, 1.1, wallD * 0.5 + 0.2]);
  for (let f = 0; f < 5; f++) {
    sphere(0.12, f % 2 ? mats.flowerRose : mats.flowerYellow, g,
      [0.95 + f * 0.27, 1.32, wallD * 0.5 + 0.22], [1, 0.8, 1], 1);
  }

  // Striped Fabric Awning over Entrance & Outdoor Terrace
  const awningW = 6.4, awningL = 2.4;
  const awning = box(awningW, 0.16, awningL, mats.awningCoral, g, [0, 3.15, wallD * 0.5 + awningL * 0.48]);
  awning.rotation.x = 0.18;
  for (let s = -3; s <= 3; s++) {
    box(0.68, 0.18, awningL, s % 2 === 0 ? mats.awningCream : mats.awningCoral, g,
      [s * 0.9, 3.14, wallD * 0.5 + awningL * 0.48]).rotation.x = 0.18;
  }
  // Awning support wooden posts
  for (const sx of [-1, 1]) {
    cylinder(0.08, 0.08, 2.7, mats.woodDark, g, [sx * 2.8, 1.65, wallD * 0.5 + awningL * 0.92], 8);
  }

  // Readable 3D Café Signboard: "The Little Cup Café"
  const signGroup = new THREE.Group();
  signGroup.position.set(0, 3.8, wallD * 0.5 + 1.2);
  g.add(signGroup);
  box(3.2, 0.72, 0.14, mats.woodWarm, signGroup, [0, 0, 0]);
  box(3.35, 0.84, 0.08, mats.woodDark, signGroup, [0, 0, -0.04]);
  // Teacup silhouette on sign
  cylinder(0.18, 0.12, 0.22, mats.plasterCream, signGroup, [0, 0.02, 0.1], 10);
  cylinder(0.24, 0.24, 0.04, mats.plasterCream, signGroup, [0, -0.1, 0.1], 10);

  // Outdoor Café Seating: 2 Bistro Tables with Chairs, Teapot & Pastries
  function makeBistroTable(tx, tz) {
    const tg = new THREE.Group();
    tg.position.set(tx, 0.4, tz);
    g.add(tg);
    cylinder(0.85, 0.85, 0.08, mats.woodWarm, tg, [0, 0.95, 0], 16);
    cylinder(0.09, 0.12, 0.95, mats.metalBronze, tg, [0, 0.48, 0], 8);
    cylinder(0.42, 0.42, 0.06, mats.metalBronze, tg, [0, 0.04, 0], 12);

    // Teapot & Cups
    sphere(0.14, mats.plasterMint, tg, [0, 1.08, 0], [1, 0.9, 1], 1);
    cylinder(0.06, 0.04, 0.12, mats.plasterMint, tg, [-0.35, 1.04, 0.15], 8);
    cylinder(0.06, 0.04, 0.12, mats.plasterMint, tg, [0.35, 1.04, -0.15], 8);

    // 2 Curved Woven Wooden Chairs
    for (const rot of [0, Math.PI]) {
      const cg = new THREE.Group();
      cg.position.set(Math.sin(rot) * 1.3, 0, Math.cos(rot) * 1.3);
      cg.rotation.y = rot + Math.PI;
      tg.add(cg);
      cylinder(0.4, 0.4, 0.06, mats.woodWarm, cg, [0, 0.55, 0], 12);
      for (const legX of [-0.26, 0.26]) {
        cylinder(0.04, 0.04, 0.55, mats.woodDark, cg, [legX, 0.28, 0], 6);
      }
      box(0.7, 0.6, 0.06, mats.woodWarm, cg, [0, 0.88, 0.35]).rotation.x = -0.12;
    }
  }
  makeBistroTable(-1.8, wallD * 0.5 + 2.2);
  makeBistroTable(1.8, wallD * 0.5 + 2.2);

  // Blackboard Menu Easel
  const menuEasel = new THREE.Group();
  menuEasel.position.set(-2.8, 0.4, wallD * 0.5 + 3.2);
  menuEasel.rotation.y = 0.35;
  g.add(menuEasel);
  box(0.72, 1.0, 0.06, mats.dark, menuEasel, [0, 0.7, 0]);
  box(0.82, 1.1, 0.04, mats.woodWarm, menuEasel, [0, 0.7, -0.02]);
  for (const lx of [-0.32, 0.32]) cylinder(0.03, 0.03, 1.3, mats.woodDark, menuEasel, [lx, 0.65, 0], 6);
  cylinder(0.03, 0.03, 1.2, mats.woodDark, menuEasel, [0, 0.6, -0.3], 6).rotation.x = -0.25;

  // Festive Bunting Flags between posts
  for (let f = 0; f < 8; f++) {
    const flag = addMesh(new THREE.ConeGeometry(0.24, 0.45, 3), f % 2 === 0 ? mats.roofGold : mats.flowerRose,
      g, [-2.6 + f * 0.74, 3.65 - Math.sin(f * 0.45) * 0.2, wallD * 0.5 + 2.6]);
    flag.rotation.z = Math.PI;
  }

  // Secondary Cozy Residential Cottage nearby
  const cot = new THREE.Group();
  cot.position.set(-39, getTerrainHeight(-39, -14), -14);
  world.add(cot);
  box(4.4, 3.2, 4.0, mats.plasterMint, cot, [0, 1.6, 0]);
  const cotRoof = addMesh(new THREE.ConeGeometry(3.6, 2.2, 4), mats.roofSage, cot, [0, 3.8, 0]);
  cotRoof.rotation.y = Math.PI / 4;
  box(0.9, 1.8, 0.12, mats.woodDark, cot, [0, 0.9, 2.05]);
  box(0.8, 0.8, 0.1, mats.glassAmber, cot, [1.2, 1.8, 2.05]);
  box(0.7, 2.4, 0.7, mats.stoneMasonry, cot, [-1.4, 3.2, -0.8]);

  // Wooden barrel and firewood stack beside secondary cottage
  cylinder(0.42, 0.38, 0.9, mats.woodDark, cot, [2.5, 0.45, 1.2], 10);
  cylinder(0.38, 0.34, 0.8, mats.woodWarm, cot, [2.5, 0.4, 0.3], 10);
}

// ---------------------------------------------------------------------------
// Wishing Garden (Lush Haven, Grand Wishing Tree, Pond & Tiered Fountain)
// ---------------------------------------------------------------------------
function buildWishingGarden() {
  const gx = 29, gz = -18;
  const gy = getTerrainHeight(gx, gz);
  const gardenGroup = new THREE.Group();
  gardenGroup.position.set(gx, gy, gz);
  world.add(gardenGroup);

  // Sunken Stone-Rimmed Pond
  const pondR = 5.2;
  const pondRing = addMesh(new THREE.TorusGeometry(pondR, 0.35, 12, 48), mats.stoneMasonry, gardenGroup, [0, 0.35, 0]);
  pondRing.rotation.x = Math.PI / 2;

  const pondWater = addMesh(new THREE.CircleGeometry(pondR, 48), mats.water, gardenGroup, [0, 0.28, 0], false);
  pondWater.rotation.x = -Math.PI / 2;

  // Floating Water Lily Pads & Lotus Flowers
  for (let i = 0; i < 7; i++) {
    const a = i * 0.95;
    const r = 1.8 + (i % 3) * 0.95;
    const px = Math.cos(a) * r;
    const pz = Math.sin(a) * r;
    const pad = addMesh(new THREE.CircleGeometry(0.42, 16), mats.leafGreenA, gardenGroup, [px, 0.3, pz], false);
    pad.rotation.x = -Math.PI / 2;
    if (i % 2 === 0) {
      sphere(0.14, mats.flowerRose, gardenGroup, [px, 0.38, pz], [1.1, 0.8, 1.1], 1);
    }
  }

  // Tiered Classical Stone Fountain in Pond Center
  const fountainBase = cylinder(0.85, 1.1, 0.9, mats.stoneMasonry, gardenGroup, [0, 0.6, 0], 16);
  const basinLower = cylinder(1.6, 1.3, 0.3, mats.stoneTrim, gardenGroup, [0, 1.15, 0], 16);
  const stemMid = cylinder(0.35, 0.45, 0.9, mats.stoneMasonry, gardenGroup, [0, 1.65, 0], 12);
  const basinUpper = cylinder(0.9, 0.75, 0.24, mats.stoneTrim, gardenGroup, [0, 2.15, 0], 14);
  const finial = sphere(0.32, mats.stoneTrim, gardenGroup, [0, 2.5, 0], [1, 1.2, 1], 1);

  // Arcing Fountain Water Jets
  for (let j = 0; j < 6; j++) {
    const ja = j * (Math.PI * 2 / 6);
    const jet = cylinder(0.02, 0.045, 0.85, mats.waterFoam, gardenGroup,
      [Math.cos(ja) * 0.55, 1.85, Math.sin(ja) * 0.55], 6, false);
    jet.rotation.z = Math.cos(ja) * 0.42;
    jet.rotation.x = Math.sin(ja) * 0.42;
  }

  // The Grand Wishing Tree (Majestic Cherry Tree with Swaying Ribbons & Glowing Lanterns)
  const wishTree = createStylizedTree(39, -23, 1.7, 'cherry');
  // Hanging colorful pastel ribbons
  for (let i = 0; i < 18; i++) {
    const a = i * 2.399;
    const dist = 1.6 + (i % 4) * 0.45;
    const ribbonMat = [mats.flowerRose, mats.flowerYellow, mats.flowerViolet, mats.flowerBlue][i % 4];
    const ribbon = box(0.08, 1.1, 0.08, ribbonMat, wishTree,
      [Math.cos(a) * dist, 2.8 + (i % 3) * 0.35, Math.sin(a) * dist]);
    ribbon.rotation.z = Math.sin(a) * 0.35;
    animated.push({ mesh: ribbon, kind: 'sway', phase: a });
  }
  // Hanging Glowing Paper Lanterns
  for (let i = 0; i < 5; i++) {
    const a = i * (Math.PI * 2 / 5) + 0.4;
    const lDist = 2.1;
    const lantern = sphere(0.24, mats.star, wishTree,
      [Math.cos(a) * lDist, 2.4 + (i % 2) * 0.4, Math.sin(a) * lDist], [1, 1.25, 1], 1);
    animated.push({ mesh: lantern, kind: 'float', phase: a * 2 });
  }

  // Wooden Garden Pergola / Trellis Arch
  const archGroup = new THREE.Group();
  archGroup.position.set(19, getTerrainHeight(19, -15), -15);
  archGroup.rotation.y = 0.55;
  world.add(archGroup);
  for (const sx of [-1.3, 1.3]) {
    for (const sz of [-0.9, 0.9]) {
      cylinder(0.08, 0.08, 2.9, mats.woodDark, archGroup, [sx, 1.45, sz], 8);
    }
    box(0.12, 0.12, 2.2, mats.woodWarm, archGroup, [sx, 2.9, 0]);
  }
  for (let r = -3; r <= 3; r++) {
    box(3.1, 0.08, 0.12, mats.woodWarm, archGroup, [0, 3.0, r * 0.32]);
  }
  // Climbing wisteria foliage on arch
  for (let w = 0; w < 12; w++) {
    const wx = (w % 2 === 0 ? -1.3 : 1.3) + (Math.random() - 0.5) * 0.4;
    sphere(0.32, mats.flowerViolet, archGroup, [wx, 1.6 + (w % 4) * 0.4, (w % 3 - 1) * 0.6], [1, 1.3, 1], 1);
  }

  // Cozy Curved Garden Bench & Birdbath
  const benchG = new THREE.Group();
  benchG.position.set(24, getTerrainHeight(24, -24), -24);
  benchG.rotation.y = -0.4;
  world.add(benchG);
  box(2.2, 0.16, 0.75, mats.woodWarm, benchG, [0, 0.65, 0]);
  box(2.2, 0.65, 0.12, mats.woodWarm, benchG, [0, 1.05, 0.32]);
  for (const bx of [-0.85, 0.85]) {
    cylinder(0.06, 0.06, 0.65, mats.metalBronze, benchG, [bx, 0.32, -0.22], 6);
    cylinder(0.06, 0.06, 0.65, mats.metalBronze, benchG, [bx, 0.32, 0.22], 6);
  }

  // Birdbath
  const birdbath = new THREE.Group();
  birdbath.position.set(34, getTerrainHeight(34, -13), -13);
  world.add(birdbath);
  cylinder(0.14, 0.28, 1.1, mats.stoneTrim, birdbath, [0, 0.55, 0], 10);
  cylinder(0.7, 0.45, 0.2, mats.stoneTrim, birdbath, [0, 1.15, 0], 14);
  cylinder(0.62, 0.62, 0.04, mats.water, birdbath, [0, 1.22, 0], 14, false);

  // Surrounding layered flowerbeds
  flowerCluster(25, -12, 34, 6, [mats.flowerViolet, mats.flowerRose, mats.flowerWhite]);
  flowerCluster(35, -20, 42, 8, [mats.flowerRose, mats.flowerYellow, mats.flowerViolet]);
  flowerCluster(31, -27, 28, 5, [mats.flowerBlue, mats.flowerWhite, mats.flowerYellow]);
}

// ---------------------------------------------------------------------------
// The Starlit Castle (Majestic Northern Landmark & Finale Sanctuary)
// ---------------------------------------------------------------------------
function buildStarlitCastle() {
  const cx = 2, cz = 44;
  const cy = getTerrainHeight(cx, cz);
  const castle = new THREE.Group();
  castle.position.set(cx, cy, cz);
  world.add(castle);

  // Grand Stone Courtyard Terrace
  box(24, 0.8, 22, mats.stoneTrim, castle, [0, 0.4, 0]);
  box(23, 0.2, 21, mats.stoneMasonry, castle, [0, 0.85, 0]);

  // Grand Castle Approach Stairway facing South
  for (let s = 0; s < 7; s++) {
    const stepY = 0.8 - s * 0.18;
    const stepZ = -11.0 - s * 1.1;
    box(7.5, 0.25, 1.25, mats.stoneTrim, castle, [0, stepY, stepZ]);
    if (s === 6) {
      // Flanking stone pedestal lanterns
      for (const lx of [-4.2, 4.2]) {
        cylinder(0.35, 0.45, 1.4, mats.stoneTrim, castle, [lx, stepY + 0.7, stepZ], 8);
        sphere(0.22, mats.star, castle, [lx, stepY + 1.6, stepZ], [1, 1, 1], 1);
      }
    }
  }

  // Main Central Royal Keep
  const keepW = 14, keepH = 10.5, keepD = 10;
  box(keepW, keepH, keepD, mats.plasterCream, castle, [0, keepH * 0.5 + 0.8, 2]);

  // Keep Stone Quoins & Wall Trim
  box(keepW + 0.4, 0.5, keepD + 0.4, mats.stoneTrim, castle, [0, keepH + 0.8, 2]);

  // Crenellated Battlements on Main Keep
  for (let b = 0; b < 6; b++) {
    box(1.2, 0.8, 0.4, mats.stoneTrim, castle, [-5.5 + b * 2.2, keepH + 1.3, keepD * 0.5 + 2]);
    box(1.2, 0.8, 0.4, mats.stoneTrim, castle, [-5.5 + b * 2.2, keepH + 1.3, -keepD * 0.5 + 2]);
  }

  // Graceful Slender Royal Spire on Keep
  const keepRoof = addMesh(new THREE.ConeGeometry(5.4, 6.2, 8), mats.roofRoyal, castle, [0, keepH + 3.9 + 0.8, 2]);
  sphere(0.32, mats.goldGleam, castle, [0, keepH + 7.4 + 0.8, 2], [1, 1.5, 1], 1);

  // Four Soaring Flanking Corner Towers
  const towerPositions = [
    [-8.2, -4.5], [8.2, -4.5],
    [-8.2, 7.5], [8.2, 7.5]
  ];

  towerPositions.forEach(([tx, tz], i) => {
    const towerH = 13.5;
    cylinder(1.6, 1.85, towerH, mats.plasterCream, castle, [tx, towerH * 0.5 + 0.8, tz], 12);
    // Overhanging corbel course
    cylinder(2.0, 1.7, 0.6, mats.stoneTrim, castle, [tx, towerH + 0.8, tz], 12);

    // Tower Conical Spire
    const spireMat = i % 2 === 0 ? mats.roofTerracotta : mats.roofRoyal;
    const spire = addMesh(new THREE.ConeGeometry(2.1, 4.8, 10), spireMat, castle, [tx, towerH + 3.2 + 0.8, tz]);
    sphere(0.24, mats.goldGleam, castle, [tx, towerH + 5.8 + 0.8, tz], [1, 1.6, 1], 1);

    // Silk Pennant / Banner fluttering on towers
    const pennant = addMesh(new THREE.ConeGeometry(0.38, 1.5, 3), mats.roofGold, castle, [tx, towerH + 6.6 + 0.8, tz]);
    pennant.rotation.z = Math.PI;
    animated.push({ mesh: pennant, kind: 'sway', phase: i * 1.2 });
  });

  // Grand Arched Castle Gate with Iron-Studded Timber Doors
  box(3.2, 4.4, 0.4, mats.woodDark, castle, [0, 2.7, -3.1]);
  // Arched stone lintel
  cylinder(2.1, 2.1, 0.5, mats.stoneTrim, castle, [0, 4.8, -3.1], 14).rotation.x = Math.PI / 2;
  // Glowing Arched Castle Windows
  for (const wx of [-3.8, 3.8]) {
    box(1.1, 2.2, 0.2, mats.glassAmber, castle, [wx, 6.2, -3.1]);
    cylinder(0.65, 0.65, 0.25, mats.stoneTrim, castle, [wx, 7.4, -3.1], 10).rotation.x = Math.PI / 2;
  }

  // Castle Courtyard Romantic Sanctuary & Finale Altar
  const heartBaseY = 1.0;
  cylinder(3.2, 3.5, 0.55, mats.stoneTrim, castle, [0, heartBaseY + 0.28, -7.5], 16);
  cylinder(2.5, 2.8, 0.35, mats.stoneMasonry, castle, [0, heartBaseY + 0.65, -7.5], 16);

  // Heart-Shaped Finale Monument
  const heartObj = new THREE.Group();
  heartObj.position.set(0, heartBaseY + 2.3, -7.5);
  castle.add(heartObj);

  const heartMat = mats.heartMagic;
  sphere(0.72, heartMat, heartObj, [-0.46, 0.12, 0], [1, 0.95, 0.6], 2);
  sphere(0.72, heartMat, heartObj, [0.46, 0.12, 0], [1, 0.95, 0.6], 2);
  const heartTip = addMesh(new THREE.ConeGeometry(0.82, 1.45, 4), heartMat, heartObj, [0, -0.62, 0]);
  heartTip.rotation.y = Math.PI / 4;
  heartTip.rotation.x = Math.PI;

  animated.push({ mesh: heartObj, kind: 'float', phase: 1.0 });

  // Floating crystalline starlight constellation circling the heart
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10;
    const crystal = sphere(0.14, mats.star, castle,
      [Math.cos(a) * 4.2, heartBaseY + 1.5, -7.5 + Math.sin(a) * 4.2], [1, 1.4, 1], 1);
    animated.push({ mesh: crystal, kind: 'orbit', phase: a, center: [0, heartBaseY + 1.5, -7.5] });
  }
}

// ---------------------------------------------------------------------------
// Scatter Environmental Details (Rocks, Trees, Flower patches)
// ---------------------------------------------------------------------------
function populateWorldDetails() {
  buildLittleCupCafe();
  buildWishingGarden();
  buildStarlitCastle();

  // Natural Boulders & Mossy Stones along paths & water
  for (let i = 0; i < 28; i++) {
    const a = i * 0.58;
    const r = 16 + (i % 6) * 5.2;
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r;
    // Don't place rocks inside core region centers
    if (Math.hypot(rx + 31, rz + 20) < 9 || Math.hypot(rx - 29, rz + 18) < 9 || Math.hypot(rx - 2, rz - 44) < 14) continue;
    const ry = getTerrainHeight(rx, rz);
    const rock = sphere(0.65 + (i % 3) * 0.22, mats.stoneTrim, world, [rx, ry + 0.22, rz],
      [1.15, 0.55 + (i % 2) * 0.2, 0.9], 1, true);
    rock.rotation.y = a;
    rock.rotation.z = Math.sin(a) * 0.15;
  }

  // Diverse Storybook Trees with clearing-aware distribution
  let seed = 28192;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 48; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 14 + rnd() * 32;
    const tx = Math.cos(a) * r;
    const tz = Math.sin(a) * r;

    // Check clearings
    const inCafe = Math.hypot(tx + 31, tz + 20) < 11;
    const inGarden = Math.hypot(tx - 29, tz + 18) < 11;
    const inCastle = Math.hypot(tx - 2, tz - 44) < 16;
    const inPlaza = Math.hypot(tx, tz - 2) < 6;

    if (!inCafe && !inGarden && !inCastle && !inPlaza) {
      const treeScale = 0.85 + rnd() * 0.45;
      const treeType = i % 4 === 0 ? 'pine' : (i % 3 === 0 ? 'cherry' : 'oak');
      createStylizedTree(tx, tz, treeScale, treeType);
    }
  }

  // Meadow flower patches in central plains
  flowerCluster(-5, 8, 30, 5, [mats.flowerRose, mats.flowerYellow, mats.flowerViolet]);
  flowerCluster(7, -8, 25, 4.5, [mats.flowerBlue, mats.flowerYellow, mats.flowerWhite]);
  flowerCluster(-12, -4, 22, 4, [mats.flowerViolet, mats.flowerRose, mats.flowerYellow]);
}
populateWorldDetails();

// ---------------------------------------------------------------------------
// 12 Collectible Stars (Preserved IDs & Saved Progress)
// ---------------------------------------------------------------------------
const starPositions = [
  [-40, -24], [-23, -27], [-36, -8], [-20, -17], // Near Café
  [23, -26], [38, -19], [31, -8], [42, -14],     // Near Garden
  [-8, 43], [14, 43], [2, 54], [2, 31]           // Near Castle
];

starPositions.forEach(([sx, sz], i) => {
  const sy = getTerrainHeight(sx, sz) + 1.45;
  const starId = `star-${i}`;
  const holder = new THREE.Group();
  holder.position.set(sx, sy, sz);
  world.add(holder);

  const gem = addMesh(new THREE.OctahedronGeometry(0.46, 0), mats.star, holder, [0, 0, 0]);
  const halo = addMesh(new THREE.TorusGeometry(0.72, 0.035, 8, 28), mats.starGlow, holder, [0, 0, 0], false);
  halo.rotation.x = Math.PI / 2;
  const diskGlow = addMesh(new THREE.CircleGeometry(0.85, 24), mats.starGlow, holder, [0, -0.45, 0], false);
  diskGlow.rotation.x = -Math.PI / 2;

  holder.userData.type = 'star';
  holder.userData.id = starId;
  holder.userData.label = 'A little star';

  interactables.push(holder);
  starObjects.push({ holder, gem, baseY: sy, phase: i * 0.85 });

  if (state.stars.has(starId)) {
    holder.visible = false;
  }
});

// ---------------------------------------------------------------------------
// Hidden Keepsake Lanterns (Notes 0, 1, 2)
// ---------------------------------------------------------------------------
function createNoteLantern(x, z, noteIdx) {
  const y = getTerrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  world.add(g);

  cylinder(0.12, 0.16, 1.4, mats.metalBronze, g, [0, 0.7, 0], 8);
  cylinder(0.34, 0.44, 0.75, mats.metalBronze, g, [0, 1.6, 0], 8);
  sphere(0.24, mats.star, g, [0, 1.6, 0], [1, 1.3, 1], 1);
  const cap = addMesh(new THREE.ConeGeometry(0.5, 0.45, 8), mats.metalBronze, g, [0, 2.15, 0]);
  cap.rotation.y = 0.2;

  // Floating starlight note orb above lantern
  const orb = sphere(0.18, mats.star, g, [0, 2.65, 0], [1, 1, 1], 1);
  animated.push({ mesh: orb, kind: 'float', phase: noteIdx * 2.1 });

  g.userData.type = 'note';
  g.userData.id = `note-${noteIdx}`;
  g.userData.noteIndex = noteIdx;
  g.userData.label = 'A hidden note';
  interactables.push(g);
  return g;
}

createNoteLantern(-22, -12, 0); // Near Café overlook
createNoteLantern(21, -11, 1);  // Near Garden pergola
createNoteLantern(-1, 31, 2);   // Near Castle stairway

// ---------------------------------------------------------------------------
// Interactive Props: Café Snack & Garden Yarn
// ---------------------------------------------------------------------------
// Picnic treat table on café deck
const snackAnchor = new THREE.Group();
snackAnchor.position.set(-29, getTerrainHeight(-29, -15), -15);
snackAnchor.userData.type = 'snack';
snackAnchor.userData.label = 'A little treat';
interactables.push(snackAnchor);
world.add(snackAnchor);

// Basket of yarn in Wishing Garden
const yarnGroup = new THREE.Group();
yarnGroup.position.set(23, getTerrainHeight(23, -11), -11);
world.add(yarnGroup);
cylinder(0.65, 0.75, 0.5, mats.woodPlank, yarnGroup, [0, 0.35, 0], 12);
const yarnColors = [mats.flowerRose, mats.flowerViolet, mats.roofGold, mats.roofSage];
for (let i = 0; i < 4; i++) {
  sphere(0.32, yarnColors[i], yarnGroup, [-0.35 + i * 0.24, 0.8, 0], [1, 1, 1], 2);
}
yarnGroup.userData.type = 'yarn';
yarnGroup.userData.label = 'Play with the yarn';
interactables.push(yarnGroup);

// Finale Altar Interaction Anchor at Castle Courtyard
const finaleAnchor = new THREE.Group();
finaleAnchor.position.set(2, getTerrainHeight(2, 36.5) + 0.8, 36.5);
finaleAnchor.userData.type = 'finale';
finaleAnchor.userData.label = 'Open the castle surprise';
interactables.push(finaleAnchor);
world.add(finaleAnchor);

// ---------------------------------------------------------------------------
// Player Character (Charming Animated Storybook Explorer)
// ---------------------------------------------------------------------------
const playerGroup = new THREE.Group();
scene.add(playerGroup);

const avatar = new THREE.Group();
playerGroup.add(avatar);

// Torso & Warm Coat
const torso = addMesh(new THREE.CapsuleGeometry(0.42, 0.88, 6, 12), mats.charCoat, avatar, [0, 1.25, 0]);

// Head, Hair, & Facial Features
const head = sphere(0.42, mats.charSkin, avatar, [0, 2.12, 0.04], [0.94, 1.05, 0.92], 2);
const hair = sphere(0.44, mats.charHair, avatar, [0, 2.38, -0.04], [1.02, 0.72, 1.0], 2);
for (const s of [-1, 1]) {
  sphere(0.26, mats.charHair, avatar, [s * 0.32, 2.18, 0.08], [0.65, 0.78, 0.65], 1);
  // Rosy cheeks
  sphere(0.06, mats.catPink, avatar, [s * 0.26, 2.02, 0.38], [1, 0.55, 0.5], 1);
  // Eyes
  sphere(0.045, mats.dark, avatar, [s * 0.14, 2.14, 0.41], [1, 1, 1], 1);
}

// Warm Scarf with Flowing Trailing Tail
const scarfCollar = box(0.8, 0.18, 0.6, mats.charScarf, avatar, [0, 1.84, 0.24]);
scarfCollar.rotation.x = -0.15;
const scarfTail = box(0.24, 0.65, 0.08, mats.charScarf, avatar, [-0.22, 1.48, 0.44]);
scarfTail.rotation.x = 0.25;

// Articulated Arms
const armL = addMesh(new THREE.CapsuleGeometry(0.13, 0.48, 4, 8), mats.charCoat, avatar, [-0.54, 1.25, 0]);
const armR = addMesh(new THREE.CapsuleGeometry(0.13, 0.48, 4, 8), mats.charCoat, avatar, [0.54, 1.25, 0]);

// Articulated Legs & Boots
const legs = [];
for (const s of [-1, 1]) {
  const legG = new THREE.Group();
  legG.position.set(s * 0.22, 0.72, 0);
  avatar.add(legG);
  const legMesh = addMesh(new THREE.CapsuleGeometry(0.14, 0.48, 4, 8), mats.charPants, legG, [0, -0.28, 0]);
  const boot = sphere(0.18, mats.charBoots, legG, [0, -0.56, 0.08], [1, 0.6, 1.35], 1);
  legs.push(legG);
}

// ---------------------------------------------------------------------------
// Interactive Companion Cat (Chubby Storybook Kitty)
// ---------------------------------------------------------------------------
const catGroup = new THREE.Group();
scene.add(catGroup);

const catBody = sphere(0.54, mats.catCoat, catGroup, [0, 0.56, 0], [1.25, 0.74, 0.85], 2);
const catHead = sphere(0.44, mats.catCoat, catGroup, [0, 0.94, 0.58], [1, 0.94, 0.88], 2);

// Ears, Whiskers & Face
for (const s of [-1, 1]) {
  const ear = addMesh(new THREE.ConeGeometry(0.2, 0.46, 4), mats.catCoat, catGroup, [s * 0.28, 1.32, 0.58]);
  ear.rotation.z = s * -0.18;
  sphere(0.12, mats.catPink, catGroup, [s * 0.28, 1.32, 0.64], [0.7, 0.85, 0.4], 1);
  // Cute Cat Eyes
  sphere(0.04, mats.dark, catGroup, [s * 0.16, 1.02, 0.94], [1, 1, 1], 1);
  // White muzzle patches
  sphere(0.14, mats.catWhite, catGroup, [s * 0.15, 0.8, 0.9], [1, 0.7, 0.5], 1);
}
sphere(0.065, mats.catPink, catGroup, [0, 0.86, 0.99], [1, 0.75, 0.8], 1);

// Articulated Tail
const catTail = new THREE.Group();
catTail.position.set(0, 0.65, -0.5);
catGroup.add(catTail);
for (let i = 0; i < 6; i++) {
  sphere(0.16, mats.catCoat, catTail, [Math.sin(i * 0.55) * 0.16, 0.15 + i * 0.15, -i * 0.09], [0.85, 1.25, 0.85], 1);
}

// 4 Little Paws
const catLegs = [];
for (const x of [-0.32, 0.32]) {
  for (const z of [-0.26, 0.34]) {
    const leg = addMesh(new THREE.CapsuleGeometry(0.1, 0.35, 4, 6), mats.catCoat, catGroup, [x, 0.24, z]);
    catLegs.push(leg);
  }
}

catGroup.position.set(-25, getTerrainHeight(-25, -13), -13);
catGroup.userData.type = 'cat';
catGroup.userData.label = 'Say hello to the cat';
interactables.push(catGroup);

const catState = {
  mode: 'idle',
  timer: 0,
  step: 0,
  base: new THREE.Vector3(-25, 0, -13),
  target: new THREE.Vector3(-25, 0, -13),
  follow: state.catBond >= 3
};

// ---------------------------------------------------------------------------
// Solid Obstacles & Sliding Collision System
// ---------------------------------------------------------------------------
const solids = [
  // The Little Cup Café main building & secondary cottage
  { x: -31, z: -20, r: 4.6 },
  { x: -39, z: -14, r: 3.4 },
  // Garden sunken pond center & wishing tree
  { x: 29, z: -18, r: 4.8 },
  { x: 39, z: -23, r: 2.2 },
  // Starlit Castle keep, walls, and corner towers
  { x: 2, z: 46, r: 9.8 },
  { x: -8.2, z: 39.5, r: 2.2 },
  { x: 8.2, z: 39.5, r: 2.2 },
  { x: -8.2, z: 51.5, r: 2.2 },
  { x: 8.2, z: 51.5, r: 2.2 }
];

function resolveCollisions(pos, vel) {
  // 1. Sliding collision against solid buildings and features
  for (const s of solids) {
    const dx = pos.x - s.x;
    const dz = pos.z - s.z;
    const dist = Math.hypot(dx, dz);
    if (dist < s.r) {
      const overlap = s.r - dist;
      const nx = dx / (dist || 1);
      const nz = dz / (dist || 1);
      pos.x += nx * overlap;
      pos.z += nz * overlap;

      // Project velocity out of obstacle normal (frictionless slide)
      const vDotN = vel.x * nx + vel.z * nz;
      if (vDotN < 0) {
        vel.x -= vDotN * nx;
        vel.z -= vDotN * nz;
      }
    }
  }

  // 2. Soft Island Perimeter Containment
  const maxR = 53;
  const currR = Math.hypot(pos.x, pos.z);
  if (currR > maxR) {
    const nx = pos.x / currR;
    const nz = pos.z / currR;
    pos.x = nx * maxR;
    pos.z = nz * maxR;
    const vDotN = vel.x * nx + vel.z * nz;
    if (vDotN > 0) {
      vel.x -= vDotN * nx;
      vel.z -= vDotN * nz;
    }
  }
}

// ---------------------------------------------------------------------------
// Regions & Discovery Logic
// ---------------------------------------------------------------------------
const regions = [
  { name: 'Mosslight Meadow', note: 'THE WORLD IS YOURS TO WANDER', x: 0, z: 0, r: 20 },
  { name: 'The Little Cup Café', note: 'WARM TEA · WARMER COMPANY', x: -31, z: -20, r: 21 },
  { name: 'Wishing Garden', note: 'A QUIET PLACE FOR BRIGHT THOUGHTS', x: 29, z: -18, r: 21 },
  { name: 'The Starlit Castle', note: 'SOME SECRETS WAIT AT THE TOP', x: 2, z: 42, r: 24 }
];

// ---------------------------------------------------------------------------
// Camera Orbit, Damping & Controls
// ---------------------------------------------------------------------------
let cameraYaw = -0.15; // Framed gently so castle, café path and garden path are all invitingly composed
let cameraPitch = 0.38;
let cameraDistance = 12.5;
let drag = null;
let pointerDownPos = null;

const moveKeys = new Set();
const joystickVector = new THREE.Vector2();

function updateCamera(dt) {
  const targetY = state.playerPos.y + 1.45;
  const lookTarget = new THREE.Vector3(state.playerPos.x, targetY, state.playerPos.z);

  const cp = Math.cos(cameraPitch);
  const sp = Math.sin(cameraPitch);
  const offset = new THREE.Vector3(
    Math.sin(cameraYaw) * cp * cameraDistance,
    sp * cameraDistance,
    Math.cos(cameraYaw) * cp * cameraDistance
  );
  const desired = lookTarget.clone().add(offset);

  // Smooth camera position damping
  camera.position.lerp(desired, 1 - Math.exp(-dt * 7.5));
  camera.lookAt(lookTarget);
}

// ---------------------------------------------------------------------------
// Saved State, HUD & Quests
// ---------------------------------------------------------------------------
function persist() {
  try {
    localStorage.setItem(
      saveKey,
      JSON.stringify({
        stars: [...state.stars],
        notes: [...state.notes],
        catBond: state.catBond,
        finale: state.finale,
        x: state.playerPos.x,
        z: state.playerPos.z
      })
    );
  } catch {}
}

function showToast(message) {
  ui.toast.textContent = message;
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
ui.modal.addEventListener('click', (e) => {
  if (e.target === ui.modal) closeModal();
});

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
    ui.quest.textContent = `Make a friend in the garden · ${state.catBond}/3`;
    ui.questIcon.textContent = '♡';
  } else {
    ui.questKicker.textContent = 'THE LAST LITTLE SECRET';
    ui.quest.textContent = 'Visit the castle heart';
    ui.questIcon.textContent = '⌂';
  }
}
refreshQuest();

// ---------------------------------------------------------------------------
// Procedural Web Audio Synthesis & Controls
// ---------------------------------------------------------------------------
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

    // Warm, dreamy pentatonic arpeggio
    const notes = [261.63, 329.63, 392.0, 440.0, 523.25, 392.0, 329.63, 293.66];
    let n = 0;
    musicTimer = setInterval(() => {
      if (!audioCtx || audioCtx.state !== 'running') return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = notes[n++ % notes.length];
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(now);
      osc.stop(now + 1.85);
    }, 940);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function sound(kind = 'sparkle') {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const config = {
    sparkle: [880, 0.26, 'sine'],
    pet: [560, 0.22, 'triangle'],
    feed: [430, 0.2, 'sine'],
    yarn: [720, 0.16, 'triangle'],
    note: [660, 0.48, 'sine'],
    finish: [523, 0.85, 'sine']
  };
  const [freq, dur, type] = config[kind] || config.sparkle;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + dur * 0.35);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + dur);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(kind === 'finish' ? 0.2 : 0.1, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function setVolume(v) {
  volume = v;
  localStorage.setItem('joos-volume', String(Math.round(v * 100)));
  ui.volumeValue.textContent = `${Math.round(v * 100)}%`;
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(muted ? 0 : v, audioCtx.currentTime, 0.08);
  }
}
ui.volume.addEventListener('input', () => setVolume(Number(ui.volume.value) / 100));
ui.sound.addEventListener('click', () => {
  ui.soundPanel.hidden = !ui.soundPanel.hidden;
});
ui.soundPanel.addEventListener('click', (e) => e.stopPropagation());

function toggleMute() {
  muted = !muted;
  localStorage.setItem('joos-muted', String(muted));
  ui.sound.textContent = muted ? '◌' : '♫';
  ui.mute.textContent = muted ? 'Turn sounds back on' : 'Mute all sounds';
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(muted ? 0 : volume, audioCtx.currentTime, 0.08);
  }
}
ui.mute.addEventListener('click', toggleMute);
ui.mute.textContent = muted ? 'Turn sounds back on' : 'Mute all sounds';

ui.help.addEventListener('click', () =>
  openModal({
    eyebrow: 'HOW TO WANDER',
    title: 'Take your time.',
    body: 'Explore with WASD or the arrow keys. On mobile, glide with the thumbstick. Drag anywhere to gently look around. Walk close to something curious and press E or tap the heart. The stars are yours to discover; the rest unfolds when you are ready.',
    button: 'Let’s go'
  })
);

ui.begin.addEventListener('click', () => {
  state.started = true;
  ui.welcome.classList.add('leaving');
  startAudio();
  showToast('Welcome to your little universe ✦');
});

// ---------------------------------------------------------------------------
// Interaction System (Stars, Notes, Cat, Finale)
// ---------------------------------------------------------------------------
function getNearestInteractable() {
  let best = null, bestD = Infinity;
  for (const obj of interactables) {
    if (!obj.visible) continue;
    const p = new THREE.Vector3();
    obj.getWorldPosition(p);
    const d = Math.hypot(state.playerPos.x - p.x, state.playerPos.z - p.z);
    if (d < 3.4 && d < bestD) {
      best = obj;
      bestD = d;
    }
  }
  return best;
}

function interact(obj = state.active) {
  if (!obj || state.modalOpen) return;
  const type = obj.userData.type;

  if (type === 'star') {
    if (state.stars.has(obj.userData.id)) return;
    state.stars.add(obj.userData.id);
    obj.visible = false;
    persist();
    refreshQuest();
    sound('sparkle');
    const msgs = [
      'A little light for your pocket ✦',
      'One more star gathered ✧',
      'The sky feels closer already ♡'
    ];
    showToast(msgs[state.stars.size % msgs.length]);
    return;
  }

  if (type === 'note') {
    const idx = obj.userData.noteIndex;
    const id = obj.userData.id;
    if (state.notes.has(id)) {
      showToast('You’ve already tucked this one away ♡');
      return;
    }
    state.notes.add(id);
    persist();
    sound('note');
    const n = messages.notes[idx % messages.notes.length];
    openModal({ title: n.title, body: n.body });
    return;
  }

  if (type === 'cat') {
    const bond = state.catBond;
    if (bond === 0) {
      state.catBond++;
      catState.mode = 'purr';
      catState.timer = 2.8;
      sound('pet');
      openModal({
        eyebrow: 'A NEW LITTLE FRIEND',
        title: 'Oh, hello there.',
        body: 'The tiny garden cat leans into your hand and gives the softest purr. Looks like you’ve made a friend.',
        button: 'Say hello'
      });
    } else if (bond === 1) {
      state.catBond++;
      catState.mode = 'snack';
      catState.timer = 3.0;
      sound('feed');
      openModal({
        eyebrow: 'A VERY GOOD TREAT',
        title: 'The way to a heart…',
        body: 'A little treat, a little trust, and a very happy tail. Your new friend decides you’re worth following.',
        button: 'That’s sweet'
      });
    } else {
      state.catBond++;
      catState.mode = 'play';
      catState.timer = 3.4;
      catState.target.copy(catGroup.position);
      catState.follow = true;
      sound('yarn');
      openModal({
        eyebrow: 'BEST FRIENDS',
        title: 'Your shadow, with whiskers.',
        body: 'A tumble through the yarn, a happy little chirp, and now you have a faithful companion for the rest of your adventure.',
        button: 'Let’s go together'
      });
    }
    persist();
    refreshQuest();
    return;
  }

  if (type === 'snack') {
    if (catState.mode === 'snack') {
      showToast('Your friend already found the treats!');
      return;
    }
    catState.mode = 'snack';
    catState.timer = 3.2;
    catState.target.set(-29, 0, -15);
    sound('feed');
    showToast('A tiny picnic for two ♡');
    return;
  }

  if (type === 'yarn') {
    catState.mode = 'play';
    catState.timer = 3.6;
    catState.target.set(23, 0, -11);
    sound('yarn');
    showToast('A very serious game of yarn ✦');
    return;
  }

  if (type === 'finale') {
    if (state.stars.size < 12) {
      showToast(`The castle heart waits for ${12 - state.stars.size} more stars ✦`);
      return;
    }
    if (state.catBond < 3) {
      showToast('Your little companion should come along ♡');
      return;
    }
    if (state.finale) {
      openModal({
        eyebrow: 'YOUR FOREVER PLACE',
        title: messages.finale.title,
        body: `${messages.finale.body}\n\n${messages.finale.signOff}`,
        button: 'Keep this close'
      });
      return;
    }
    state.finale = true;
    persist();
    refreshQuest();
    sound('finish');
    openModal({
      eyebrow: 'A LITTLE ROMANTIC SURPRISE',
      title: messages.finale.title,
      body: `${messages.finale.body}\n\n${messages.finale.signOff}`,
      button: 'Keep this close'
    });
    for (let i = 0; i < 48; i++) spawnSparkle();
    return;
  }
}

function spawnSparkle() {
  const ang = Math.random() * Math.PI * 2;
  const rad = 2 + Math.random() * 5;
  const sMesh = sphere(0.12, mats.star, scene, [
    state.playerPos.x + Math.cos(ang) * rad,
    state.playerPos.y + 1 + Math.random() * 3.5,
    state.playerPos.z + Math.sin(ang) * rad
  ], [1, 1, 1], 1);
  animated.push({ mesh: sMesh, kind: 'burst', life: 3.2 });
}

function updateInteractUI() {
  const found = getNearestInteractable();
  state.active = found;
  if (!found) {
    ui.interact.hidden = true;
    return;
  }
  let label = found.userData.label;
  if (found.userData.type === 'cat') {
    label = state.catBond === 0 ? 'Pet the cat' : state.catBond === 1 ? 'Offer a little treat' : 'Play a little yarn';
  }
  if (found.userData.type === 'finale') {
    label = state.stars.size < 12 ? `Castle heart · ${state.stars.size}/12 stars` : state.catBond < 3 ? 'Bring your friend along' : 'Open the surprise';
  }
  ui.interactLabel.textContent = label;
  ui.interactIcon.textContent = found.userData.type === 'star' ? '✦' : found.userData.type === 'finale' ? '♡' : '✧';
  ui.interact.hidden = false;
}

ui.interactButton.addEventListener('click', () => interact());
ui.touchAction.addEventListener('click', () => interact());

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  const k = e.key.toLowerCase();
  moveKeys.add(k);
  if (k === 'e' || e.key === 'Enter') interact();
  if (e.key === 'Escape') {
    closeModal();
    ui.soundPanel.hidden = true;
  }
});

window.addEventListener('keyup', (e) => moveKeys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => moveKeys.clear());

// ---------------------------------------------------------------------------
// Analog Mobile Joystick with Deadzone & Speed Scaling
// ---------------------------------------------------------------------------
let joyPointer = null;
ui.joystick.addEventListener('pointerdown', (e) => {
  joyPointer = e.pointerId;
  ui.joystick.setPointerCapture(e.pointerId);
  moveJoystick(e);
});
ui.joystick.addEventListener('pointermove', (e) => {
  if (e.pointerId === joyPointer) moveJoystick(e);
});

function moveJoystick(e) {
  const rect = ui.joystick.getBoundingClientRect();
  const dx = e.clientX - (rect.left + rect.width * 0.5);
  const dy = e.clientY - (rect.top + rect.height * 0.5);
  const maxR = 36;
  const rawDist = Math.hypot(dx, dy);
  const clampedDist = Math.min(rawDist, maxR);
  const ang = Math.atan2(dy, dx);

  const knobX = Math.cos(ang) * clampedDist;
  const knobY = Math.sin(ang) * clampedDist;
  ui.joyKnob.style.left = `calc(50% + ${knobX}px)`;
  ui.joyKnob.style.top = `calc(50% + ${knobY}px)`;

  // Dead zone of 15% and smooth scaling to 1.0
  const norm = rawDist / maxR;
  const deadZone = 0.15;
  if (norm < deadZone) {
    joystickVector.set(0, 0);
  } else {
    const scale = Math.min(1.0, (norm - deadZone) / (1.0 - deadZone));
    joystickVector.set(Math.cos(ang) * scale, -Math.sin(ang) * scale);
  }
}

function clearJoystick() {
  joyPointer = null;
  joystickVector.set(0, 0);
  ui.joyKnob.style.left = '50%';
  ui.joyKnob.style.top = '50%';
}
ui.joystick.addEventListener('pointerup', clearJoystick);
ui.joystick.addEventListener('pointercancel', clearJoystick);

// ---------------------------------------------------------------------------
// Smooth Camera Orbit & Tap-to-Interact Protection
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button') || e.target.closest('.touch-controls')) return;
  pointerDownPos = { x: e.clientX, y: e.clientY, id: e.pointerId, time: performance.now() };
  drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  renderer.domElement.setPointerCapture(e.pointerId);
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  cameraYaw -= dx * 0.0055;
  cameraPitch = Math.max(0.12, Math.min(0.85, cameraPitch + dy * 0.004));
  drag.x = e.clientX;
  drag.y = e.clientY;
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerDownPos || pointerDownPos.id !== e.pointerId) return;
  const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  const elapsed = performance.now() - pointerDownPos.time;

  // Only consider interaction if pointer did not drag across screen (< 8px)
  if (moved < 8 && elapsed < 400) {
    pointerNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const visible = interactables.filter((o) => o.visible);
    const hits = raycaster.intersectObjects(visible, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && !interactables.includes(obj)) obj = obj.parent;
      if (obj) {
        const p = new THREE.Vector3();
        obj.getWorldPosition(p);
        if (Math.hypot(state.playerPos.x - p.x, state.playerPos.z - p.z) < 7.5) {
          interact(obj);
        } else {
          showToast('Wander a little closer first ✧');
        }
      }
    }
  }
  drag = null;
  pointerDownPos = null;
});

renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    cameraDistance = Math.max(7, Math.min(24, cameraDistance + Math.sign(e.deltaY) * 1.15));
  },
  { passive: true }
);

// ---------------------------------------------------------------------------
// Camera-Relative Movement, Acceleration, Heading & Walk Cycle
// ---------------------------------------------------------------------------
let walkCycle = 0;

function updatePlayer(dt, t) {
  let ix = 0, iz = 0;
  if (moveKeys.has('w') || moveKeys.has('arrowup')) iz += 1;
  if (moveKeys.has('s') || moveKeys.has('arrowdown')) iz -= 1;
  if (moveKeys.has('a') || moveKeys.has('arrowleft')) ix -= 1;
  if (moveKeys.has('d') || moveKeys.has('arrowright')) ix += 1;

  ix += joystickVector.x;
  iz += joystickVector.y;

  // Normalized diagonal speed
  const inputLen = Math.hypot(ix, iz);
  let targetSpeed = 0;
  const targetDir = new THREE.Vector3();

  if (inputLen > 0.05) {
    const normLen = Math.min(1.0, inputLen);
    const nx = ix / inputLen;
    const nz = iz / inputLen;

    // Camera horizontal forward and right vectors
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    targetDir.copy(forward.multiplyScalar(nz).add(right.multiplyScalar(nx))).normalize();

    targetSpeed = normLen * 7.5; // Top walk speed
  }

  // Smooth Acceleration & Deceleration
  const targetVel = targetDir.clone().multiplyScalar(targetSpeed);
  const accelRate = targetSpeed > 0.1 ? 14 : 11;
  state.playerVel.lerp(targetVel, 1 - Math.exp(-dt * accelRate));

  // Integrate movement
  state.playerPos.x += state.playerVel.x * dt;
  state.playerPos.z += state.playerVel.z * dt;

  // Slide collisions & bounds
  resolveCollisions(state.playerPos, state.playerVel);

  // Height follow ground
  const groundY = getTerrainHeight(state.playerPos.x, state.playerPos.z);
  state.playerPos.y = groundY;

  // Smooth heading rotation to face movement direction
  const speed = Math.hypot(state.playerVel.x, state.playerVel.z);
  if (speed > 0.15) {
    const targetHeading = Math.atan2(state.playerVel.x, state.playerVel.z);
    // Shortest angular distance
    let diff = targetHeading - state.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.heading += diff * (1 - Math.exp(-dt * 15));
  }

  // Position Player & Avatar
  playerGroup.position.set(state.playerPos.x, state.playerPos.y, state.playerPos.z);
  avatar.rotation.y = state.heading;

  // Walk Cycle dynamically proportional to actual movement speed
  const isMoving = speed > 0.15;
  if (isMoving) {
    walkCycle += speed * dt * 1.5;
  }

  const bounce = isMoving ? Math.abs(Math.sin(walkCycle * 4.5)) * 0.075 : Math.sin(t * 2.2) * 0.022;
  avatar.position.y = bounce;

  // Legs swing
  legs[0].rotation.x = isMoving ? Math.sin(walkCycle * 4.5) * 0.65 : 0;
  legs[1].rotation.x = isMoving ? Math.sin(walkCycle * 4.5 + Math.PI) * 0.65 : 0;

  // Arms swing
  armL.rotation.x = isMoving ? Math.sin(walkCycle * 4.5 + Math.PI) * 0.45 : Math.sin(t * 2.0) * 0.035;
  armR.rotation.x = isMoving ? Math.sin(walkCycle * 4.5) * 0.45 : Math.sin(t * 2.0 + 1) * 0.035;

  // Scarf flutter
  scarfTail.rotation.x = 0.25 + (isMoving ? Math.sin(walkCycle * 9) * 0.2 + speed * 0.04 : Math.sin(t * 2) * 0.05);

  // Active Region Detection
  const currentRegion =
    regions.find((r) => Math.hypot(state.playerPos.x - r.x, state.playerPos.z - r.z) < r.r) ||
    regions[0];
  if (ui.region.textContent !== currentRegion.name) {
    ui.region.textContent = currentRegion.name;
    ui.regionNote.textContent = currentRegion.note;
  }
}

// ---------------------------------------------------------------------------
// Cat AI & Animation (Idle, Stroll, Treat, Purr, Yarn & Follow Mode)
// ---------------------------------------------------------------------------
function updateCat(dt, t) {
  catState.timer = Math.max(0, catState.timer - dt);

  // Switch modes
  if (catState.mode === 'idle' && catState.timer === 0) {
    catState.timer = 3.5 + Math.random() * 4.5;
    catState.target.set(
      catState.base.x + (Math.random() - 0.5) * 5,
      0,
      catState.base.z + (Math.random() - 0.5) * 5
    );
    catState.mode = 'wander';
  }

  const isFollowing = catState.mode === 'follow' || (catState.follow && catState.mode !== 'purr' && catState.mode !== 'play');
  if (isFollowing) {
    const distToPlayer = Math.hypot(catGroup.position.x - state.playerPos.x, catGroup.position.z - state.playerPos.z);
    if (distToPlayer > 3.6) {
      catState.target.set(state.playerPos.x, state.playerPos.y, state.playerPos.z);
      catState.mode = 'follow';
    } else if (catState.mode === 'follow' && distToPlayer < 2.5) {
      catState.mode = 'idle';
      catState.timer = 1.8;
    }
  }

  if (catState.mode === 'wander' || catState.mode === 'follow' || catState.mode === 'play') {
    const delta = new THREE.Vector3(
      catState.target.x - catGroup.position.x,
      0,
      catState.target.z - catGroup.position.z
    );
    const d = delta.length();
    if (d > 0.45) {
      delta.normalize();
      const catSpeed = catState.mode === 'follow' ? 3.0 : 1.35;
      catGroup.position.addScaledVector(delta, dt * catSpeed);
      catGroup.rotation.y = Math.atan2(delta.x, delta.z);
      catState.step += dt * 9;
      catLegs.forEach((l, i) => {
        l.rotation.x = Math.sin(catState.step + (i % 2) * Math.PI + (i > 1 ? Math.PI : 0)) * 0.45;
      });
    } else if (catState.mode === 'wander') {
      catState.mode = 'idle';
      catState.timer = 2.0;
    }
  }

  // Ground Cat on terrain
  catGroup.position.y = getTerrainHeight(catGroup.position.x, catGroup.position.z);

  // Expressive Cat Animations
  const purr = catState.mode === 'purr' ? Math.sin(t * 24) * 0.07 : 0;
  catBody.scale.y = 0.74 + purr;
  catHead.position.y = 0.94 + Math.sin(t * 3) * 0.025 + (catState.mode === 'snack' ? 0.14 * Math.sin(t * 10) : 0);
  catTail.rotation.x = Math.sin(t * 2.8) * 0.28;
  catTail.rotation.z = Math.sin(t * 2.2) * 0.16;

  if (catState.mode === 'play') {
    catGroup.position.x += Math.sin(t * 8) * dt * 0.7;
    catGroup.position.z += Math.cos(t * 8) * dt * 0.7;
    catGroup.rotation.y = t * 2.2;
  }
}

// ---------------------------------------------------------------------------
// Ambient Particles, Chimney Smoke & Flora Animation
// ---------------------------------------------------------------------------
function updateAmbient(dt, t) {
  // Star bobbing & rotation
  for (const s of starObjects) {
    if (s.holder.visible) {
      s.holder.position.y = s.baseY + Math.sin(t * 2.2 + s.phase) * 0.22;
      s.gem.rotation.y += dt * 1.1;
      s.gem.rotation.z = Math.sin(t * 1.8 + s.phase) * 0.14;
      const d = Math.hypot(state.playerPos.x - s.holder.position.x, state.playerPos.z - s.holder.position.z);
      if (d < 1.7) interact(s.holder);
    }
  }

  // Floating animated elements (notes, lanterns, hearts, constellation)
  for (const item of animated) {
    if (item.kind === 'float') {
      item.mesh.position.y += Math.sin(t * 2.2 + item.phase) * 0.0035;
    } else if (item.kind === 'orbit') {
      const a = t * 0.55 + item.phase;
      item.mesh.position.set(
        item.center[0] + Math.cos(a) * 4.2,
        item.center[1] + Math.sin(t * 2.2 + a) * 0.18,
        item.center[2] + Math.sin(a) * 4.2
      );
    } else if (item.kind === 'sway') {
      item.mesh.rotation.z = Math.sin(t * 2.0 + item.phase) * 0.22;
    } else if (item.kind === 'burst') {
      item.life -= dt;
      item.mesh.position.y += dt * 1.6;
      if (item.mesh.material.opacity !== undefined) {
        item.mesh.material.opacity = Math.max(0, item.life / 3.2);
      }
      if (item.life <= 0) {
        scene.remove(item.mesh);
        item.dead = true;
      }
    }
  }
  for (let i = animated.length - 1; i >= 0; i--) {
    if (animated[i].dead) animated.splice(i, 1);
  }

  // Flower petals gentle breathing sway
  for (const p of petals) {
    p.mesh.position.y = p.baseY + Math.sin(t * 2.3 + p.phase) * 0.025;
  }
}

// ---------------------------------------------------------------------------
// Main Game Loop
// ---------------------------------------------------------------------------
let lastTime = performance.now();
let elapsed = 0;
let saveTimer = 0;

function renderFrame(now) {
  requestAnimationFrame(renderFrame);
  const dt = Math.min(0.045, (now - lastTime) / 1000);
  lastTime = now;
  elapsed += dt;

  updatePlayer(dt, elapsed);
  updateCat(dt, elapsed);
  updateAmbient(dt, elapsed);
  updateCamera(dt);
  updateInteractUI();

  // Periodic autosave
  saveTimer += dt;
  if (saveTimer > 5) {
    saveTimer = 0;
    persist();
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(renderFrame);

// Dismiss loading screen
setTimeout(() => ui.loading.classList.add('done'), 500);

if (innerWidth <= 700) document.body.classList.add('mobile');
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  document.body.classList.toggle('mobile', innerWidth <= 700);
});
