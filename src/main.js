import * as THREE from 'three';
import { messages } from './messages.js';
import './style.css';
import './mute.css';

const $ = (id) => document.getElementById(id);
const ui = {
  game: $('game'), loading: $('loadingScreen'), welcome: $('welcomeCard'), begin: $('beginButton'),
  stars: $('starCount'), region: $('regionName'), regionNote: $('regionNote'), quest: $('questText'),
  questKicker: $('questKicker'), questIcon: $('questIcon'), interact: $('interactButton'), interactLabel: $('interactLabel'),
  interactIcon: $('interactIcon'), toast: $('toast'), modal: $('modal'), modalTitle: $('modalTitle'),
  modalBody: $('modalBody'), modalEyebrow: $('modalEyebrow'), modalContinue: $('modalContinue'),
  closeModal: $('closeModal'), help: $('helpButton'), sound: $('soundButton'), soundPanel: $('soundPanel'),
  volume: $('volumeSlider'), volumeValue: $('volumeValue'), joystick: $('joystick'), joyKnob: $('joyKnob'),
  touchAction: $('touchAction'), interactButton: $('interactButton'), mute: $('muteToggle')
};

const saveKey = 'joos-little-universe-save-v1';
const saved = (() => { try { return JSON.parse(localStorage.getItem(saveKey) || '{}'); } catch { return {}; } })();
const state = {
  started: false, stars: new Set(saved.stars || []), notes: new Set(saved.notes || []),
  catBond: Math.max(0, Number(saved.catBond) || 0), finale: Boolean(saved.finale),
  player: new THREE.Vector3(saved.x || 0, 0, saved.z || 2), heading: Math.PI,
  active: null, selected: null, toastTimer: 0, modalOpen: false
};

const scene = new THREE.Scene();
scene.background = new THREE.Color('#b9dfe5');
scene.fog = new THREE.FogExp2('#c7e5dc', 0.0083);
const camera = new THREE.PerspectiveCamera(47, innerWidth / innerHeight, 0.1, 220);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
ui.game.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#e8fbff', '#776747', 2.2));
const sun = new THREE.DirectionalLight('#fff1d0', 3.0);
sun.position.set(-35, 58, 30); sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -82; sun.shadow.camera.right = 82; sun.shadow.camera.top = 82; sun.shadow.camera.bottom = -82;
sun.shadow.bias = -0.0004; scene.add(sun);

const mat = (color, roughness = 0.92, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const mats = {
  grass: mat('#86b877'), meadow: mat('#a9c87c'), path: mat('#dfc99a'), water: mat('#78bfcb', .34, { transparent: true, opacity: .8 }),
  trunk: mat('#8b634c'), leafA: mat('#76a86e'), leafB: mat('#91bd79'), leafC: mat('#658e65'), stone: mat('#d4c9a5'), cream: mat('#fff0d2'),
  roofRose: mat('#d98772'), roofBlue: mat('#7698a1'), roofGold: mat('#daa95e'), plaster: mat('#f5d9ae'), plasterMint: mat('#c6d9b2'), plasterPink: mat('#efc3a9'),
  wood: mat('#9b6949'), metal: mat('#d1ac66', .38, { metalness: .15 }), flower1: mat('#f3b3a8'), flower2: mat('#f8d887'), flower3: mat('#d2b7df'),
  dark: mat('#4d574b'), cat: mat('#e6b66f'), catLight: mat('#f3dcae'), character: mat('#f4e8ce'), coat: mat('#d7775d'), pants: mat('#667d79'), skin: mat('#dca982'),
  star: new THREE.MeshStandardMaterial({ color: '#ffe28c', emissive: '#f5b83e', emissiveIntensity: 1.6, roughness: .34 }), glow: new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: .2, side: THREE.DoubleSide })
};
const world = new THREE.Group(); scene.add(world);
const interactables = [], starObjects = [], animated = [], petals = [];
const tmp = new THREE.Vector3();

function addMesh(geometry, material, parent = world, position = [0,0,0], cast = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function box(w,h,d,m,parent=world,pos=[0,0,0]) { return addMesh(new THREE.BoxGeometry(w,h,d),m,parent,pos); }
function sphere(r,m,parent=world,pos=[0,0,0],scale=[1,1,1],detail=1) { const o=addMesh(new THREE.IcosahedronGeometry(r,detail),m,parent,pos); o.scale.set(...scale); return o; }
function cylinder(rt,rb,h,m,parent=world,pos=[0,0,0],segments=12) { return addMesh(new THREE.CylinderGeometry(rt,rb,h,segments),m,parent,pos); }
function disk(x,z,r,color,y=.07) { const m=addMesh(new THREE.CircleGeometry(r,48),color);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;return m; }

// Floating, softly sculpted island and a calm ring of water beneath its grassy edge.
const terrainGeo = new THREE.PlaneGeometry(150, 150, 100, 100); terrainGeo.rotateX(-Math.PI/2);
const pos = terrainGeo.attributes.position;
for(let i=0;i<pos.count;i++){
  const x=pos.getX(i), z=pos.getZ(i), r=Math.hypot(x,z);
  const edge=Math.max(0,Math.min(1,(r-48)/24));
  const hills=Math.sin(x*.14+Math.cos(z*.11))*Math.cos(z*.13)*.38 + Math.sin(z*.2+x*.07)*.15;
  pos.setY(i, .25 + hills + edge*edge*2.1);
}
terrainGeo.computeVertexNormals();
const terrain=addMesh(terrainGeo,mats.grass,world,[0,0,0],false); terrain.receiveShadow=true;
const shore=addMesh(new THREE.CylinderGeometry(65,60,3.5,96,1,true),mat('#789b72'),world,[0,-1.15,0],false); shore.castShadow=false;
const islandFoot=addMesh(new THREE.CylinderGeometry(60,49,4.5,96,1,true),mat('#cfae80'),world,[0,-3.9,0],false); islandFoot.castShadow=false;
const sea=addMesh(new THREE.CircleGeometry(92,96),mats.water,world,[0,-1.15,0],false);sea.rotation.x=-Math.PI/2;sea.position.y=-1.42;
// sky wisps
for(let i=0;i<22;i++){
  const a=i*2.399, r=78+(i%5)*7;
  const cloud=new THREE.Group();cloud.position.set(Math.cos(a)*r,20+(i%4)*4,Math.sin(a)*r);scene.add(cloud);
  for(let j=0;j<4;j++) sphere(2.1,mat('#ffffff',1,{transparent:true,opacity:.28}),cloud,[j*2.6,Math.sin(j)*.55,0],[1.7,.42,1],1);
}

// Soft winding paths join the café, garden and castle without loading another scene.
function makePath(points,width=2.1){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],.26,p[1])));
  const steps=120,vertices=[],uvs=[],indices=[];
  for(let i=0;i<=steps;i++){
    const t=i/steps,p=curve.getPointAt(t),tangent=curve.getTangentAt(t),side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize().multiplyScalar(width/2);
    vertices.push(p.x+side.x,.22,p.z+side.z,p.x-side.x,.22,p.z-side.z);uvs.push(0,t,1,t);
    if(i<steps){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,c,b,b,c,d);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const path=addMesh(geometry,mat('#dfc99a'),world,[0,0,0],false);path.material.side=THREE.DoubleSide;path.receiveShadow=true;
}
makePath([[0,2],[-8,-7],[-21,-13],[-30,-20]],2.5);
makePath([[0,2],[11,-5],[22,-14],[30,-21]],2.5);
makePath([[0,2],[2,15],[4,29],[3,43]],2.7);
makePath([[-18,-13],[-8,-22],[8,-25],[20,-19]],1.65);

// Region clearings.
disk(-29,-20,16,mat('#a8bf78'),.22); disk(29,-19,16,mat('#a0bd7e'),.22); disk(3,42,17,mat('#9ebd81'),.24);

function tree(x,z,scale=1,variant=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);world.add(g);
  cylinder(.23,.38,2.2,mats.trunk,g,[0,1,0],9);
  const leafs=[mats.leafA,mats.leafB,mats.leafC];
  sphere(1.18,leafs[variant%3],g,[0,2.4,0],[1,1.08,.95],1);
  sphere(.82,leafs[(variant+1)%3],g,[-.59,2.6,-.1],[.9,.87,.85],1);
  sphere(.8,leafs[(variant+2)%3],g,[.57,2.65,.1],[.9,.88,.9],1);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;}); return g;
}
function flowerPatch(cx,cz,count=45,spread=7){
  const colors=[mats.flower1,mats.flower2,mats.flower3];
  for(let i=0;i<count;i++){
    const a=i*2.399, r=spread*Math.sqrt((i+.5)/count), x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
    const stem=cylinder(.018,.026,.3,mat('#6e9a62'),world,[x,.35,z],5);
    const bloom=sphere(.12,colors[i%3],world,[x,.55,z],[1,.8,1],1); bloom.userData.phase=a;
    petals.push({mesh:bloom,phase:a});
  }
}
function house(x,z,opts={}){
  const g=new THREE.Group();g.position.set(x,0,z);world.add(g);
  const width=opts.width||5, height=opts.height||3.3;
  const body=box(width,height,width*.78,opts.wall||mats.plaster,g,[0,height/2,.1]);
  const roof=addMesh(new THREE.ConeGeometry(width*.86,2.5,4),opts.roof||mats.roofRose,g,[0,height+1.2,.1]);roof.rotation.y=Math.PI/4;
  box(1.05,2,.12,mats.wood,g,[0,1,width*.31]);
  const windowMat=mat('#8fc3c1',.3,{emissive:'#397478',emissiveIntensity:.18});
  for(const sx of [-1,1]){box(.77,.95,.09,windowMat,g,[sx*1.28,2,width*.306]);box(.92,.1,.12,mats.cream,g,[sx*1.28,2,width*.29]);box(.1,1.02,.12,mats.cream,g,[sx*1.28,2,width*.29]);}
  if(opts.cafe){
    // Striped awning facing out from the cottage.
    const awn=box(5.7,.18,1.55,mat('#f2d9b8'),g,[0,2.65,2.2]);awn.rotation.x=.12;
    for(let i=-2;i<=2;i++)box(.54,.2,1.58,i%2?mat('#e68b70'):mat('#f8e4bd'),g,[i*1.02,2.63,2.2]);
    box(5.5,.22,.35,mats.wood,g,[0,1.54,2.55]);
  }
  return g;
}
function bench(x,z,rot=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;world.add(g);
  box(2,.19,.72,mats.wood,g,[0,.8,0]);box(2,.78,.17,mats.wood,g,[0,1.18,.29]);
  for(const x2 of [-.78,.78]){box(.16,.76,.16,mats.wood,g,[x2,.4,-.18]);box(.16,.76,.16,mats.wood,g,[x2,.4,.18]);}
  return g;
}

// Café quarter
house(-31,-22,{wall:mats.plaster,roof:mats.roofRose,cafe:true,width:5.4});
house(-39,-15,{wall:mats.plasterMint,roof:mats.roofGold,width:4.2,height:2.8});
bench(-24,-15,.5); bench(-37,-29,-.5);
const cafeSign=box(2,.72,.12,mats.wood,world,[-31,4.05,-18.6]);
// Hanging little bunting flags
for(let i=0;i<7;i++){
  const flag=addMesh(new THREE.ConeGeometry(.3,.46,3),i%2?mats.roofGold:mats.flower1,world,[-36+i*1.5,4.65,-19]);flag.rotation.z=Math.PI;
}

// Garden, pond and a whimsical wishing tree.
flowerPatch(31,-19,86,12);
const pond=addMesh(new THREE.CylinderGeometry(4.8,4.8,.35,48),mat('#7bbfc3',.28),world,[29,.4,-19]);
const pondInner=addMesh(new THREE.CircleGeometry(4.2,48),mat('#7fced0',.22,{transparent:true,opacity:.83}),world,[29,.59,-19],false);pondInner.rotation.x=-Math.PI/2;
cylinder(.28,.4,1.35,mats.stone,world,[29,1.1,-19],12);
const fountainTop=sphere(.55,mats.stone,world,[29,1.9,-19],[1,.6,1],1);
for(let i=0;i<4;i++){const stream=cylinder(.025,.045,1,mat('#b6e5df',.25,{transparent:true,opacity:.7}),world,[29+Math.cos(i*Math.PI/2)*.8,1.35,-19+Math.sin(i*Math.PI/2)*.8],6);stream.rotation.z=Math.cos(i*Math.PI/2)*.38;stream.rotation.x=Math.sin(i*Math.PI/2)*.38;}
const wishing=tree(39,-24,1.8,1);
for(let i=0;i<15;i++){
  const a=i*2.4, rr=1.3+(i%3)*.4;
  const ribbon=box(.08,.95,.08,mat(i%2?'#f1b99d':'#eee0ab'),wishing,[Math.cos(a)*rr,2.2+(i%5)*.35,Math.sin(a)*rr]);ribbon.rotation.z=Math.sin(a)*.4;
}
house(38,-11,{wall:mats.plasterPink,roof:mats.roofBlue,width:4.6,height:3});

// Castle garden
const castle=new THREE.Group();castle.position.set(3,0,43);world.add(castle);
box(13,7,8,mat('#eee0c4'),castle,[0,3.5,0]);
box(16,1.1,10,mat('#d8c6a5'),castle,[0,7.5,0]);
for(const x of [-7.8,7.8]) for(const z of [-4.5,4.5]){
  cylinder(1.25,1.5,10,mat('#f3e4c7'),castle,[x,5,z],10);
  const turret=addMesh(new THREE.ConeGeometry(1.8,3.6,8),x<0?mats.roofRose:mats.roofBlue,castle,[x,11.1,z]);
  sphere(.16,mats.metal,castle,[x,13,z],[1,1.4,1],1);
}
const keepRoof=addMesh(new THREE.ConeGeometry(7.5,5,4),mats.roofRose,castle,[0,10.5,0]);keepRoof.rotation.y=Math.PI/4;
box(2,3.3,.18,mats.wood,castle,[0,1.7,-4.12]);
for(let i=0;i<5;i++){const pennant=addMesh(new THREE.ConeGeometry(.35,1.2,3),mats.roofGold,castle,[-4+i*2,9,-4.5]);pennant.rotation.z=Math.PI;}
// heart-shaped finale pedestal and glowing rose
const heartBase=cylinder(2.3,2.7,.6,mats.stone,castle,[0,.55,-9.2],12);
const heartObj=new THREE.Group();heartObj.position.set(0,2.1,-9.2);castle.add(heartObj);
const heart1=sphere(.56,mat('#e9918c',.35,{emissive:'#a83655',emissiveIntensity:.6}),heartObj,[-.35,.08,0],[1,.95,.56],2);
const heart2=sphere(.56,mat('#e9918c',.35,{emissive:'#a83655',emissiveIntensity:.6}),heartObj,[.35,.08,0],[1,.95,.56],2);
const heartPoint=addMesh(new THREE.ConeGeometry(.62,1.08,4),mat('#e9918c',.35,{emissive:'#a83655',emissiveIntensity:.6}),heartObj,[0,-.42,0]);heartPoint.rotation.y=Math.PI/4;heartPoint.rotation.x=Math.PI;
animated.push({mesh:heartObj,kind:'float',phase:1});
for(let i=0;i<10;i++){const a=i*Math.PI*2/10, f=sphere(.11,mats.star,castle,[Math.cos(a)*3.7,1.35,-9.2+Math.sin(a)*3.7],[1,1,1],1);animated.push({mesh:f,kind:'orbit',phase:a,center:[0,1.35,-9.2]});}

// Scatter trees with clearing-aware distribution.
let treeSeed=19671;
function random(){treeSeed=(treeSeed*1664525+1013904223)>>>0;return treeSeed/4294967296;}
for(let i=0;i<56;i++){
  const a=random()*Math.PI*2, r=24+random()*28, x=Math.cos(a)*r,z=Math.sin(a)*r;
  const cafeClear=Math.hypot(x+31,z+21)<13, gardenClear=Math.hypot(x-30,z+19)<13, castleClear=Math.hypot(x-3,z-42)<13;
  if(!cafeClear&&!gardenClear&&!castleClear)tree(x,z,.78+random()*.54,i%3);
}
flowerPatch(-5,22,28,6); flowerPatch(14,5,22,5);
// stepping stones and smooth little boulders
for(let i=0;i<17;i++){
  const a=i*.72,r=21+(i%4)*3;
  const rock=sphere(.75,mats.stone,world,[Math.cos(a)*r,.24,Math.sin(a)*r],[1,.5,.8],1);rock.rotation.y=a;
}

// Collectible stars glow and bob. Their ids persist across visits.
const starSpots=[[-41,-25],[-23,-27],[-36,-9],[-20,-18],[23,-27],[38,-20],[31,-9],[42,-15],[-9,42],[15,42],[3,55],[3,30]];
starSpots.forEach(([x,z],i)=>{
  const holder=new THREE.Group();holder.position.set(x,1.6,z);world.add(holder);
  const gem=addMesh(new THREE.OctahedronGeometry(.48,0),mats.star,holder,[0,0,0]);
  const ring=addMesh(new THREE.TorusGeometry(.72,.035,6,24),mats.glow,holder,[0,0,0],false);ring.rotation.x=Math.PI/2;
  const halo=addMesh(new THREE.CircleGeometry(.94,24),mats.glow,holder,[0,-.55,0],false);halo.rotation.x=-Math.PI/2;
  holder.userData.type='star'; holder.userData.id=`star-${i}`; holder.userData.label='A little star';
  interactables.push(holder);starObjects.push({holder,gem,id:`star-${i}`,phase:i*.81});
  if(state.stars.has(`star-${i}`))holder.visible=false;
});

// Hidden notes appear as delicate little golden fireflies above their keepsakes.
function makeLantern(x,z){
  const g=new THREE.Group();g.position.set(x,0,z);world.add(g);
  cylinder(.32,.42,.8,mats.metal,g,[0,1.1,0],8);sphere(.2,mats.glow,g,[0,1.1,0],[1,1.5,1],1);
  const top=addMesh(new THREE.ConeGeometry(.47,.4,8),mats.metal,g,[0,1.72,0]);top.rotation.y=.2;
  const orb=sphere(.17,mats.star,g,[0,2.25,0],[1,1,1],1);animated.push({mesh:orb,kind:'float',phase:x});
  g.userData.type='note';g.userData.id=`note-${interactables.filter(o=>o.userData.type==='note').length}`;g.userData.noteIndex=interactables.filter(o=>o.userData.type==='note').length;
  g.userData.label='A hidden note';interactables.push(g);return g;
}
makeLantern(-19,-11);makeLantern(20,-10);makeLantern(-2,32);

// Café table and picnic treats are interactive, readable world cues.
const table=new THREE.Group();table.position.set(-25,0,-11);world.add(table);
cylinder(.85,.85,.2,mats.wood,table,[0,1.2,0],12);cylinder(.13,.16,1.2,mats.wood,table,[0,.6,0],8);
for(let i=0;i<3;i++){const pastry=sphere(.27,mat('#cf9d65'),table,[-.42+i*.42,1.48,0],[1,.5,.8],1);sphere(.06,mats.cream,table,[-.42+i*.42,1.65,0],[1,.5,1],1);}
const snack=new THREE.Group();snack.position.copy(table.position);snack.userData.type='snack';snack.userData.label='A little treat';interactables.push(snack);world.add(snack);

// Basket of yarn in the garden.
const yarn=new THREE.Group();yarn.position.set(22,0,-10);world.add(yarn);
cylinder(.6,.7,.48,mats.wood,yarn,[0,.35,0],10);
for(let i=0;i<4;i++){const ball=sphere(.34,[mat('#d98c79'),mat('#c6a6cf'),mat('#e2bd70'),mat('#91b8ad')][i],yarn,[-.38+i*.25,.85,0],[1,1,1],2);ball.userData.wiggle=i;}
yarn.userData.type='yarn';yarn.userData.label='Play with the yarn';interactables.push(yarn);

// A small expressive explorer, assembled entirely from light procedural geometry.
const player=new THREE.Group();scene.add(player);
const avatar=new THREE.Group();player.add(avatar);
const torso=addMesh(new THREE.CapsuleGeometry(.43,.9,5,9),mats.coat,avatar,[0,1.22,0]);
const head=sphere(.43,mats.skin,avatar,[0,2.1,.03],[.91,1.05,.88],2);
const hair=sphere(.43,mat('#493d35'),avatar,[0,2.37,-.05],[1.02,.7,.98],2);
for(const s of [-1,1])sphere(.27,mat('#493d35'),avatar,[s*.29,2.15,.08],[.65,.78,.65],1);
const scarf=box(.76,.17,.56,mat('#f0d99d'),avatar,[0,1.82,.25]);scarf.rotation.x=-.16;
const eyes=[];for(const s of [-1,1]){const eye=sphere(.045,mat('#493a32'),avatar,[s*.14,2.13,.399],[1,1,1],1);eyes.push(eye);}
for(const s of [-1,1]) sphere(.055,mat('#d77c6f'),avatar,[s*.27,2.02,.36],[1,.55,.5],1);
const legs=[];for(const s of [-1,1]){const leg=addMesh(new THREE.CapsuleGeometry(.15,.49,4,7),mats.pants,avatar,[s*.2,.39,0]);legs.push(leg);sphere(.19,mats.wood,avatar,[s*.2,.12,.1],[1,.55,1.35],1);}
const armL=addMesh(new THREE.CapsuleGeometry(.14,.48,4,7),mats.coat,avatar,[-.52,1.22,0]);
const armR=addMesh(new THREE.CapsuleGeometry(.14,.48,4,7),mats.coat,avatar,[.52,1.22,0]);
avatar.position.y=0;

// Cat has independent idle, stroll, pet, snack, and yarn-play animation.
const cat=new THREE.Group();scene.add(cat);
const catBody=sphere(.52,mats.cat,cat,[0,.55,0],[1.25,.72,.82],2);
const catHead=sphere(.43,mats.cat,cat,[0,.91,.57],[1,.94,.86],2);
const earMat=mats.cat;const ears=[];
for(const s of [-1,1]){const e=addMesh(new THREE.ConeGeometry(.2,.48,4),earMat,cat,[s*.27,1.27,.58]);e.rotation.z=s*-.18;ears.push(e);sphere(.13,mat('#e99188'),cat,[s*.27,1.28,.64],[.67,.85,.43],1);sphere(.035,mats.dark,cat,[s*.15,.98,.93],[1,1,1],1);sphere(.035,mats.dark,cat,[s*.35,.98,.93],[1,1,1],1);}
for(const s of [-1,1])sphere(.13,mats.catLight,cat,[s*.15,.76,.89],[1,.7,.5],1);
const nose=sphere(.06,mat('#c77c78'),cat,[0,.82,.98],[1,.75,.8],1);
const tail=new THREE.Group();tail.position.set(0,.64,-.48);cat.add(tail);
for(let i=0;i<6;i++){const bit=sphere(.17,mats.cat,tail,[Math.sin(i*.55)*.17,.15+i*.15,-i*.085],[.83,1.3,.82],1);if(i===5)bit.scale.set(.72,1,.75);}
const catLegs=[];for(const x of [-.32,.32])for(const z of [-.25,.34]){const leg=addMesh(new THREE.CapsuleGeometry(.1,.34,3,6),mats.cat,cat,[x,.24,z]);catLegs.push(leg);}
cat.position.set(-24,0,-12);
const catState={mode:'idle',timer:0,step:0,base:new THREE.Vector3(-24,0,-12),target:new THREE.Vector3(-24,0,-12)};
// Collisions keep the little explorer on the island and make the castle/cottages feel solid.
const solids=[{x:-31,z:-22,r:4.9},{x:-39,z:-15,r:3.5},{x:38,z:-11,r:4},{x:3,z:43,r:10.8},{x:29,z:-19,r:3.8}];

const regions=[
  {name:'Mosslight Meadow',note:'THE WORLD IS YOURS TO WANDER',x:0,z:0,r:21},
  {name:'The Little Cup Café',note:'WARM TEA · WARMER COMPANY',x:-31,z:-22,r:20},
  {name:'Wishing Garden',note:'A QUIET PLACE FOR BRIGHT THOUGHTS',x:30,z:-19,r:20},
  {name:'The Starlit Castle',note:'SOME SECRETS WAIT AT THE TOP',x:3,z:43,r:23}
];

// Camera is orbitable around the player; movement follows the view direction.
let cameraYaw=0, cameraPitch=.37, cameraDistance=13, drag=null;
const moveKeys=new Set();let joystickVector=new THREE.Vector2();
function updateCamera(dt){
  const target=new THREE.Vector3(state.player.x,1.35,state.player.z);
  const cp=Math.cos(cameraPitch), sp=Math.sin(cameraPitch);
  const desired=new THREE.Vector3(Math.sin(cameraYaw)*cp*cameraDistance,sp*cameraDistance,Math.cos(cameraYaw)*cp*cameraDistance).add(target);
  camera.position.lerp(desired,1-Math.exp(-dt*6));camera.lookAt(target);
}
function distance2(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
function persist(){try{localStorage.setItem(saveKey,JSON.stringify({stars:[...state.stars],notes:[...state.notes],catBond:state.catBond,finale:state.finale,x:state.player.x,z:state.player.z}));}catch{}}
function showToast(message){ui.toast.textContent=message;ui.toast.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2300);}
function openModal({eyebrow='A NOTE FOR YOU',title,body,button='Keep wandering'}){ui.modalEyebrow.textContent=eyebrow;ui.modalTitle.textContent=title;ui.modalBody.textContent=body;ui.modalContinue.innerHTML=`${button} <span>→</span>`;ui.modal.hidden=false;state.modalOpen=true;}
function closeModal(){ui.modal.hidden=true;state.modalOpen=false;}
ui.closeModal.addEventListener('click',closeModal);ui.modalContinue.addEventListener('click',closeModal);
ui.modal.addEventListener('click',e=>{if(e.target===ui.modal)closeModal();});
function refreshQuest(){
  ui.stars.textContent=state.stars.size;
  if(state.finale){ui.questKicker.textContent='A MOMENT TO KEEP';ui.quest.textContent='Your little universe is complete';ui.questIcon.textContent='♡';return;}
  if(state.stars.size<12){ui.questKicker.textContent='A LITTLE ADVENTURE';ui.quest.textContent=`Find the golden glimmers · ${state.stars.size}/12`;ui.questIcon.textContent='✦';}
  else if(state.catBond<3){ui.questKicker.textContent='ONE MORE THING';ui.quest.textContent=`Make a friend in the garden · ${state.catBond}/3`;ui.questIcon.textContent='♡';}
  else{ui.questKicker.textContent='THE LAST LITTLE SECRET';ui.quest.textContent='Visit the castle heart';ui.questIcon.textContent='⌂';}
}
refreshQuest();

let audioCtx=null,masterGain=null,musicGain=null,musicTimer=null,volume=Number(localStorage.getItem('joos-volume')||70)/100,muted=localStorage.getItem('joos-muted')==='true';
ui.volume.value=String(Math.round(volume*100));ui.volumeValue.textContent=`${Math.round(volume*100)}%`;ui.sound.textContent=muted?'◌':'♫';
function startAudio(){
  if(!audioCtx){
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();masterGain=audioCtx.createGain();musicGain=audioCtx.createGain();
    masterGain.gain.value=muted?0:volume;musicGain.gain.value=.28;musicGain.connect(masterGain);masterGain.connect(audioCtx.destination);
    const notes=[261.63,329.63,392,329.63,293.66,349.23,440,349.23];let n=0;
    musicTimer=setInterval(()=>{
      if(!audioCtx||audioCtx.state!=='running')return;
      const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
      osc.type='sine';osc.frequency.value=notes[n++%notes.length];gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.055,now+.15);gain.gain.exponentialRampToValueAtTime(.0001,now+1.8);osc.connect(gain);gain.connect(musicGain);osc.start(now);osc.stop(now+1.85);
    },920);
  }
  if(audioCtx.state==='suspended')audioCtx.resume();
}
function sound(kind='sparkle'){
  if(!audioCtx)return;
  const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
  const config={sparkle:[880,.26,'sine'],pet:[560,.22,'triangle'],feed:[430,.2,'sine'],yarn:[720,.16,'triangle'],note:[660,.48,'sine'],finish:[523,.8,'sine']};
  const [freq,dur,type]=config[kind]||config.sparkle;osc.type=type;osc.frequency.setValueAtTime(freq,now);osc.frequency.exponentialRampToValueAtTime(freq*1.45,now+dur*.36);osc.frequency.exponentialRampToValueAtTime(freq*.72,now+dur);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='finish'?.18:.1,now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+dur);
  osc.connect(gain);gain.connect(masterGain);osc.start(now);osc.stop(now+dur+.02);
}
function setVolume(v){volume=v;localStorage.setItem('joos-volume',String(Math.round(v*100)));ui.volumeValue.textContent=`${Math.round(v*100)}%`;if(masterGain)masterGain.gain.setTargetAtTime(muted?0:v,audioCtx.currentTime,.08);}
ui.volume.addEventListener('input',()=>setVolume(Number(ui.volume.value)/100));
ui.sound.addEventListener('click',()=>{ui.soundPanel.hidden=!ui.soundPanel.hidden;});
ui.soundPanel.addEventListener('click',e=>e.stopPropagation());
function toggleMute(){muted=!muted;localStorage.setItem('joos-muted',String(muted));ui.sound.textContent=muted?'◌':'♫';ui.mute.textContent=muted?'Turn sounds back on':'Mute all sounds';if(masterGain)masterGain.gain.setTargetAtTime(muted?0:volume,audioCtx.currentTime,.08);}
ui.mute.addEventListener('click',toggleMute);
ui.mute.textContent=muted?'Turn sounds back on':'Mute all sounds';
ui.help.addEventListener('click',()=>openModal({eyebrow:'HOW TO WANDER',title:'Take your time.',body:'Explore with WASD or the arrow keys. On a phone, use the little thumbstick. Drag anywhere to look around. Walk close to something curious, then press E or tap the heart. The stars are yours to find; the rest will happen when it’s ready.',button:'Let’s go'}));
ui.begin.addEventListener('click',()=>{state.started=true;ui.welcome.classList.add('leaving');startAudio();showToast('Welcome, little wanderer ✦');});

function getNearestInteractable(){
  let best=null,bestD=Infinity;
  for(const object of interactables){if(!object.visible)continue;const p=new THREE.Vector3();object.getWorldPosition(p);const d=distance2(state.player,p);if(d<3.2&&d<bestD){best=object;bestD=d;}}
  return best;
}
function interact(object=state.active){
  if(!object||state.modalOpen)return;
  const type=object.userData.type;
  if(type==='star'){
    if(state.stars.has(object.userData.id))return;state.stars.add(object.userData.id);object.visible=false;persist();refreshQuest();sound('sparkle');
    showToast(['A little light for your pocket ✦','One more star found ✧','The sky feels closer already'][state.stars.size%3]);
    return;
  }
  if(type==='note'){
    const index=object.userData.noteIndex,id=object.userData.id; if(state.notes.has(id)){showToast('You’ve already tucked this one away ♡');return;}
    state.notes.add(id);persist();sound('note');const note=messages.notes[index%messages.notes.length];openModal({title:note.title,body:note.body});return;
  }
  if(type==='cat'){
    const n=state.catBond;
    if(n===0){state.catBond++;catState.mode='purr';catState.timer=2.6;sound('pet');openModal({eyebrow:'A NEW LITTLE FRIEND',title:'Oh, hello there.',body:'The tiny garden cat leans into your hand and gives the softest purr. Looks like you’ve made a friend.',button:'Say hello'});}
    else if(n===1){state.catBond++;catState.mode='snack';catState.timer=2.8;sound('feed');openModal({eyebrow:'A VERY GOOD TREAT',title:'The way to a heart…',body:'A little treat, a little trust, and a very happy tail. Your new friend decides you’re worth following.',button:'That’s sweet'});}
    else{state.catBond++;catState.mode='play';catState.timer=3.2;catState.target.copy(cat.position);sound('yarn');catState.follow=true;openModal({eyebrow:'BEST FRIENDS',title:'Your shadow, with whiskers.',body:'A tumble through the yarn, a happy little chirp, and now you have a companion for the rest of your adventure.',button:'Let’s go together'});}
    persist();refreshQuest();return;
  }
  if(type==='snack'){
    if(catState.mode==='snack'){showToast('Your friend already found the treats!');return;}
    catState.mode='snack';catState.timer=3;catState.target.set(-25,0,-11);sound('feed');showToast('A tiny picnic for two ♡');return;
  }
  if(type==='yarn'){
    catState.mode='play';catState.timer=3.6;catState.target.set(22,0,-10);sound('yarn');showToast('A very serious game of yarn');return;
  }
  if(type==='finale'){
    if(state.stars.size<12){showToast(`The castle heart is waiting for ${12-state.stars.size} more stars ✦`);return;}
    if(state.catBond<3){showToast('Your little friend should come along ♡');return;}
    if(state.finale){openModal({eyebrow:'YOUR FOREVER PLACE',title:messages.finale.title,body:messages.finale.body+'\n\n'+messages.finale.signOff,button:'Keep this close'});return;}
    state.finale=true;persist();refreshQuest();sound('finish');
    openModal({eyebrow:'A LITTLE ROMANTIC SURPRISE',title:messages.finale.title,body:messages.finale.body+'\n\n'+messages.finale.signOff,button:'Keep this close'});
    for(let i=0;i<40;i++)spawnSparkle();return;
  }
}
// An invisible, touchable interaction anchor lives beside the cat.
cat.userData.type='cat';cat.userData.label='Say hello to the cat';interactables.push(cat);
const finaleAnchor=new THREE.Group();finaleAnchor.position.set(3,0,31);finaleAnchor.userData.type='finale';finaleAnchor.userData.label='Open the castle surprise';interactables.push(finaleAnchor);world.add(finaleAnchor);

function spawnSparkle(){const a=random()*Math.PI*2,r=3+random()*4,softStar=mats.star.clone();softStar.transparent=true;const orb=sphere(.09,softStar,scene,[state.player.x+Math.cos(a)*r,1+random()*4,state.player.z+Math.sin(a)*r],[1,1,1],1);animated.push({mesh:orb,kind:'burst',phase:random()*10,life:3});}
function updateInteractUI(){
  const found=getNearestInteractable();state.active=found;
  if(!found){ui.interact.hidden=true;return;}
  let label=found.userData.label;
  if(found.userData.type==='cat')label=state.catBond===0?'Pet the cat':state.catBond===1?'Offer a little treat':'Play a little yarn';
  if(found.userData.type==='finale')label=state.stars.size<12?`Castle heart · ${state.stars.size}/12 stars`:state.catBond<3?'Bring your friend along':'Open the surprise';
  ui.interactLabel.textContent=label;ui.interactIcon.textContent=found.userData.type==='star'?'✦':found.userData.type==='finale'?'♡':'✧';ui.interact.hidden=false;
}
ui.interactButton.addEventListener('click',()=>interact());ui.touchAction.addEventListener('click',()=>interact());
window.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  moveKeys.add(e.key.toLowerCase());if(e.key.toLowerCase()==='e'||e.key==='Enter')interact();if(e.key==='Escape'){closeModal();ui.soundPanel.hidden=true;}
});
window.addEventListener('keyup',e=>moveKeys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>moveKeys.clear());

// Touch joystick works alongside taps on the interaction button.
let joyPointer=null;
ui.joystick.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;ui.joystick.setPointerCapture(e.pointerId);moveJoystick(e);});
ui.joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)moveJoystick(e);});
function moveJoystick(e){const r=ui.joystick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),max=35,len=Math.hypot(dx,dy),scale=len>max?max/len:1;joystickVector.set(dx*scale/max,-dy*scale/max);ui.joyKnob.style.left=`calc(50% + ${dx*scale}px)`;ui.joyKnob.style.top=`calc(50% + ${dy*scale}px)`;}
function clearJoystick(){joyPointer=null;joystickVector.set(0,0);ui.joyKnob.style.left='50%';ui.joyKnob.style.top='50%';}
ui.joystick.addEventListener('pointerup',clearJoystick);ui.joystick.addEventListener('pointercancel',clearJoystick);

// Drag to orbit; a short tap on a star will collect it if in reach.
const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2();let downAt=null;
renderer.domElement.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;downAt={x:e.clientX,y:e.clientY,id:e.pointerId};drag={x:e.clientX,y:e.clientY,id:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;cameraYaw-=dx*.006;cameraPitch=Math.max(.12,Math.min(.83,cameraPitch+dy*.004));drag.x=e.clientX;drag.y=e.clientY;});
renderer.domElement.addEventListener('pointerup',e=>{if(!downAt||downAt.id!==e.pointerId)return;const moved=Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y);if(moved<7){pointerNdc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);raycaster.setFromCamera(pointerNdc,camera);const visible=interactables.filter(o=>o.visible),hits=raycaster.intersectObjects(visible,true);if(hits.length){let obj=hits[0].object;while(obj&&!interactables.includes(obj))obj=obj.parent;if(obj){const p=new THREE.Vector3();obj.getWorldPosition(p);if(distance2(state.player,p)<7)interact(obj);else showToast('Wander a little closer first ✧');}}}drag=null;downAt=null;});
renderer.domElement.addEventListener('wheel',e=>{cameraDistance=Math.max(7,Math.min(22,cameraDistance+Math.sign(e.deltaY)*1.1));},{passive:true});

function tryMove(dx,dz){
  const nx=state.player.x+dx,nz=state.player.z+dz;
  if(Math.hypot(nx,nz)>56)return;
  let blocked=false;for(const s of solids)if(Math.hypot(nx-s.x,nz-s.z)<s.r){blocked=true;break;}
  if(!blocked){state.player.x=nx;state.player.z=nz;}
}
function updatePlayer(dt,t){
  let ix=0,iz=0;
  if(moveKeys.has('w')||moveKeys.has('arrowup'))iz+=1;if(moveKeys.has('s')||moveKeys.has('arrowdown'))iz-=1;
  if(moveKeys.has('a')||moveKeys.has('arrowleft'))ix-=1;if(moveKeys.has('d')||moveKeys.has('arrowright'))ix+=1;
  ix+=joystickVector.x;iz+=joystickVector.y;
  const len=Math.hypot(ix,iz),moving=len>.12;
  if(moving){ix/=Math.max(1,len);iz/=Math.max(1,len);const forward=new THREE.Vector3(-Math.sin(cameraYaw),0,-Math.cos(cameraYaw));const right=new THREE.Vector3(Math.cos(cameraYaw),0,-Math.sin(cameraYaw));const move=forward.multiplyScalar(iz).add(right.multiplyScalar(ix));tryMove(move.x*dt*7,move.z*dt*7);state.heading=Math.atan2(move.x,move.z);}
  player.position.set(state.player.x,Math.sin(t*8)*.035*(moving?1:0),state.player.z);avatar.rotation.y=THREE.MathUtils.damp(avatar.rotation.y,state.heading,10,dt);
  avatar.position.y=moving?Math.abs(Math.sin(t*10))*.07:Math.sin(t*2.3)*.025;
  legs[0].rotation.x=moving?Math.sin(t*10)*.7:0;legs[1].rotation.x=moving?Math.sin(t*10+Math.PI)*.7:0;
  armL.rotation.x=moving?Math.sin(t*10+Math.PI)*.45:Math.sin(t*2)*.04;armR.rotation.x=moving?Math.sin(t*10)*.45:Math.sin(t*2+1)*.04;
  const current=regions.find(r=>Math.hypot(state.player.x-r.x,state.player.z-r.z)<r.r)||regions[0];
  if(ui.region.textContent!==current.name){ui.region.textContent=current.name;ui.regionNote.textContent=current.note;}
}
function updateCat(dt,t){
  catState.timer=Math.max(0,catState.timer-dt);
  if(catState.mode==='idle'&&catState.timer===0){catState.timer=3+random()*5;catState.target.set(catState.base.x+(random()-.5)*4,0,catState.base.z+(random()-.5)*4);catState.mode='wander';}
  if(catState.mode==='wander'||catState.mode==='follow'||catState.mode==='play'){
    if(catState.mode==='follow'&&catState.follow&&distance2(cat.position,state.player)>4.3){catState.target.set(state.player.x,state.player.y,state.player.z);}
    const delta=new THREE.Vector3(catState.target.x-cat.position.x,0,catState.target.z-cat.position.z),d=delta.length();
    if(d>.42){delta.normalize();cat.position.addScaledVector(delta,dt*(catState.mode==='follow'?2.5:1));cat.rotation.y=Math.atan2(delta.x,delta.z);catState.step+=dt*9;catLegs.forEach((l,i)=>l.rotation.x=Math.sin(catState.step+(i%2)*Math.PI+(i>1?Math.PI:0))*.45);}
    else if(catState.mode==='wander'){catState.mode='idle';catState.timer=1.5;}
  }else if(catState.timer===0){catState.mode=catState.follow?'follow':'idle';catState.timer=catState.follow?0:2;}
  const purr=catState.mode==='purr'?Math.sin(t*22)*.06:0;catBody.scale.y=.72+purr;catHead.position.y=.91+Math.sin(t*3)*.025+(catState.mode==='snack'?.15*Math.sin(t*9):0);tail.rotation.x=Math.sin(t*3)*.25;tail.rotation.z=Math.sin(t*2.4)*.14;
  if(catState.mode==='play'){cat.position.x+=Math.sin(t*9)*dt*.65;cat.position.z+=Math.cos(t*9)*dt*.65;cat.rotation.y=t*2;}
  if(catState.mode==='snack'&&catState.timer>0){catHead.rotation.x=.3+Math.sin(t*13)*.14; }else catHead.rotation.x=Math.sin(t*2.1)*.04;
}
function updateStars(dt,t){
  for(const s of starObjects)if(s.holder.visible){s.holder.position.y=1.58+Math.sin(t*2+s.phase)*.2;s.gem.rotation.y+=dt*.9;s.gem.rotation.z=Math.sin(t*1.7+s.phase)*.12;const distance=distance2(state.player,s.holder.position);if(distance<1.65)interact(s.holder);}
  for(const item of animated){if(item.kind==='float'){item.mesh.position.y=2.25+Math.sin(t*2+item.phase)*.16;}else if(item.kind==='orbit'){const a=t*.6+item.phase;item.mesh.position.set(Math.cos(a)*3.7,1.35+Math.sin(t*2+a)*.15,-9.2+Math.sin(a)*3.7);}else if(item.kind==='burst'){item.life-=dt;item.mesh.position.y+=dt*1.5;item.mesh.material.opacity=Math.max(0,item.life/3);if(item.life<=0){scene.remove(item.mesh);item.dead=true;}}}
  for(let i=animated.length-1;i>=0;i--)if(animated[i].dead)animated.splice(i,1);
  petals.forEach(p=>p.mesh.position.y=.55+Math.sin(t*2.1+p.phase)*.035);
}
let last=performance.now(),elapsed=0,saveTick=0;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.045,(now-last)/1000);last=now;elapsed+=dt;
  updatePlayer(dt,elapsed);updateCat(dt,elapsed);updateStars(dt,elapsed);updateCamera(dt);updateInteractUI();
  saveTick+=dt;if(saveTick>5){saveTick=0;persist();}
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
setTimeout(()=>ui.loading.classList.add('done'),550);
if(innerWidth<=700)document.body.classList.add('mobile');
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));document.body.classList.toggle('mobile',innerWidth<=700);});
