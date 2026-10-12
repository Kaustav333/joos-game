import * as THREE from 'three';
import { messages } from './messages.js';
import './style.css';
import './mute.css';

/* ========================================================================
   UI REFERENCES & SAVED STATE
   ======================================================================== */
const $ = id => document.getElementById(id);
const ui = {
  game:$('game'),loading:$('loadingScreen'),welcome:$('welcomeCard'),begin:$('beginButton'),
  stars:$('starCount'),region:$('regionName'),regionNote:$('regionNote'),quest:$('questText'),
  questKicker:$('questKicker'),questIcon:$('questIcon'),interact:$('interactButton'),
  interactLabel:$('interactLabel'),interactIcon:$('interactIcon'),toast:$('toast'),
  modal:$('modal'),modalTitle:$('modalTitle'),modalBody:$('modalBody'),
  modalEyebrow:$('modalEyebrow'),modalContinue:$('modalContinue'),closeModal:$('closeModal'),
  help:$('helpButton'),sound:$('soundButton'),soundPanel:$('soundPanel'),
  volume:$('volumeSlider'),volumeValue:$('volumeValue'),joystick:$('joystick'),
  joyKnob:$('joyKnob'),touchAction:$('touchAction'),interactButton:$('interactButton'),
  mute:$('muteToggle')
};
const saveKey='joos-little-universe-save-v1';
const saved=(()=>{try{return JSON.parse(localStorage.getItem(saveKey)||'{}');}catch{return{};}})();
const state={
  started:false,stars:new Set(saved.stars||[]),notes:new Set(saved.notes||[]),
  catBond:Math.max(0,Number(saved.catBond)||0),finale:Boolean(saved.finale),
  pos:new THREE.Vector3(saved.x||0,0,saved.z||2),vel:new THREE.Vector3(),
  heading:Math.PI,active:null,toastTimer:0,modalOpen:false
};

/* ========================================================================
   SCENE, RENDERER & ANIME LIGHTING
   ======================================================================== */
const scene=new THREE.Scene();
scene.background=new THREE.Color('#c8e6f0');
scene.fog=new THREE.FogExp2('#d8ecdf',0.006);

const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,0.1,300);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.2;
ui.game.appendChild(renderer.domElement);

// Warm golden-hour anime lighting
scene.add(new THREE.HemisphereLight('#ffeedd','#665544',1.9));
const sun=new THREE.DirectionalLight('#ffeed8',3.6);
sun.position.set(-32,60,25);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-85;sun.shadow.camera.right=85;
sun.shadow.camera.top=85;sun.shadow.camera.bottom=-85;
sun.shadow.camera.near=8;sun.shadow.camera.far=180;
sun.shadow.bias=-0.0003;scene.add(sun);

// Warm back-fill light for rim glow
const backFill=new THREE.DirectionalLight('#ffd4a8',0.9);
backFill.position.set(35,20,-40);scene.add(backFill);

// Soft blue ambient for shadow areas
const coolFill=new THREE.DirectionalLight('#b8d4f0',0.55);
coolFill.position.set(-20,10,-25);scene.add(coolFill);

/* ========================================================================
   ANIME GRADIENT SKY DOME
   ======================================================================== */
const skyGeo=new THREE.SphereGeometry(200,32,24);
const skyMat=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,
  uniforms:{},
  vertexShader:`varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`
    varying vec3 vPos;
    void main(){
      float h=normalize(vPos).y;
      vec3 zenith=vec3(0.47,0.68,0.88);
      vec3 mid=vec3(0.72,0.82,0.92);
      vec3 horizon=vec3(1.0,0.85,0.72);
      vec3 sunset=vec3(0.98,0.7,0.55);
      vec3 col;
      if(h>0.3) col=mix(mid,zenith,smoothstep(0.3,0.85,h));
      else if(h>0.0) col=mix(horizon,mid,smoothstep(0.0,0.3,h));
      else col=mix(sunset,horizon,smoothstep(-0.15,0.0,h));
      // subtle warm sun glow
      float sunGlow=pow(max(0.,dot(normalize(vPos),normalize(vec3(-0.4,0.3,0.3)))),12.);
      col+=vec3(1.0,0.85,0.5)*sunGlow*0.35;
      gl_FragColor=vec4(col,1.);
    }`
});
scene.add(new THREE.Mesh(skyGeo,skyMat));

/* ========================================================================
   ANIME TOON MATERIAL SYSTEM (Cel-Shading)
   ======================================================================== */
const gradCanvas=document.createElement('canvas');
gradCanvas.width=5;gradCanvas.height=1;
const gCtx=gradCanvas.getContext('2d');
[55,110,165,215,255].forEach((v,i)=>{gCtx.fillStyle=`rgb(${v},${v},${v})`;gCtx.fillRect(i,0,1,1);});
const toonGradient=new THREE.CanvasTexture(gradCanvas);
toonGradient.magFilter=THREE.NearestFilter;
toonGradient.minFilter=THREE.NearestFilter;

// Softer gradient for terrain
const softCanvas=document.createElement('canvas');
softCanvas.width=8;softCanvas.height=1;
const sCtx=softCanvas.getContext('2d');
[50,85,120,150,180,210,235,255].forEach((v,i)=>{sCtx.fillStyle=`rgb(${v},${v},${v})`;sCtx.fillRect(i,0,1,1);});
const softGradient=new THREE.CanvasTexture(softCanvas);
softGradient.magFilter=THREE.NearestFilter;
softGradient.minFilter=THREE.NearestFilter;

const toon=(color,opts={})=>new THREE.MeshToonMaterial({color,gradientMap:toonGradient,...opts});
const toonSoft=(color,opts={})=>new THREE.MeshToonMaterial({color,gradientMap:softGradient,...opts});

// Glow materials (self-lit, not cel-shaded)
const glow=(color,opacity=0.3)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide});
const emissiveMat=(color,emColor,intensity=1.2)=>new THREE.MeshStandardMaterial({color,emissive:emColor,emissiveIntensity:intensity,roughness:0.3});

const M={
  // Terrain & Nature
  grass:toonSoft('#7fbc5e'),meadow:toonSoft('#9ecc6a'),darkGrass:toonSoft('#5a9944'),
  cliff:toon('#c4a67a'),cliffDark:toon('#a08860'),
  path:toon('#f0d9a3'),pathEdge:toon('#d4c19a'),
  water:new THREE.MeshStandardMaterial({color:'#5ec4d8',roughness:0.15,transparent:true,opacity:0.82,metalness:0.1}),
  waterFoam:new THREE.MeshBasicMaterial({color:'#d8f5f0',transparent:true,opacity:0.55}),

  // Trees
  trunk:toon('#6e4a30'),trunkLight:toon('#8a6042'),
  leafA:toon('#62a855'),leafB:toon('#82c468'),leafC:toon('#4a8e3f'),
  sakuraA:toon('#ffa8c0'),sakuraB:toon('#ffc8d8'),sakuraC:toon('#ff92b0'),
  pineA:toon('#3e7a3a'),pineB:toon('#4a8e42'),
  autumnA:toon('#e88a42'),autumnB:toon('#f0a855'),

  // Architecture
  plasterW:toon('#fff5e6'),plasterMint:toon('#d8edcc'),plasterRose:toon('#fce0d0'),
  plasterGold:toon('#f8ecc8'),
  woodDk:toon('#5a3822'),woodWarm:toon('#956340'),woodPlank:toon('#a07048'),
  stoneWall:toon('#e8ddc8'),stoneTrim:toon('#d0c4a8'),stoneDark:toon('#a09878'),
  roofCoral:toon('#e26850'),roofSage:toon('#5e8a7a'),roofGold:toon('#eca840'),roofRoyal:toon('#4a6da0'),
  awningR:toon('#e85545'),awningW:toon('#fff8e8'),
  glassWarm:emissiveMat('#ffe8a0','#ffa830',0.65),
  metalBrz:toon('#8a7040',{metalness:0.2}),goldGleam:toon('#f0c040',{metalness:0.25}),

  // Character
  skin:toon('#fad4b2'),hair:toon('#3a2e22'),coat:toon('#d85a42'),
  scarf:toon('#f5dd8a'),pants:toon('#4a6864'),boots:toon('#5a3828'),

  // Cat
  catO:toon('#e8aa58'),catW:toon('#fff5e8'),catPink:toon('#f09898'),dark:toon('#2e3028'),

  // Flowers
  flRose:toon('#f27888'),flYellow:toon('#f8d050'),flViolet:toon('#b88cd0'),
  flBlue:toon('#68b8e0'),flWhite:toon('#fff8f0'),

  // Magic & Collectibles
  star:emissiveMat('#ffe888','#f0b030',2.2),
  starGlow:glow('#ffe070',0.35),
  heartMat:emissiveMat('#f05878','#e82050',1.8),
};

const world=new THREE.Group();scene.add(world);
const interactables=[],starObjects=[],animated=[],floraAnim=[];
const cherryPetals=[],fireflies=[];

/* ========================================================================
   GEOMETRY HELPERS
   ======================================================================== */
function addMesh(geo,mat,parent=world,pos=[0,0,0],cast=true){
  const m=new THREE.Mesh(geo,mat);m.position.set(...pos);
  m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}
function box(w,h,d,m,p=world,pos=[0,0,0],c=true){return addMesh(new THREE.BoxGeometry(w,h,d),m,p,pos,c);}
function cyl(rt,rb,h,m,p=world,pos=[0,0,0],s=14,c=true){return addMesh(new THREE.CylinderGeometry(rt,rb,h,s),m,p,pos,c);}
function sph(r,m,p=world,pos=[0,0,0],sc=[1,1,1],d=1,c=true){const o=addMesh(new THREE.IcosahedronGeometry(r,d),m,p,pos,c);o.scale.set(...sc);return o;}
function cone(r,h,m,p=world,pos=[0,0,0],s=6){return addMesh(new THREE.ConeGeometry(r,h,s),m,p,pos);}

/* ========================================================================
   TERRAIN HEIGHT MAP & SCULPTED ISLAND
   ======================================================================== */
function getTerrainHeight(x,z){
  const r=Math.hypot(x,z);
  if(r>64)return -12;
  const edge=Math.max(0,Math.min(1,(r-42)/18));
  const castleDist=Math.hypot(x-2,z-44);
  const castleH=Math.max(0,1-castleDist/19)*3.6;
  const stairDist=Math.hypot(x-2,z-28);
  const stairH=Math.max(0,1-stairDist/11)*1.6;
  const cafeDist=Math.hypot(x+31,z+21);
  const cafeH=Math.max(0,1-cafeDist/16)*1.2;
  const gardenDist=Math.hypot(x-29,z+18);
  const gardenH=Math.max(0,1-gardenDist/18)*0.9;
  const pondDist=Math.hypot(x-28,z+18);
  const pondH=Math.max(0,1-pondDist/6.2)*-0.6;
  const rolling=Math.sin(x*0.11+Math.cos(z*0.08)*1.3)*0.45+Math.cos(z*0.12+Math.sin(x*0.07))*0.38+Math.sin((x-z)*0.06)*0.2;
  return 0.5+rolling+castleH+stairH+cafeH+gardenH+pondH-edge*edge*3.5;
}

// Sculpted island terrain with vertex coloring
const tGeo=new THREE.PlaneGeometry(160,160,120,120);tGeo.rotateX(-Math.PI/2);
const tPos=tGeo.attributes.position;
const tCol=new THREE.BufferAttribute(new Float32Array(tPos.count*3),3);
const cGrass=new THREE.Color('#7fbc5e'),cMeadow=new THREE.Color('#a5d070'),cPath=new THREE.Color('#edd9aa'),cCastle=new THREE.Color('#e2dac6'),cCliff=new THREE.Color('#b89a6e');

function pathWeight(x,z){
  const d1=segDist(x,z,0,2,-15,-9)+segDist(x,z,-15,-9,-31,-20);
  const d2=segDist(x,z,0,2,14,-7)+segDist(x,z,14,-7,29,-18);
  const d3=segDist(x,z,0,2,2,20)+segDist(x,z,2,20,2,40);
  const d4=segDist(x,z,-20,-14,0,-22)+segDist(x,z,0,-22,20,-13);
  return Math.max(0,1-Math.min(d1,d2,d3,d4)/2.8);
}
function segDist(px,pz,x1,z1,x2,z2){
  const dx=x2-x1,dz=z2-z1,l2=dx*dx+dz*dz;
  if(!l2)return Math.hypot(px-x1,pz-z1);
  const t=Math.max(0,Math.min(1,((px-x1)*dx+(pz-z1)*dz)/l2));
  return Math.hypot(px-(x1+t*dx),pz-(z1+t*dz));
}

for(let i=0;i<tPos.count;i++){
  const x=tPos.getX(i),z=tPos.getZ(i),r=Math.hypot(x,z);
  tPos.setY(i,getTerrainHeight(x,z));
  const pw=pathWeight(x,z);
  const cc=Math.hypot(x-2,z-44)<12&&getTerrainHeight(x,z)>2.8;
  let vc=cGrass.clone().lerp(cMeadow,Math.sin(x*0.18)*0.5+0.5);
  if(pw>0.1)vc.lerp(cPath,Math.min(1,pw*1.4));
  if(cc)vc.lerp(cCastle,0.8);
  if(r>48)vc.lerp(cCliff,Math.min(1,(r-48)/10));
  tCol.setXYZ(i,vc.r,vc.g,vc.b);
}
tGeo.setAttribute('color',tCol);tGeo.computeVertexNormals();
const terrainMat=new THREE.MeshToonMaterial({vertexColors:true,gradientMap:softGradient});
addMesh(tGeo,terrainMat,world,[0,0,0],false);

// Layered island cliffs
addMesh(new THREE.CylinderGeometry(62,55,5.2,80,2,true),M.cliff,world,[0,-2,0],false);
addMesh(new THREE.CylinderGeometry(55,36,8,80,2,true),M.cliffDark,world,[0,-7,0],false);
const bott=addMesh(new THREE.ConeGeometry(36,14,48),M.cliffDark,world,[0,-18,0],false);bott.rotation.x=Math.PI;

// Ocean
const seaMesh=addMesh(new THREE.CircleGeometry(120,80),M.water,world,[0,-1.2,0],false);seaMesh.rotation.x=-Math.PI/2;

// Puffy anime clouds
for(let i=0;i<28;i++){
  const a=i*2.399,r=90+(i%6)*9;
  const cg=new THREE.Group();cg.position.set(Math.cos(a)*r,22+(i%5)*5,Math.sin(a)*r);scene.add(cg);
  const cloudMat=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0.5});
  for(let j=0;j<6;j++)sph(2.8+Math.sin(j)*0.8,cloudMat,cg,[(j-2.5)*2.4,Math.sin(j*.7)*.5,(j%2)*.8],[1.8,.5,1.1],1,false);
}

/* ========================================================================
   STORYBOOK PATHS WITH COBBLESTONE BORDERS
   ======================================================================== */
function makePath(pts,w=2.4){
  const curve=new THREE.CatmullRomCurve3(pts.map(([px,pz])=>new THREE.Vector3(px,getTerrainHeight(px,pz)+0.06,pz)));
  const N=130,verts=[],uvs=[],idx=[];
  for(let i=0;i<=N;i++){
    const t=i/N,p=curve.getPointAt(t),tan=curve.getTangentAt(t);
    const s=new THREE.Vector3(-tan.z,0,tan.x).normalize().multiplyScalar(w*.5);
    const lh=getTerrainHeight(p.x+s.x,p.z+s.z)+0.04,rh=getTerrainHeight(p.x-s.x,p.z-s.z)+0.04;
    verts.push(p.x+s.x,lh,p.z+s.z,p.x-s.x,rh,p.z-s.z);uvs.push(0,t*8,1,t*8);
    if(i<N){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(idx);g.computeVertexNormals();
  const pm=addMesh(g,M.path,world,[0,0,0],false);pm.material.side=THREE.DoubleSide;
  // Border stones
  for(let i=3;i<N;i+=6){
    const t=i/N,p=curve.getPointAt(t),tan=curve.getTangentAt(t);
    const s=new THREE.Vector3(-tan.z,0,tan.x).normalize();
    for(const sign of [-1,1]){
      const ex=p.x+s.x*w*0.55*sign,ez=p.z+s.z*w*0.55*sign;
      sph(0.22,M.pathEdge,world,[ex,getTerrainHeight(ex,ez)+0.05,ez],[1.3,.45,1],1,true);
    }
  }
}
makePath([[0,2],[-8,-6],[-19,-12],[-30,-19]],2.7);
makePath([[0,2],[10,-5],[21,-11],[29,-17]],2.7);
makePath([[0,2],[1,14],[2,26],[2,38]],2.9);
makePath([[-18,-12],[-8,-20],[8,-22],[19,-14]],2.0);

// Signposts
function signpost(x,z){
  const y=getTerrainHeight(x,z);const g=new THREE.Group();g.position.set(x,y,z);world.add(g);
  cyl(0.09,0.11,2.2,M.woodDk,g,[0,1.1,0],8);sph(0.13,M.goldGleam,g,[0,2.25,0],[1,1,1],1);
  box(1.3,0.26,0.06,M.woodWarm,g,[-0.5,1.8,0]).rotation.y=0.18;
  box(1.4,0.26,0.06,M.woodPlank,g,[0.55,1.42,0.04]).rotation.y=-0.22;
  for(let i=0;i<4;i++)sph(0.07,M.flYellow,g,[Math.cos(i*1.5)*0.22,0.08,Math.sin(i*1.5)*0.22],[1,1,1],1);
}
signpost(0,3);signpost(-17,-11);signpost(17,-10);

/* ========================================================================
   STYLIZED ANIME TREES
   ======================================================================== */
function tree(x,z,scale=1,kind='oak'){
  const y=getTerrainHeight(x,z);const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);world.add(g);
  if(kind==='cherry'){
    cyl(0.26,0.44,2.8,M.trunkLight,g,[0,1.3,0],9);
    cyl(0.16,0.22,1.4,M.trunkLight,g,[0.45,2.2,0.2],7).rotation.z=-0.38;
    cyl(0.14,0.2,1.3,M.trunkLight,g,[-0.4,2.3,-0.2],7).rotation.z=0.42;
    sph(1.6,M.sakuraA,g,[0,3.3,0],[1.25,1.0,1.2],2);
    sph(1.2,M.sakuraB,g,[-0.9,3.5,0.3],[1,.92,.98],2);
    sph(1.2,M.sakuraB,g,[0.85,3.4,-0.3],[1.05,.9,1],2);
    sph(0.95,M.sakuraC,g,[0,4.2,0.2],[.95,.85,.9],1);
  }else if(kind==='pine'){
    cyl(0.22,0.36,2,M.trunk,g,[0,1,0],8);
    for(let i=0;i<5;i++){
      const cr=1.7-i*0.3,ch=1.25,cy=1.6+i*0.82;
      cone(cr,ch,i%2?M.pineA:M.pineB,g,[0,cy,0],7).rotation.y=i*0.45;
    }
    sph(0.12,M.goldGleam,g,[0,5.7,0],[1,1,1],1);
  }else if(kind==='autumn'){
    cyl(0.26,0.42,2.4,M.trunk,g,[0,1.1,0],9);
    sph(1.35,M.autumnA,g,[0,2.8,0],[1.1,1.05,1.05],2);
    sph(1.0,M.autumnB,g,[-0.7,3.0,0.2],[1,.95,.95],2);
    sph(0.95,M.autumnB,g,[0.65,3.1,-0.15],[.95,.9,.95],2);
  }else{
    cyl(0.3,0.48,2.6,M.trunk,g,[0,1.2,0],9);
    for(let r=0;r<3;r++){
      const ra=r*2.1;
      cyl(0.12,0.22,0.65,M.trunk,g,[Math.cos(ra)*.4,0.2,Math.sin(ra)*.4],6).rotation.z=Math.cos(ra)*0.3;
    }
    sph(1.5,M.leafA,g,[0,2.9,0],[1.2,1.08,1.08],2);
    sph(1.1,M.leafB,g,[-0.8,3.1,0.2],[1,.97,.97],2);
    sph(1.05,M.leafC,g,[0.75,3.2,-0.15],[.95,.92,.95],2);
    sph(0.9,M.leafB,g,[0.1,3.85,0.1],[.9,.85,.9],1);
  }
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return g;
}

function flowers(cx,cz,n=28,r=5,pal=[M.flRose,M.flYellow,M.flViolet]){
  for(let i=0;i<n;i++){
    const a=i*2.399,rd=r*Math.sqrt((i+.5)/n);
    const fx=cx+Math.cos(a)*rd,fz=cz+Math.sin(a)*rd,fy=getTerrainHeight(fx,fz);
    const sh=0.3+(i%3)*0.07;
    cyl(0.016,0.022,sh,toon('#4a8240'),world,[fx,fy+sh*.5,fz],5,false);
    const bl=sph(0.11,pal[i%pal.length],world,[fx,fy+sh+0.04,fz],[1.1,.75,1.1],1,false);
    floraAnim.push({mesh:bl,baseY:fy+sh+0.04,phase:a});
  }
}

/* ========================================================================
   ★ THE LITTLE CUP CAFÉ (Warm Anime-Style Cottage)
   ======================================================================== */
function buildCafe(){
  const cx=-31,cz=-20,cy=getTerrainHeight(cx,cz);
  const g=new THREE.Group();g.position.set(cx,cy,cz);world.add(g);

  // Stone terrace platform
  box(10,0.38,8.5,M.stoneTrim,g,[0,0.19,0.6],false);
  box(9.5,0.12,8,M.woodPlank,g,[0,0.42,0.6],false);

  // Main cottage body — warm cream plaster with timber frame
  const wW=6.5,wH=4.5,wD=5.5;
  box(wW,wH,wD,M.plasterW,g,[0,wH/2+0.42,0]);
  // Timber beams
  for(const sx of [-1,1]){
    box(0.24,wH,0.24,M.woodDk,g,[sx*(wW/2-0.12),wH/2+0.42,wD/2]);
    box(0.24,wH,0.24,M.woodDk,g,[sx*(wW/2-0.12),wH/2+0.42,-wD/2]);
  }
  box(wW,0.22,0.22,M.woodDk,g,[0,wH+0.35,wD/2]);
  box(wW,0.22,0.22,M.woodDk,g,[0,2.6,wD/2]);
  // Cross timber
  box(0.15,wH*0.7,0.15,M.woodDk,g,[0,wH*0.6+0.42,wD/2]).rotation.z=0.55;

  // Storybook roof with layered eaves
  const roof=cone(5.6,3.2,M.roofCoral,g,[0,wH+1.8,0],4);roof.rotation.y=Math.PI/4;roof.scale.set(1.18,1,1.08);
  box(wW*1.3,0.15,wD*1.15,M.woodDk,g,[0,wH+0.3,0]);// eave

  // Dormer with warm light
  box(1.5,1.3,1.4,M.plasterW,g,[0,wH+1.3,2]);
  cone(1.3,1.1,M.roofCoral,g,[0,wH+2.2,2],4).rotation.y=Math.PI/4;
  box(0.75,0.75,0.1,M.glassWarm,g,[0,wH+1.3,2.7]);

  // Stone chimney with warm glow
  box(0.95,3.8,0.95,M.stoneWall,g,[2.3,wH+1.5,-1.3]);
  box(1.15,0.28,1.15,M.stoneDark,g,[2.3,wH+3.4,-1.3]);
  // Chimney smoke emitter stored for particles
  animated.push({kind:'chimney',x:cx+2.3,y:cy+wH+3.6,z:cz-1.3,timer:0});

  // Welcoming front door
  box(1.3,2.5,0.18,M.woodWarm,g,[-1.2,1.67,wD/2+0.06]);
  sph(0.08,M.goldGleam,g,[-0.75,1.6,wD/2+0.16],[1,1,1],1);
  box(1.5,0.2,0.26,M.woodDk,g,[-1.2,2.95,wD/2+0.08]);

  // Glowing windows with flower boxes
  for(const wx of [1.5]){
    box(1.35,1.35,0.12,M.glassWarm,g,[wx,2.1,wD/2+0.07]);
    box(1.5,0.12,0.16,M.woodDk,g,[wx,2.1,wD/2+0.09]);
    box(0.12,1.5,0.16,M.woodDk,g,[wx,2.1,wD/2+0.09]);
    // Flower box
    box(1.55,0.32,0.42,M.woodWarm,g,[wx,1.28,wD/2+0.22]);
    for(let f=0;f<5;f++)sph(0.11,f%2?M.flRose:M.flYellow,g,[wx-0.55+f*0.28,1.5,wD/2+0.24],[1,.8,1],1);
  }
  // Side window
  box(1.1,1.1,0.12,M.glassWarm,g,[wW/2+0.06,2.1,0]);

  // Striped awning — vibrant coral & cream
  for(let s=-3;s<=3;s++){
    box(0.72,0.16,2.5,s%2?M.awningW:M.awningR,g,[s*0.92,3.45,wD/2+1.25]).rotation.x=0.2;
  }
  for(const sx of [-1,1])cyl(0.07,0.07,2.8,M.woodDk,g,[sx*2.9,1.8,wD/2+2.5],8);

  // Café sign — wooden board
  box(3.4,0.78,0.15,M.woodWarm,g,[0,4.1,wD/2+1.4]);
  box(3.55,0.9,0.08,M.woodDk,g,[0,4.1,wD/2+1.35]);
  cyl(0.2,0.14,0.24,M.plasterW,g,[0,4.12,wD/2+1.52],10); // teacup icon

  // Outdoor bistro tables & chairs
  for(const tx of [-2,2]){
    const tg=new THREE.Group();tg.position.set(tx,0.42,wD/2+2.5);g.add(tg);
    cyl(0.8,0.8,0.08,M.woodWarm,tg,[0,0.95,0],16);
    cyl(0.08,0.12,0.95,M.metalBrz,tg,[0,0.48,0],8);
    sph(0.13,M.plasterMint,tg,[0,1.08,0],[1,.9,1],1); // teapot
    for(const cx2 of [-0.3,0.3])cyl(0.05,0.04,0.12,M.plasterMint,tg,[cx2,1.04,0],8);
    for(const r of [0,Math.PI]){
      const ch=new THREE.Group();ch.position.set(Math.sin(r)*1.2,0,Math.cos(r)*1.2);ch.rotation.y=r+Math.PI;tg.add(ch);
      cyl(0.35,0.35,0.06,M.woodWarm,ch,[0,0.52,0],10);
      box(0.6,0.55,0.06,M.woodWarm,ch,[0,0.82,0.3]).rotation.x=-0.12;
    }
  }

  // Blackboard easel
  const ea=new THREE.Group();ea.position.set(-3,0.42,wD/2+3.5);ea.rotation.y=0.35;g.add(ea);
  box(0.78,1.05,0.06,M.dark,ea,[0,0.72,0]);box(0.88,1.15,0.04,M.woodWarm,ea,[0,0.72,-0.02]);

  // Festive bunting
  for(let f=0;f<9;f++){
    const fl=cone(0.22,0.42,f%3===0?M.roofGold:f%3===1?M.flRose:M.flBlue,g,[-2.8+f*0.7,3.9-Math.sin(f*0.5)*0.18,wD/2+2.8],3);
    fl.rotation.z=Math.PI;
  }

  // Nearby cozy cottage
  const c2=new THREE.Group();c2.position.set(-39,getTerrainHeight(-39,-14),-14);world.add(c2);
  box(4.6,3.4,4.2,M.plasterMint,c2,[0,1.7,0]);
  cone(3.8,2.4,M.roofSage,c2,[0,4.1,0],4).rotation.y=Math.PI/4;
  box(0.9,1.9,0.12,M.woodDk,c2,[0,0.95,2.15]);
  box(0.8,0.85,0.1,M.glassWarm,c2,[1.3,1.9,2.15]);
  // Barrel & crates
  cyl(0.4,0.36,0.85,M.woodDk,c2,[2.6,0.43,1.2],10);
  box(0.65,0.65,0.65,M.woodPlank,c2,[2.6,0.33,0.2]);

  // Bench near café
  const bn=new THREE.Group();bn.position.set(-24,getTerrainHeight(-24,-16),-16);bn.rotation.y=0.4;world.add(bn);
  box(2.2,0.17,0.72,M.woodWarm,bn,[0,0.7,0]);box(2.2,0.72,0.12,M.woodWarm,bn,[0,1.08,0.3]);
  for(const bx of [-.82,.82])for(const bz of [-.2,.2])cyl(0.06,0.06,0.7,M.woodDk,bn,[bx,0.35,bz],6);
}

/* ========================================================================
   ★ WISHING GARDEN (Enchanted Sanctuary)
   ======================================================================== */
function buildGarden(){
  const gx=29,gz=-18,gy=getTerrainHeight(gx,gz);

  // Stone-rimmed pond
  const ring=addMesh(new THREE.TorusGeometry(5.4,0.38,14,48),M.stoneTrim,world,[gx,gy+0.35,gz]);ring.rotation.x=Math.PI/2;
  const pw=addMesh(new THREE.CircleGeometry(5.2,48),M.water,world,[gx,gy+0.28,gz],false);pw.rotation.x=-Math.PI/2;

  // Lily pads & lotus
  for(let i=0;i<8;i++){
    const a=i*0.88,r=1.5+(i%3)*1.1;
    const lp=addMesh(new THREE.CircleGeometry(0.42,14),M.leafA,world,[gx+Math.cos(a)*r,gy+0.3,gz+Math.sin(a)*r],false);lp.rotation.x=-Math.PI/2;
    if(i%2===0)sph(0.13,M.flRose,world,[gx+Math.cos(a)*r,gy+0.38,gz+Math.sin(a)*r],[1.1,.8,1.1],1);
  }

  // Tiered fountain
  cyl(0.9,1.15,1.0,M.stoneWall,world,[gx,gy+0.65,gz],16);
  cyl(1.65,1.35,0.3,M.stoneTrim,world,[gx,gy+1.2,gz],16);
  cyl(0.38,0.48,0.95,M.stoneWall,world,[gx,gy+1.7,gz],12);
  cyl(0.95,0.78,0.22,M.stoneTrim,world,[gx,gy+2.22,gz],14);
  sph(0.34,M.stoneTrim,world,[gx,gy+2.55,gz],[1,1.2,1],1);
  for(let j=0;j<6;j++){
    const ja=j*Math.PI/3;
    cyl(0.02,0.04,0.82,M.waterFoam,world,[gx+Math.cos(ja)*0.55,gy+1.9,gz+Math.sin(ja)*0.55],6,false).rotation.z=Math.cos(ja)*0.42;
  }

  // Grand wishing tree (massive cherry)
  const wt=tree(gx+10,gz-5,1.9,'cherry');
  // Colorful ribbons
  for(let i=0;i<20;i++){
    const a=i*2.399,d=1.7+(i%4)*0.5;
    const rMat=[M.flRose,M.flYellow,M.flViolet,M.flBlue][i%4];
    const rb=box(0.08,1.2,0.08,rMat,wt,[Math.cos(a)*d,2.9+(i%3)*0.35,Math.sin(a)*d]);
    rb.rotation.z=Math.sin(a)*0.35;
    animated.push({mesh:rb,kind:'sway',phase:a});
  }
  // Glowing lanterns hanging from tree
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+0.4,d=2.2;
    const lt=sph(0.26,M.star,wt,[Math.cos(a)*d,2.5+(i%2)*0.45,Math.sin(a)*d],[1,1.3,1],1);
    animated.push({mesh:lt,kind:'float',phase:a*2});
  }

  // Garden arch with wisteria
  const ag=new THREE.Group();ag.position.set(gx-10,getTerrainHeight(gx-10,gz+3),gz+3);ag.rotation.y=0.55;world.add(ag);
  for(const sx of [-1.3,1.3])for(const sz of [-.9,.9])cyl(0.08,0.08,3,M.woodDk,ag,[sx,1.5,sz],8);
  for(const sx of [-1.3,1.3])box(0.12,0.12,2.2,M.woodWarm,ag,[sx,3,0]);
  for(let r=-3;r<=3;r++)box(3.1,0.08,0.12,M.woodWarm,ag,[0,3.1,r*0.32]);
  for(let w=0;w<14;w++){
    const wx=(w%2?-1.3:1.3)+(Math.sin(w)*0.3);
    sph(0.35,M.flViolet,ag,[wx,1.5+(w%4)*0.42,(w%3-1)*0.6],[1,1.3,1],1);
  }

  // Bench & birdbath
  const gBn=new THREE.Group();gBn.position.set(gx-5,getTerrainHeight(gx-5,gz-6),gz-6);gBn.rotation.y=-0.4;world.add(gBn);
  box(2.2,0.16,0.75,M.woodWarm,gBn,[0,0.65,0]);box(2.2,0.65,0.12,M.woodWarm,gBn,[0,1.05,0.32]);

  cyl(0.15,0.3,1.15,M.stoneTrim,world,[gx+5,getTerrainHeight(gx+5,gz+5)+0.58,gz+5],10);
  cyl(0.72,0.48,0.2,M.stoneTrim,world,[gx+5,getTerrainHeight(gx+5,gz+5)+1.2,gz+5],14);

  // Garden house
  const gh=new THREE.Group();gh.position.set(gx+9,getTerrainHeight(gx+9,gz+7),gz+7);world.add(gh);
  box(4.8,3.2,4.3,M.plasterRose,gh,[0,1.6,0]);
  cone(3.9,2.3,M.roofRoyal,gh,[0,3.8,0],4).rotation.y=Math.PI/4;
  box(0.9,1.9,0.12,M.woodDk,gh,[0,0.95,-2.2]);
  box(0.8,0.85,0.1,M.glassWarm,gh,[1.3,1.9,-2.2]);

  // Dense flower beds
  flowers(gx-3,gz-3,40,7,[M.flViolet,M.flRose,M.flWhite]);
  flowers(gx+6,gz-2,48,9,[M.flRose,M.flYellow,M.flViolet]);
  flowers(gx+2,gz-9,30,5,[M.flBlue,M.flWhite,M.flYellow]);
}

/* ========================================================================
   ★ THE STARLIT CASTLE (Majestic Anime-Style Fairytale Palace)
   ======================================================================== */
function buildCastle(){
  const cx=2,cz=44,cy=getTerrainHeight(cx,cz);
  const g=new THREE.Group();g.position.set(cx,cy,cz);world.add(g);

  // Grand stone courtyard
  box(26,0.85,24,M.stoneTrim,g,[0,0.42,0],false);
  box(25,0.2,23,M.stoneWall,g,[0,0.88,0],false);

  // Grand stairway facing south
  for(let s=0;s<8;s++){
    box(8,0.28,1.3,M.stoneTrim,g,[0,0.8-s*0.2,-12-s*1.2]);
  }
  // Flanking lamps on stair base
  for(const lx of [-4.5,4.5]){
    cyl(0.4,0.5,1.5,M.stoneTrim,g,[lx,-0.7,-20.5],8);
    sph(0.25,M.star,g,[lx,0.2,-20.5],[1,1,1],1);
    const glowSph=sph(0.55,glow('#ffe070',0.2),g,[lx,0.2,-20.5],[1,1,1],1,false);
    animated.push({mesh:glowSph,kind:'pulse',phase:lx});
  }

  // ── CENTRAL KEEP ──
  const kW=15,kH=12,kD=11;
  box(kW,kH,kD,M.plasterGold,g,[0,kH/2+0.88,2]);

  // Decorative horizontal stone bands
  box(kW+0.3,0.45,kD+0.3,M.stoneTrim,g,[0,kH+0.88,2]);
  box(kW+0.2,0.35,kD+0.2,M.stoneDark,g,[0,kH*0.5+0.88,2]);

  // Battlements
  for(let b=0;b<7;b++){
    box(1.1,0.9,0.42,M.stoneTrim,g,[-6.3+b*2.1,kH+1.45,kD/2+2]);
    box(1.1,0.9,0.42,M.stoneTrim,g,[-6.3+b*2.1,kH+1.45,-kD/2+2]);
  }

  // Grand Royal Spire
  const spire=cone(5.8,7,M.roofRoyal,g,[0,kH+4.4,2],8);
  sph(0.38,M.goldGleam,g,[0,kH+8.2,2],[1,1.5,1],1);

  // Arched windows with warm amber glow
  for(const wx of [-4.2,4.2]){
    box(1.3,2.5,0.22,M.glassWarm,g,[wx,6.8,-kD/2+1.85]);
    addMesh(new THREE.CylinderGeometry(0.72,0.72,0.28,12),M.stoneTrim,g,[wx,8.2,-kD/2+1.85]).rotation.x=Math.PI/2;
    // Window frame stone trim
    box(1.55,0.22,0.28,M.stoneTrim,g,[wx,5.4,-kD/2+1.85]);
  }
  // Central large rose window
  addMesh(new THREE.TorusGeometry(1.4,0.18,8,24),M.stoneTrim,g,[0,9.5,-kD/2+1.85]).rotation.y=Math.PI/2;
  sph(1.2,M.glassWarm,g,[0,9.5,-kD/2+1.87],[1,1,0.15],2);

  // Grand arched gate
  box(3.5,5,0.42,M.woodDk,g,[0,3.1,-kD/2+1.7]);
  addMesh(new THREE.CylinderGeometry(2.2,2.2,0.48,14),M.stoneTrim,g,[0,5.5,-kD/2+1.7]).rotation.x=Math.PI/2;
  // Iron studs on door
  for(let sy=0;sy<3;sy++)for(const sx of [-1,0,1])sph(0.08,M.metalBrz,g,[sx*0.9,1.8+sy*1.2,-kD/2+1.5],[1,1,1],1);

  // ── FOUR CORNER TOWERS ──
  const towers=[[-9,-5],[9,-5],[-9,8.5],[9,8.5]];
  towers.forEach(([tx,tz],i)=>{
    const tH=15;
    cyl(1.8,2.1,tH,M.plasterGold,g,[tx,tH/2+0.88,tz],14);
    cyl(2.2,1.9,0.65,M.stoneTrim,g,[tx,tH+0.88,tz],14); // corbel
    const sMat=i%2===0?M.roofCoral:M.roofRoyal;
    cone(2.3,5.5,sMat,g,[tx,tH+3.6,tz],10);
    sph(0.28,M.goldGleam,g,[tx,tH+6.6,tz],[1,1.6,1],1);
    // Tower windows
    box(0.8,1.3,0.2,M.glassWarm,g,[tx+(tx<0?-1.7:1.7),tH*0.6+0.88,tz]);
    // Flying banner
    const pennant=cone(0.4,1.6,M.roofGold,g,[tx,tH+7.2,tz],3);
    pennant.rotation.z=Math.PI;
    animated.push({mesh:pennant,kind:'sway',phase:i*1.3});
  });

  // ── CONNECTING CURTAIN WALLS ──
  for(const side of [-1,1]){
    box(0.65,5,kD+4,M.plasterGold,g,[side*(kW/2+0.8),3.3+0.88,2]);
    // Wall walkway & mini crenellations
    for(let w=0;w<5;w++){
      box(0.75,0.65,0.35,M.stoneTrim,g,[side*(kW/2+0.8),6.4+0.88,-kD/2+2+w*(kD+4)/5]);
    }
  }

  // ── ROMANTIC FINALE ALTAR ──
  cyl(3.5,3.8,0.6,M.stoneTrim,g,[0,1.2,-8],18);
  cyl(2.8,3.1,0.4,M.stoneWall,g,[0,1.55,-8],18);

  // Heart monument
  const heartObj=new THREE.Group();heartObj.position.set(0,3.0,-8);g.add(heartObj);
  sph(0.78,M.heartMat,heartObj,[-0.5,0.12,0],[1,.95,.6],2);
  sph(0.78,M.heartMat,heartObj,[0.5,0.12,0],[1,.95,.6],2);
  const tip=cone(0.88,1.5,M.heartMat,heartObj,[0,-0.68,0],4);tip.rotation.y=Math.PI/4;tip.rotation.x=Math.PI;
  // Heart glow aura
  sph(1.6,glow('#ff5070',0.18),heartObj,[0,-0.1,0],[1.2,1,0.8],1,false);
  animated.push({mesh:heartObj,kind:'float',phase:1.0});

  // Orbiting star constellation
  for(let i=0;i<12;i++){
    const a=i*Math.PI*2/12;
    const cr=sph(0.16,M.star,g,[Math.cos(a)*4.5,2.2,-8+Math.sin(a)*4.5],[1,1.4,1],1);
    animated.push({mesh:cr,kind:'orbit',phase:a,center:[0,2.2,-8]});
  }

  // Courtyard garden details
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,r=7;
    tree(cx+Math.cos(a)*r,cz+Math.sin(a)*r,0.6,i%2?'pine':'oak');
  }
  flowers(cx-6,cz-4,20,4,[M.flRose,M.flWhite,M.flViolet]);
  flowers(cx+6,cz-4,20,4,[M.flYellow,M.flBlue,M.flWhite]);
}

/* ========================================================================
   POPULATE THE WORLD
   ======================================================================== */
function populate(){
  buildCafe();buildGarden();buildCastle();

  // Natural boulders
  for(let i=0;i<25;i++){
    const a=i*0.6,r=15+(i%6)*5.5;
    const rx=Math.cos(a)*r,rz=Math.sin(a)*r;
    if(Math.hypot(rx+31,rz+20)<9||Math.hypot(rx-29,rz+18)<9||Math.hypot(rx-2,rz-44)<14)continue;
    sph(0.6+(i%3)*0.25,M.stoneTrim,world,[rx,getTerrainHeight(rx,rz)+0.2,rz],[1.15,.5+(i%2)*.2,.9],1,true).rotation.y=a;
  }

  // Diverse tree forest
  let seed=28192;
  const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const types=['oak','oak','cherry','pine','autumn','oak','pine'];
  for(let i=0;i<55;i++){
    const a=rnd()*Math.PI*2,r=12+rnd()*34;
    const tx=Math.cos(a)*r,tz=Math.sin(a)*r;
    if(Math.hypot(tx+31,tz+20)<11||Math.hypot(tx-29,tz+18)<11||Math.hypot(tx-2,tz-44)<16||Math.hypot(tx,tz-2)<6)continue;
    tree(tx,tz,0.8+rnd()*0.5,types[i%types.length]);
  }

  // Meadow flower patches
  flowers(-5,8,35,5.5);flowers(7,-8,28,4.5,[M.flBlue,M.flYellow,M.flWhite]);
  flowers(-12,-4,25,4,[M.flViolet,M.flRose,M.flYellow]);
}
populate();

/* ========================================================================
   12 COLLECTIBLE STARS
   ======================================================================== */
const starSpots=[[-40,-24],[-23,-27],[-36,-8],[-20,-17],[23,-26],[38,-19],[31,-8],[42,-14],[-8,43],[14,43],[2,54],[2,31]];
starSpots.forEach(([sx,sz],i)=>{
  const sy=getTerrainHeight(sx,sz)+1.5;const id=`star-${i}`;
  const h=new THREE.Group();h.position.set(sx,sy,sz);world.add(h);
  const gem=addMesh(new THREE.OctahedronGeometry(0.48,0),M.star,h);
  addMesh(new THREE.TorusGeometry(0.75,0.035,8,28),M.starGlow,h,[0,0,0],false).rotation.x=Math.PI/2;
  sph(0.9,M.starGlow,h,[0,-0.4,0],[1,0.3,1],1,false).rotation.x=-Math.PI/2;
  h.userData={type:'star',id,label:'A little star'};
  interactables.push(h);starObjects.push({holder:h,gem,baseY:sy,phase:i*0.85});
  if(state.stars.has(id))h.visible=false;
});

/* ========================================================================
   HIDDEN NOTE LANTERNS
   ======================================================================== */
function noteLantern(x,z,idx){
  const y=getTerrainHeight(x,z);const g=new THREE.Group();g.position.set(x,y,z);world.add(g);
  cyl(0.12,0.16,1.4,M.metalBrz,g,[0,0.7,0],8);
  cyl(0.36,0.46,0.8,M.metalBrz,g,[0,1.65,0],8);
  sph(0.26,M.star,g,[0,1.65,0],[1,1.3,1],1);
  cone(0.52,0.48,M.metalBrz,g,[0,2.22,0],8);
  const orb=sph(0.2,M.star,g,[0,2.7,0],[1,1,1],1);
  animated.push({mesh:orb,kind:'float',phase:idx*2.1});
  g.userData={type:'note',id:`note-${idx}`,noteIndex:idx,label:'A hidden note'};
  interactables.push(g);
}
noteLantern(-22,-12,0);noteLantern(21,-11,1);noteLantern(-1,31,2);

/* ========================================================================
   INTERACTIVE PROPS
   ======================================================================== */
const snackAnchor=new THREE.Group();snackAnchor.position.set(-29,getTerrainHeight(-29,-15),-15);
snackAnchor.userData={type:'snack',label:'A little treat'};interactables.push(snackAnchor);world.add(snackAnchor);

const yarnG=new THREE.Group();yarnG.position.set(23,getTerrainHeight(23,-11),-11);world.add(yarnG);
cyl(0.65,0.75,0.5,M.woodPlank,yarnG,[0,0.35,0],12);
[M.flRose,M.flViolet,M.roofGold,M.roofSage].forEach((m,i)=>sph(0.32,m,yarnG,[-0.35+i*0.24,0.8,0],[1,1,1],2));
yarnG.userData={type:'yarn',label:'Play with the yarn'};interactables.push(yarnG);

const finaleAnchor=new THREE.Group();finaleAnchor.position.set(2,getTerrainHeight(2,36.5)+0.8,36.5);
finaleAnchor.userData={type:'finale',label:'Open the castle surprise'};interactables.push(finaleAnchor);world.add(finaleAnchor);

/* ========================================================================
   PLAYER CHARACTER (Cel-Shaded Anime Explorer)
   ======================================================================== */
const playerG=new THREE.Group();scene.add(playerG);
const avatar=new THREE.Group();playerG.add(avatar);
addMesh(new THREE.CapsuleGeometry(0.44,0.9,6,12),M.coat,avatar,[0,1.28,0]);
sph(0.44,M.skin,avatar,[0,2.15,0.04],[.94,1.06,.92],2);
sph(0.46,M.hair,avatar,[0,2.42,-0.04],[1.02,.72,1],2);
for(const s of [-1,1]){
  sph(0.28,M.hair,avatar,[s*0.33,2.2,0.08],[.65,.78,.65],1);
  sph(0.06,M.catPink,avatar,[s*0.27,2.04,0.39],[1,.55,.5],1);
  sph(0.05,M.dark,avatar,[s*0.15,2.16,0.42],[1,1,1],1);
}
const scarfC=box(0.82,0.19,0.62,M.scarf,avatar,[0,1.87,0.25]);scarfC.rotation.x=-0.15;
const scarfT=box(0.26,0.68,0.08,M.scarf,avatar,[-0.24,1.5,0.46]);scarfT.rotation.x=0.25;
const armL=addMesh(new THREE.CapsuleGeometry(0.14,0.5,4,8),M.coat,avatar,[-0.56,1.28,0]);
const armR=addMesh(new THREE.CapsuleGeometry(0.14,0.5,4,8),M.coat,avatar,[0.56,1.28,0]);
const legs=[];
for(const s of [-1,1]){
  const lg=new THREE.Group();lg.position.set(s*0.22,0.74,0);avatar.add(lg);
  addMesh(new THREE.CapsuleGeometry(0.15,0.5,4,8),M.pants,lg,[0,-0.28,0]);
  sph(0.19,M.boots,lg,[0,-0.58,0.08],[1,.6,1.35],1);
  legs.push(lg);
}

/* ========================================================================
   CAT COMPANION
   ======================================================================== */
const catG=new THREE.Group();scene.add(catG);
const catBody=sph(0.56,M.catO,catG,[0,0.58,0],[1.25,.74,.85],2);
const catHead=sph(0.46,M.catO,catG,[0,0.96,0.6],[1,.94,.88],2);
for(const s of [-1,1]){
  const ear=cone(0.21,0.48,M.catO,catG,[s*0.29,1.35,0.6],4);ear.rotation.z=s*-0.18;
  sph(0.12,M.catPink,catG,[s*0.29,1.35,0.66],[.7,.85,.4],1);
  sph(0.04,M.dark,catG,[s*0.17,1.04,0.96],[1,1,1],1);
  sph(0.14,M.catW,catG,[s*0.16,0.82,0.92],[1,.7,.5],1);
}
sph(0.07,M.catPink,catG,[0,0.88,1.0],[1,.75,.8],1);
const catTail=new THREE.Group();catTail.position.set(0,0.67,-0.52);catG.add(catTail);
for(let i=0;i<6;i++)sph(0.17,M.catO,catTail,[Math.sin(i*0.55)*0.17,0.15+i*0.15,-i*0.09],[.85,1.25,.85],1);
const catLegs=[];
for(const x of [-.33,.33])for(const z of [-.27,.35]){catLegs.push(addMesh(new THREE.CapsuleGeometry(0.1,0.36,4,6),M.catO,catG,[x,0.24,z]));}
catG.position.set(-25,getTerrainHeight(-25,-13),-13);
catG.userData={type:'cat',label:'Say hello to the cat'};interactables.push(catG);
const catS={mode:'idle',timer:0,step:0,base:new THREE.Vector3(-25,0,-13),target:new THREE.Vector3(-25,0,-13),follow:state.catBond>=3};

/* ========================================================================
   🌸 CHERRY BLOSSOM PARTICLE SYSTEM
   ======================================================================== */
const PETAL_COUNT=70;
function spawnPetal(){
  const geo=new THREE.PlaneGeometry(0.16,0.12);
  const mat=new THREE.MeshBasicMaterial({
    color:Math.random()>0.4?'#ffb0c8':'#ffc8d8',side:THREE.DoubleSide,transparent:true,opacity:0.82
  });
  const m=new THREE.Mesh(geo,mat);
  m.position.set((Math.random()-0.5)*90,16+Math.random()*12,(Math.random()-0.5)*90);
  scene.add(m);
  cherryPetals.push({mesh:m,vx:(Math.random()-0.5)*0.35,vy:-0.35-Math.random()*0.35,vz:(Math.random()-0.5)*0.35,
    rSpd:(Math.random()-0.5)*3,phase:Math.random()*Math.PI*2});
}
for(let i=0;i<PETAL_COUNT;i++)spawnPetal();

/* ========================================================================
   ✨ AMBIENT FIREFLY PARTICLES
   ======================================================================== */
const FIREFLY_COUNT=30;
for(let i=0;i<FIREFLY_COUNT;i++){
  const fx=(Math.random()-0.5)*70,fz=(Math.random()-0.5)*70;
  const fy=getTerrainHeight(fx,fz)+1.5+Math.random()*3;
  const fm=sph(0.07,glow('#ffe870',0.85),scene,[fx,fy,fz],[1,1,1],1,false);
  fireflies.push({mesh:fm,base:new THREE.Vector3(fx,fy,fz),phase:Math.random()*Math.PI*2,speed:0.25+Math.random()*0.45});
}

/* ========================================================================
   COLLISION & BOUNDARIES
   ======================================================================== */
const solids=[{x:-31,z:-20,r:4.8},{x:-39,z:-14,r:3.5},{x:29,z:-18,r:5},{x:39,z:-23,r:2.4},
  {x:2,z:46,r:10},{x:-7,z:39.5,r:2.3},{x:11,z:39.5,r:2.3},{x:-7,z:52.5,r:2.3},{x:11,z:52.5,r:2.3},{x:38,z:-11,r:3.5}];

function resolveCollisions(pos,vel){
  for(const s of solids){
    const dx=pos.x-s.x,dz=pos.z-s.z,d=Math.hypot(dx,dz);
    if(d<s.r){const o=s.r-d,nx=dx/(d||1),nz=dz/(d||1);pos.x+=nx*o;pos.z+=nz*o;
      const vn=vel.x*nx+vel.z*nz;if(vn<0){vel.x-=vn*nx;vel.z-=vn*nz;}}
  }
  const maxR=53,cr=Math.hypot(pos.x,pos.z);
  if(cr>maxR){const nx=pos.x/cr,nz=pos.z/cr;pos.x=nx*maxR;pos.z=nz*maxR;
    const vn=vel.x*nx+vel.z*nz;if(vn>0){vel.x-=vn*nx;vel.z-=vn*nz;}}
}

/* ========================================================================
   REGIONS, QUEST & HUD
   ======================================================================== */
const regions=[
  {name:'Mosslight Meadow',note:'THE WORLD IS YOURS TO WANDER',x:0,z:0,r:20},
  {name:'The Little Cup Café',note:'WARM TEA · WARMER COMPANY',x:-31,z:-20,r:21},
  {name:'Wishing Garden',note:'A QUIET PLACE FOR BRIGHT THOUGHTS',x:29,z:-18,r:21},
  {name:'The Starlit Castle',note:'SOME SECRETS WAIT AT THE TOP',x:2,z:42,r:24}
];
let cameraYaw=-0.15,cameraPitch=0.38,cameraDist=12.5,drag=null,ptrDown=null;
const moveKeys=new Set(),joyVec=new THREE.Vector2();

function updateCamera(dt){
  const ty=state.pos.y+1.5;const look=new THREE.Vector3(state.pos.x,ty,state.pos.z);
  const cp=Math.cos(cameraPitch),sp=Math.sin(cameraPitch);
  const off=new THREE.Vector3(Math.sin(cameraYaw)*cp*cameraDist,sp*cameraDist,Math.cos(cameraYaw)*cp*cameraDist);
  camera.position.lerp(look.clone().add(off),1-Math.exp(-dt*7.5));camera.lookAt(look);
}

function persist(){try{localStorage.setItem(saveKey,JSON.stringify({stars:[...state.stars],notes:[...state.notes],catBond:state.catBond,finale:state.finale,x:state.pos.x,z:state.pos.z}));}catch{}}
function showToast(m){ui.toast.textContent=m;ui.toast.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2400);}
function openModal({eyebrow='A NOTE FOR YOU',title,body,button='Keep wandering'}){ui.modalEyebrow.textContent=eyebrow;ui.modalTitle.textContent=title;ui.modalBody.textContent=body;ui.modalContinue.innerHTML=`${button} <span>→</span>`;ui.modal.hidden=false;state.modalOpen=true;}
function closeModal(){ui.modal.hidden=true;state.modalOpen=false;}
ui.closeModal.addEventListener('click',closeModal);ui.modalContinue.addEventListener('click',closeModal);
ui.modal.addEventListener('click',e=>{if(e.target===ui.modal)closeModal();});

function refreshQuest(){
  ui.stars.textContent=state.stars.size;
  if(state.finale){ui.questKicker.textContent='A MOMENT TO KEEP';ui.quest.textContent='Your little universe is complete';ui.questIcon.textContent='♡';return;}
  if(state.stars.size<12){ui.questKicker.textContent='A LITTLE ADVENTURE';ui.quest.textContent=`Find the golden glimmers · ${state.stars.size}/12`;ui.questIcon.textContent='✦';}
  else if(state.catBond<3){ui.questKicker.textContent='ONE MORE THING';ui.quest.textContent=`Make a friend · ${state.catBond}/3`;ui.questIcon.textContent='♡';}
  else{ui.questKicker.textContent='THE LAST LITTLE SECRET';ui.quest.textContent='Visit the castle heart';ui.questIcon.textContent='⌂';}
}
refreshQuest();

/* ========================================================================
   AUDIO (preserved exactly)
   ======================================================================== */
let audioCtx=null,masterGain=null,musicGain=null,musicTimer=null;
let volume=Number(localStorage.getItem('joos-volume')||70)/100,muted=localStorage.getItem('joos-muted')==='true';
ui.volume.value=String(Math.round(volume*100));ui.volumeValue.textContent=`${Math.round(volume*100)}%`;ui.sound.textContent=muted?'◌':'♫';
function startAudio(){
  if(!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();masterGain=audioCtx.createGain();musicGain=audioCtx.createGain();
    masterGain.gain.value=muted?0:volume;musicGain.gain.value=0.28;musicGain.connect(masterGain);masterGain.connect(audioCtx.destination);
    const notes=[261.63,329.63,392,440,523.25,392,329.63,293.66];let n=0;
    musicTimer=setInterval(()=>{if(!audioCtx||audioCtx.state!=='running')return;
      const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
      osc.type='sine';osc.frequency.value=notes[n++%notes.length];
      gain.gain.setValueAtTime(0.0001,now);gain.gain.exponentialRampToValueAtTime(0.045,now+0.16);gain.gain.exponentialRampToValueAtTime(0.0001,now+1.8);
      osc.connect(gain);gain.connect(musicGain);osc.start(now);osc.stop(now+1.85);},940);
  }
  if(audioCtx.state==='suspended')audioCtx.resume();
}
function sfx(kind='sparkle'){if(!audioCtx)return;const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
  const cfg={sparkle:[880,.26,'sine'],pet:[560,.22,'triangle'],feed:[430,.2,'sine'],yarn:[720,.16,'triangle'],note:[660,.48,'sine'],finish:[523,.85,'sine']};
  const[freq,dur,type]=cfg[kind]||cfg.sparkle;osc.type=type;osc.frequency.setValueAtTime(freq,now);
  osc.frequency.exponentialRampToValueAtTime(freq*1.4,now+dur*.35);osc.frequency.exponentialRampToValueAtTime(freq*.72,now+dur);
  gain.gain.setValueAtTime(0.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='finish'?0.2:0.1,now+0.02);gain.gain.exponentialRampToValueAtTime(0.0001,now+dur);
  osc.connect(gain);gain.connect(masterGain);osc.start(now);osc.stop(now+dur+0.02);}
function setVol(v){volume=v;localStorage.setItem('joos-volume',String(Math.round(v*100)));ui.volumeValue.textContent=`${Math.round(v*100)}%`;
  if(masterGain&&audioCtx)masterGain.gain.setTargetAtTime(muted?0:v,audioCtx.currentTime,0.08);}
ui.volume.addEventListener('input',()=>setVol(Number(ui.volume.value)/100));
ui.sound.addEventListener('click',()=>{ui.soundPanel.hidden=!ui.soundPanel.hidden;});
ui.soundPanel.addEventListener('click',e=>e.stopPropagation());
function toggleMute(){muted=!muted;localStorage.setItem('joos-muted',String(muted));ui.sound.textContent=muted?'◌':'♫';
  ui.mute.textContent=muted?'Turn sounds back on':'Mute all sounds';if(masterGain&&audioCtx)masterGain.gain.setTargetAtTime(muted?0:volume,audioCtx.currentTime,0.08);}
ui.mute.addEventListener('click',toggleMute);ui.mute.textContent=muted?'Turn sounds back on':'Mute all sounds';
ui.help.addEventListener('click',()=>openModal({eyebrow:'HOW TO WANDER',title:'Take your time.',body:'Explore with WASD or arrow keys. On mobile, glide with the thumbstick. Drag to look around. Walk close to something glowing and press E or tap the heart. Find stars, make a friend, discover the castle secret.',button:'Let\'s go'}));
ui.begin.addEventListener('click',()=>{state.started=true;ui.welcome.classList.add('leaving');startAudio();showToast('Welcome to your little universe ✦');});

/* ========================================================================
   INTERACTIONS (star, note, cat, snack, yarn, finale)
   ======================================================================== */
function nearest(){let best=null,bd=Infinity;for(const o of interactables){if(!o.visible)continue;
  const p=new THREE.Vector3();o.getWorldPosition(p);const d=Math.hypot(state.pos.x-p.x,state.pos.z-p.z);
  if(d<3.5&&d<bd){best=o;bd=d;}}return best;}

function interact(obj=state.active){
  if(!obj||state.modalOpen)return;const t=obj.userData.type;
  if(t==='star'){if(state.stars.has(obj.userData.id))return;state.stars.add(obj.userData.id);obj.visible=false;persist();refreshQuest();sfx('sparkle');
    showToast(['A little light for your pocket ✦','One more star gathered ✧','The sky feels closer ♡'][state.stars.size%3]);return;}
  if(t==='note'){const i=obj.userData.noteIndex,id=obj.userData.id;if(state.notes.has(id)){showToast('You\'ve already tucked this one away ♡');return;}
    state.notes.add(id);persist();sfx('note');const n=messages.notes[i%messages.notes.length];openModal({title:n.title,body:n.body});return;}
  if(t==='cat'){const b=state.catBond;
    if(b===0){state.catBond++;catS.mode='purr';catS.timer=2.8;sfx('pet');openModal({eyebrow:'A NEW LITTLE FRIEND',title:'Oh, hello there.',body:'The tiny garden cat leans into your hand and gives the softest purr. Looks like you\'ve made a friend.',button:'Say hello'});}
    else if(b===1){state.catBond++;catS.mode='snack';catS.timer=3;sfx('feed');openModal({eyebrow:'A VERY GOOD TREAT',title:'The way to a heart…',body:'A little treat, a little trust, and a very happy tail. Your new friend decides you\'re worth following.',button:'That\'s sweet'});}
    else{state.catBond++;catS.mode='play';catS.timer=3.4;catS.target.copy(catG.position);catS.follow=true;sfx('yarn');openModal({eyebrow:'BEST FRIENDS',title:'Your shadow, with whiskers.',body:'A tumble through the yarn, a happy little chirp, and now you have a companion for the rest of your adventure.',button:'Let\'s go together'});}
    persist();refreshQuest();return;}
  if(t==='snack'){if(catS.mode==='snack'){showToast('Your friend already found the treats!');return;}catS.mode='snack';catS.timer=3.2;catS.target.set(-29,0,-15);sfx('feed');showToast('A tiny picnic for two ♡');return;}
  if(t==='yarn'){catS.mode='play';catS.timer=3.6;catS.target.set(23,0,-11);sfx('yarn');showToast('A very serious game of yarn ✦');return;}
  if(t==='finale'){
    if(state.stars.size<12){showToast(`The castle heart waits for ${12-state.stars.size} more stars ✦`);return;}
    if(state.catBond<3){showToast('Your little companion should come along ♡');return;}
    if(state.finale){openModal({eyebrow:'YOUR FOREVER PLACE',title:messages.finale.title,body:`${messages.finale.body}\n\n${messages.finale.signOff}`,button:'Keep this close'});return;}
    state.finale=true;persist();refreshQuest();sfx('finish');
    openModal({eyebrow:'A LITTLE ROMANTIC SURPRISE',title:messages.finale.title,body:`${messages.finale.body}\n\n${messages.finale.signOff}`,button:'Keep this close'});
    for(let i=0;i<50;i++)spawnSparkle();return;}
}
function spawnSparkle(){const a=Math.random()*Math.PI*2,r=2+Math.random()*5;
  const m=sph(0.12,M.star,scene,[state.pos.x+Math.cos(a)*r,state.pos.y+1+Math.random()*4,state.pos.z+Math.sin(a)*r],[1,1,1],1);
  animated.push({mesh:m,kind:'burst',life:3.2});}

function updateUI(){const f=nearest();state.active=f;if(!f){ui.interact.hidden=true;return;}
  let l=f.userData.label;
  if(f.userData.type==='cat')l=state.catBond===0?'Pet the cat':state.catBond===1?'Offer a little treat':'Play a little yarn';
  if(f.userData.type==='finale')l=state.stars.size<12?`Castle heart · ${state.stars.size}/12 stars`:state.catBond<3?'Bring your friend along':'Open the surprise';
  ui.interactLabel.textContent=l;ui.interactIcon.textContent=f.userData.type==='star'?'✦':f.userData.type==='finale'?'♡':'✧';ui.interact.hidden=false;}

ui.interactButton.addEventListener('click',()=>interact());ui.touchAction.addEventListener('click',()=>interact());

/* ========================================================================
   INPUT: KEYBOARD, JOYSTICK, CAMERA ORBIT
   ======================================================================== */
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  moveKeys.add(e.key.toLowerCase());if(e.key.toLowerCase()==='e'||e.key==='Enter')interact();
  if(e.key==='Escape'){closeModal();ui.soundPanel.hidden=true;}});
window.addEventListener('keyup',e=>moveKeys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>moveKeys.clear());

let joyPtr=null;
ui.joystick.addEventListener('pointerdown',e=>{joyPtr=e.pointerId;ui.joystick.setPointerCapture(e.pointerId);moveJoy(e);});
ui.joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyPtr)moveJoy(e);});
function moveJoy(e){const r=ui.joystick.getBoundingClientRect();const dx=e.clientX-(r.left+r.width*.5),dy=e.clientY-(r.top+r.height*.5);
  const mx=36,rd=Math.hypot(dx,dy),cd=Math.min(rd,mx),a=Math.atan2(dy,dx);
  ui.joyKnob.style.left=`calc(50% + ${Math.cos(a)*cd}px)`;ui.joyKnob.style.top=`calc(50% + ${Math.sin(a)*cd}px)`;
  const n=rd/mx,dz=0.15;if(n<dz)joyVec.set(0,0);else{const s=Math.min(1,(n-dz)/(1-dz));joyVec.set(Math.cos(a)*s,-Math.sin(a)*s);}}
function clearJoy(){joyPtr=null;joyVec.set(0,0);ui.joyKnob.style.left='50%';ui.joyKnob.style.top='50%';}
ui.joystick.addEventListener('pointerup',clearJoy);ui.joystick.addEventListener('pointercancel',clearJoy);

const ray=new THREE.Raycaster(),pNdc=new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.target.closest('.touch-controls'))return;
  ptrDown={x:e.clientX,y:e.clientY,id:e.pointerId,t:performance.now()};drag={x:e.clientX,y:e.clientY,id:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;
  cameraYaw-=(e.clientX-drag.x)*0.0055;cameraPitch=Math.max(0.12,Math.min(0.85,cameraPitch+(e.clientY-drag.y)*0.004));drag.x=e.clientX;drag.y=e.clientY;});
renderer.domElement.addEventListener('pointerup',e=>{if(!ptrDown||ptrDown.id!==e.pointerId)return;
  const mv=Math.hypot(e.clientX-ptrDown.x,e.clientY-ptrDown.y),el=performance.now()-ptrDown.t;
  if(mv<8&&el<400){pNdc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(pNdc,camera);
    const hits=ray.intersectObjects(interactables.filter(o=>o.visible),true);
    if(hits.length){let o=hits[0].object;while(o&&!interactables.includes(o))o=o.parent;
      if(o){const p=new THREE.Vector3();o.getWorldPosition(p);if(Math.hypot(state.pos.x-p.x,state.pos.z-p.z)<7.5)interact(o);else showToast('Wander a little closer first ✧');}}}
  drag=null;ptrDown=null;});
renderer.domElement.addEventListener('wheel',e=>{cameraDist=Math.max(6,Math.min(24,cameraDist+Math.sign(e.deltaY)*1.15));},{passive:true});

/* ========================================================================
   PLAYER MOVEMENT (Camera-relative, smooth accel/decel, walk cycle)
   ======================================================================== */
let walkCycle=0;
function updatePlayer(dt,t){
  let ix=0,iz=0;
  if(moveKeys.has('w')||moveKeys.has('arrowup'))iz+=1;if(moveKeys.has('s')||moveKeys.has('arrowdown'))iz-=1;
  if(moveKeys.has('a')||moveKeys.has('arrowleft'))ix-=1;if(moveKeys.has('d')||moveKeys.has('arrowright'))ix+=1;
  ix+=joyVec.x;iz+=joyVec.y;
  const il=Math.hypot(ix,iz);let tSpd=0;const tDir=new THREE.Vector3();
  if(il>0.05){const nl=Math.min(1,il),nx=ix/il,nz=iz/il;
    const fwd=new THREE.Vector3(-Math.sin(cameraYaw),0,-Math.cos(cameraYaw));
    const rt=new THREE.Vector3(Math.cos(cameraYaw),0,-Math.sin(cameraYaw));
    tDir.copy(fwd.multiplyScalar(nz).add(rt.multiplyScalar(nx))).normalize();tSpd=nl*7.5;}
  const tVel=tDir.clone().multiplyScalar(tSpd);
  state.vel.lerp(tVel,1-Math.exp(-dt*(tSpd>0.1?14:11)));
  state.pos.x+=state.vel.x*dt;state.pos.z+=state.vel.z*dt;
  resolveCollisions(state.pos,state.vel);
  state.pos.y=getTerrainHeight(state.pos.x,state.pos.z);
  const spd=Math.hypot(state.vel.x,state.vel.z);
  if(spd>0.15){let diff=Math.atan2(state.vel.x,state.vel.z)-state.heading;
    while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;state.heading+=diff*(1-Math.exp(-dt*15));}
  playerG.position.set(state.pos.x,state.pos.y,state.pos.z);avatar.rotation.y=state.heading;
  const mv=spd>0.15;if(mv)walkCycle+=spd*dt*1.5;
  avatar.position.y=mv?Math.abs(Math.sin(walkCycle*4.5))*0.08:Math.sin(t*2.2)*0.024;
  legs[0].rotation.x=mv?Math.sin(walkCycle*4.5)*0.65:0;legs[1].rotation.x=mv?Math.sin(walkCycle*4.5+Math.PI)*0.65:0;
  armL.rotation.x=mv?Math.sin(walkCycle*4.5+Math.PI)*0.45:Math.sin(t*2)*0.035;armR.rotation.x=mv?Math.sin(walkCycle*4.5)*0.45:Math.sin(t*2+1)*0.035;
  scarfT.rotation.x=0.25+(mv?Math.sin(walkCycle*9)*0.2+spd*0.04:Math.sin(t*2)*0.05);
  const reg=regions.find(r=>Math.hypot(state.pos.x-r.x,state.pos.z-r.z)<r.r)||regions[0];
  if(ui.region.textContent!==reg.name){ui.region.textContent=reg.name;ui.regionNote.textContent=reg.note;}
}

/* ========================================================================
   CAT AI
   ======================================================================== */
function updateCat(dt,t){
  catS.timer=Math.max(0,catS.timer-dt);
  if(catS.mode==='idle'&&catS.timer===0){catS.timer=3.5+Math.random()*4.5;
    catS.target.set(catS.base.x+(Math.random()-.5)*5,0,catS.base.z+(Math.random()-.5)*5);catS.mode='wander';}
  const isF=catS.follow&&catS.mode!=='purr'&&catS.mode!=='play';
  if(isF||catS.mode==='follow'){const dp=Math.hypot(catG.position.x-state.pos.x,catG.position.z-state.pos.z);
    if(dp>3.6){catS.target.set(state.pos.x,state.pos.y,state.pos.z);catS.mode='follow';}
    else if(catS.mode==='follow'&&dp<2.5){catS.mode='idle';catS.timer=1.8;}}
  if(['wander','follow','play'].includes(catS.mode)){
    const d=new THREE.Vector3(catS.target.x-catG.position.x,0,catS.target.z-catG.position.z),dl=d.length();
    if(dl>0.45){d.normalize();catG.position.addScaledVector(d,dt*(catS.mode==='follow'?3:1.35));catG.rotation.y=Math.atan2(d.x,d.z);
      catS.step+=dt*9;catLegs.forEach((l,i)=>{l.rotation.x=Math.sin(catS.step+(i%2)*Math.PI+(i>1?Math.PI:0))*0.45;});}
    else if(catS.mode==='wander'){catS.mode='idle';catS.timer=2;}}
  else if(catS.timer===0){catS.mode=catS.follow?'follow':'idle';catS.timer=catS.follow?0:2;}
  catG.position.y=getTerrainHeight(catG.position.x,catG.position.z);
  catBody.scale.y=0.74+(catS.mode==='purr'?Math.sin(t*24)*0.07:0);
  catHead.position.y=0.96+Math.sin(t*3)*0.025+(catS.mode==='snack'?0.14*Math.sin(t*10):0);
  catTail.rotation.x=Math.sin(t*2.8)*0.28;catTail.rotation.z=Math.sin(t*2.2)*0.16;
  if(catS.mode==='play'){catG.position.x+=Math.sin(t*8)*dt*0.7;catG.position.z+=Math.cos(t*8)*dt*0.7;catG.rotation.y=t*2.2;}
}

/* ========================================================================
   AMBIENT ANIMATION LOOP (Stars, Petals, Fireflies, Animated Props)
   ======================================================================== */
function updateAmbient(dt,t){
  // Stars
  for(const s of starObjects){if(s.holder.visible){s.holder.position.y=s.baseY+Math.sin(t*2.2+s.phase)*0.24;s.gem.rotation.y+=dt*1.2;s.gem.rotation.z=Math.sin(t*1.8+s.phase)*0.14;
    if(Math.hypot(state.pos.x-s.holder.position.x,state.pos.z-s.holder.position.z)<1.7)interact(s.holder);}}
  // Animated items
  for(let i=animated.length-1;i>=0;i--){const a=animated[i];
    if(a.kind==='float')a.mesh.position.y+=Math.sin(t*2.2+a.phase)*0.0035;
    else if(a.kind==='orbit'){const ang=t*0.55+a.phase;a.mesh.position.set(a.center[0]+Math.cos(ang)*4.5,a.center[1]+Math.sin(t*2.2+ang)*0.2,a.center[2]+Math.sin(ang)*4.5);}
    else if(a.kind==='sway')a.mesh.rotation.z=Math.sin(t*2+a.phase)*0.25;
    else if(a.kind==='pulse')a.mesh.scale.setScalar(0.8+Math.sin(t*3+a.phase)*0.3);
    else if(a.kind==='burst'){a.life-=dt;a.mesh.position.y+=dt*1.6;if(a.mesh.material.opacity!==undefined)a.mesh.material.opacity=Math.max(0,a.life/3.2);
      if(a.life<=0){scene.remove(a.mesh);animated.splice(i,1);}}}
  // Flora sway
  for(const p of floraAnim)p.mesh.position.y=p.baseY+Math.sin(t*2.3+p.phase)*0.025;

  // 🌸 Cherry blossom petals
  for(const p of cherryPetals){
    p.mesh.position.x+=p.vx*dt+Math.sin(t*1.5+p.phase)*dt*0.35;
    p.mesh.position.y+=p.vy*dt;
    p.mesh.position.z+=p.vz*dt+Math.cos(t*1.2+p.phase)*dt*0.25;
    p.mesh.rotation.x+=p.rSpd*dt;p.mesh.rotation.z+=p.rSpd*0.7*dt;
    if(p.mesh.position.y<-2){p.mesh.position.set((Math.random()-.5)*90,18+Math.random()*10,(Math.random()-.5)*90);}
  }
  // ✨ Fireflies
  for(const f of fireflies){
    f.mesh.position.x=f.base.x+Math.sin(t*f.speed+f.phase)*2.5;
    f.mesh.position.y=f.base.y+Math.sin(t*f.speed*1.3+f.phase)*0.9;
    f.mesh.position.z=f.base.z+Math.cos(t*f.speed*0.8+f.phase)*2.5;
    f.mesh.material.opacity=0.35+Math.sin(t*3+f.phase)*0.45;
    f.mesh.scale.setScalar(0.7+Math.sin(t*4+f.phase)*0.4);
  }
  // Sea gentle bob
  seaMesh.position.y=-1.2+Math.sin(t*0.6)*0.08;
}

/* ========================================================================
   MAIN RENDER LOOP
   ======================================================================== */
let last=performance.now(),elapsed=0,saveTick=0;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(0.045,(now-last)/1000);last=now;elapsed+=dt;
  updatePlayer(dt,elapsed);updateCat(dt,elapsed);updateAmbient(dt,elapsed);updateCamera(dt);updateUI();
  saveTick+=dt;if(saveTick>5){saveTick=0;persist();}
  renderer.render(scene,camera);}
requestAnimationFrame(frame);

setTimeout(()=>ui.loading.classList.add('done'),500);
if(innerWidth<=700)document.body.classList.add('mobile');
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  document.body.classList.toggle('mobile',innerWidth<=700);});
