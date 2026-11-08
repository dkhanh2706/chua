import * as THREE from 'three';
import {ENTRANCE} from './entrance-layout.mjs';
import {buildRoofFrame} from './roof-frame.mjs';
import {addNightLight,addLightPool} from './night-lights.mjs';

export function buildEntranceGate(parent,{roof}){
  const root=new THREE.Group();root.name='tam-quan-entrance';root.position.z=ENTRANCE.z;parent.add(root);
  const materials=new Map(),cube=new THREE.BoxGeometry(1,1,1);
  const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82}));return materials.get(color);};
  function mesh(geometry,color,x,y,z){const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
  function box(x,y,z,w,h,d,color){const m=mesh(cube,color,x,y,z);m.scale.set(w,h,d);return m;}
  function column(x,y,z,r1,r2,h,color){return mesh(new THREE.CylinderGeometry(r1,r2,h,12),color,x,y,z);}
  function brace(a,b){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const m=mesh(new THREE.CylinderGeometry(.12,.12,delta.length(),8),'#916845',...start.add(end).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}
  const stone='#c8c4ad',trim='#a6a68e',wood='#754b34',gold='#b99854';
  // Four substantial piers frame a generous central passage and two side doors.
  for(const x of [-ENTRANCE.outerPier,-ENTRANCE.innerPier,ENTRANCE.innerPier,ENTRANCE.outerPier]){
    const inner=Math.abs(x)===ENTRANCE.innerPier,top=inner?8.15:5.95;
    box(x,.18,0,1.65,.36,1.85,trim);box(x,.48,0,1.38,.24,1.58,stone);
    box(x,1.1,0,1.12,1,1.28,stone);box(x,1.64,0,1.26,.14,1.42,trim);
    column(x,(1.7+top)/2,0,.37,.43,top-1.7,wood);
    for(const y of [1.85,top-.24])column(x,y,0,.46,.46,.12,gold);
    box(x,top,0,1.05,.26,1.2,wood);
    for(const side of [-1,1])brace([x,top-1.35,0],[x+side*.95,top-.05,0]);
  }
  const roofs=new THREE.Group();roofs.name='entrance-roofs';root.add(roofs);
  function canopy(x,width,depth,base,height,columns){
    const g=roof(roofs,x,0,width,depth,base,height,'#526b60');
    buildRoofFrame(g,{width,depth,base,height,columnTop:base,columns,plateWidth:width*.82});return g;
  }
  canopy(0,16.7,6.2,8.15,2.15,[{x:-6,z:0},{x:6,z:0}]);
  // A small upper pavilion gives the main opening a recognisable temple silhouette.
  box(0,10.75,0,7.1,1.45,1.8,'#d9d1b5');
  for(const z of [-.94,.94]){
    box(0,10.75,z,7.35,.13,.14,gold);
    for(const x of [-3.35,3.35])box(x,10.75,z,.16,1.42,.14,wood);
    for(const x of [-1.1,0,1.1])box(x,10.8,z,.18,.68,.12,wood);
  }
  canopy(0,10.5,4.4,11.35,1.55,[{x:-3.3,z:0},{x:3.3,z:0}]);
  for(const side of [-1,1]){
    const x=side*8.5;
    box(x,5.85,0,5.1,.34,.6,wood);
    canopy(x,7.1,4.8,5.95,1.75,[{x:-2.5,z:0},{x:2.5,z:0}]);
    for(const z of [-1.1,1.1]){
      const lantern=column(x,4.8,z,.35,.35,.75,'#e9c282');
      lantern.material=lantern.material.clone();lantern.material.emissive=new THREE.Color('#ffc678');lantern.material.userData.nightEmission=1.8;
      box(x,5.25,z,.64,.13,.64,wood);box(x,4.38,z,.54,.1,.54,gold);
      for(const dx of [-.23,.23])box(x+dx,4.8,z,.045,.76,.48,wood);
    }
    addNightLight(root,x,4.6,0,48,12);addLightPool(root,x,.04,0,3.4);
  }
  // A real, double-sided sign stays attached to the lintel in every camera view.
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#354d43';ctx.fillRect(0,0,1024,256);
  ctx.strokeStyle='#c6aa68';ctx.lineWidth=10;ctx.strokeRect(15,15,994,226);
  ctx.lineWidth=2;ctx.strokeRect(29,29,966,198);
  ctx.font='600 98px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f0db9f';ctx.fillText('AN NHIÊN',512,135);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  for(const side of [-1,1]){
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.6,1.4),new THREE.MeshStandardMaterial({map:texture,roughness:.8}));
    sign.position.set(0,7.25,side*.53);sign.rotation.y=side===1?0:Math.PI;root.add(sign);
  }
  box(0,7.25,0,5.85,1.65,1,wood);box(0,8.05,0,12.8,.3,.8,wood);
  roofs.traverse(o=>{if(o.material)o.material=o.material.clone();});
  return {root,roofs};
}
