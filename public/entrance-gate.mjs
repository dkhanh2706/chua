import * as THREE from 'three';
import {ENTRANCE} from './entrance-layout.mjs';
import {buildRoofFrame} from './roof-frame.mjs';
import {addNightLight,addLightPool} from './night-lights.mjs';

// Gold lettering on dark lacquered wood, painted once into a texture.
function signTexture(text){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=400;
  const g=canvas.getContext('2d');
  g.fillStyle='#4a2f1f';g.fillRect(0,0,2048,400);
  const grain=g.createLinearGradient(0,0,0,400);grain.addColorStop(0,'#ffffff14');grain.addColorStop(.5,'#00000012');grain.addColorStop(1,'#ffffff0d');g.fillStyle=grain;g.fillRect(0,0,2048,400);
  g.strokeStyle='#c7a565';g.lineWidth=10;g.strokeRect(28,28,1992,344);g.lineWidth=3;g.strokeRect(46,46,1956,308);
  g.textAlign='center';g.textBaseline='middle';
  let size=230;g.font=`700 ${size}px "Times New Roman",Georgia,serif`;
  while(g.measureText(text).width>1820&&size>60){size-=6;g.font=`700 ${size}px "Times New Roman",Georgia,serif`;}
  g.shadowColor='#00000099';g.shadowBlur=10;g.shadowOffsetY=6;g.fillStyle='#e8c46a';g.fillText(text,1024,212);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}
export const GATE_SIGN_TEXT='KHU TỰ TRỊ PHÚ GIÁO';
function buildGateSign(root,wood,gold){
  const sign=new THREE.Group();sign.name='phu-giao-sign';root.add(sign);
  const width=5.1,height=1.0,y=7.2,z=.68;
  const frame=new THREE.Mesh(new THREE.BoxGeometry(width+.16,height+.16,.12),new THREE.MeshStandardMaterial({color:wood,roughness:.8}));
  frame.position.set(0,y,z);frame.castShadow=true;sign.add(frame);
  if(typeof document!=='undefined'){
    const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map:signTexture(GATE_SIGN_TEXT),roughness:.7}));
    face.position.set(0,y,z+.062);face.name='phu-giao-sign-face';sign.add(face);
  }
  // Two gilded hangers carry the board from the lintel.
  for(const x of [-width/2+.35,width/2-.35]){
    const hanger=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.4,6),new THREE.MeshStandardMaterial({color:gold,roughness:.5}));
    hanger.position.set(x,y+height/2+.2,z);sign.add(hanger);
  }
}

export function buildEntranceGate(parent,{roof}){
  const root=new THREE.Group();root.name='tam-quan-entrance';root.position.z=ENTRANCE.z;parent.add(root);
  const materials=new Map(),cube=new THREE.BoxGeometry(1,1,1);
  const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82}));return materials.get(color);};
  function mesh(parent,geometry,color,x,y,z){const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(parent,x,y,z,w,h,d,color){const m=mesh(parent,cube,color,x,y,z);m.scale.set(w,h,d);return m;}
  function beam(parent,a,b,width,color){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const m=box(parent,...start.add(end).multiplyScalar(.5).toArray(),width,delta.length(),width,color);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
  const stone='#e5d9bd',inset='#cfc0a0',base='#aaa58f',wood='#62432e',gold='#c7a565';
  // Pale masonry outlines all three passages, with the same walkable openings.
  const piers=new THREE.Group();piers.name='ivory-entrance-piers';root.add(piers);
  for(const x of [-ENTRANCE.outerPier,-ENTRANCE.innerPier,ENTRANCE.innerPier,ENTRANCE.outerPier]){
    const inner=Math.abs(x)===ENTRANCE.innerPier,top=inner?8.15:5.95;
    box(piers,x,.16,0,1.6,.32,1.8,base);
    box(piers,x,.4,0,1.38,.16,1.58,stone);
    box(piers,x,.9,0,1.17,.85,1.38,stone);
    box(piers,x,1.36,0,1.3,.14,1.5,inset);
    box(piers,x,(1.43+top-.46)/2,0,.96,top-.46-1.43,1.12,stone);
    for(const side of [-1,1]){
      box(piers,x,(2.05+top-1.05)/2,side*.57,.58,top-3.1,.025,inset);
      box(piers,x,(2.05+top-1.05)/2,side*.59,.43,top-3.23,.025,stone);
      beam(piers,[x,top-1.18,side*.44],[x-Math.sign(x)*.95,top-.08,side*.44],.16,wood);
    }
    box(piers,x,top-.36,0,1.12,.18,1.28,inset);
    box(piers,x,top-.16,0,1.4,.22,1.56,stone);
    box(piers,x,top+.015,0,1.46,.13,1.62,wood);
  }
  const roofs=new THREE.Group();roofs.name='entrance-roofs';root.add(roofs);
  function canopy(x,width,depth,baseHeight,height,columns){
    const g=roof(roofs,x,0,width,depth,baseHeight,height,'#95614b');
    g.traverse(o=>{if(o.isLineSegments){o.material.color.set('#694e3b');o.material.opacity=.28;}});
    buildRoofFrame(g,{width,depth,base:baseHeight,height,columnTop:baseHeight,columns,plateWidth:width*.82});return g;
  }
  // Slim paired lintels keep the centre open instead of filling it with a sign.
  for(const z of [-.51,.51]){
    box(root,0,7.92,z,12.9,.34,.28,wood);
    box(root,0,8.13,z,13.2,.08,.34,gold);
  }
  buildGateSign(root,wood,gold);
  canopy(0,16.7,6.2,8.15,2.15,[{x:-6,z:0},{x:6,z:0}]);
  const crown=new THREE.Group();crown.name='open-lotus-gate-crown';root.add(crown);
  box(crown,0,10.5,0,7.05,.22,1.9,stone);
  for(const x of [-3.3,3.3])box(crown,x,10.95,0,.28,.86,1.7,stone);
  for(const z of [-.83,.83]){
    box(crown,0,11.32,z,6.8,.16,.15,wood);
    for(const x of [-2.6,-1.95,1.95,2.6])box(crown,x,10.95,z,.09,.7,.09,wood);
    // A small lotus silhouette gives the pavilion a centre without lettering.
    const emblem=new THREE.Group();emblem.name='gate-lotus-medallion';emblem.position.set(0,10.92,z);crown.add(emblem);
    const petals=new THREE.SphereGeometry(1,12,8);
    for(let i=-2;i<=2;i++){
      const petal=mesh(emblem,petals,gold,i*.21,.05-Math.abs(i)*.04,0);
      petal.scale.set(.14,.38,.055);petal.rotation.z=-i*.43;
    }
    box(emblem,0,-.27,0,1.1,.07,.12,gold);
  }
  canopy(0,9.5,4.6,11.35,1.5,[{x:-3.3,z:0},{x:3.3,z:0}]);
  for(const side of [-1,1]){
    const x=side*8.5;
    for(const z of [-.51,.51])box(root,x,5.81,z,5.15,.28,.28,wood);
    canopy(x,7.1,4.8,5.95,1.75,[{x:-2.5,z:0},{x:2.5,z:0}]);
    for(const z of [-1.05,1.05]){
      const lantern=new THREE.Group();lantern.name='warm-gate-lantern';root.add(lantern);
      beam(lantern,[x,5.73,z],[x,5.22,z],.045,wood);
      const glow=mesh(lantern,new THREE.CylinderGeometry(.27,.32,.7,8),'#f2d6a1',x,4.85,z);
      glow.material=glow.material.clone();glow.material.emissive=new THREE.Color('#ffc678');glow.material.userData.nightEmission=1.8;
      box(lantern,x,5.23,z,.68,.1,.68,wood);box(lantern,x,4.46,z,.57,.1,.57,wood);
      for(const dx of [-.24,.24])for(const dz of [-.24,.24])beam(lantern,[x+dx,4.49,z+dz],[x+dx*.84,5.19,z+dz*.84],.035,wood);
      beam(lantern,[x,4.4,z],[x,4.14,z],.045,gold);
    }
    addNightLight(root,x,4.6,0,48,12);addLightPool(root,x,.04,0,3.4);
  }
  roofs.traverse(o=>{if(o.material)o.material=o.material.clone();});
  return {root,roofs};
}
