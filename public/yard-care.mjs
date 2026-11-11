import * as THREE from 'three';
import {makeLeafGeometry} from './garden.mjs';
import {seededRandom} from './garden-layout.mjs';
import {RIGHT_HAND,BROOM_GRIP,BROOM_SCALE} from './broom-motion.mjs';
import {addNightLight,addLightPool} from './night-lights.mjs';
import {ENTRANCE_LIGHTS} from './entrance-layout.mjs';

const UP=new THREE.Vector3(0,1,0);
function add(parent,geometry,material,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const standard=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.8,...extra});

export function createBroom(){
  const root=new THREE.Group();root.name='bamboo-broom';
  const bamboo=standard('#aa7d44'),straw=standard('#a28b50'),binding=standard('#67553b');
  add(root,new THREE.CylinderGeometry(.032,.045,1.8,12),bamboo,0,1.55,0);
  for(const y of [.8,1.23,1.7,2.12])add(root,new THREE.CylinderGeometry(.043,.043,.035,12),binding,0,y,0);
  const bristles=new THREE.InstancedMesh(new THREE.CylinderGeometry(.012,.025,1,5),straw,34),dummy=new THREE.Object3D();
  for(let i=0;i<34;i++){
    const a=new THREE.Vector3((i%3-1)*.027,.73,0),b=new THREE.Vector3((i/33-.5)*.98,.035+(i%5)*.012,Math.sin(i*2.4)*.11),delta=b.clone().sub(a);
    dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(UP,delta.clone().normalize());dummy.scale.set(1,delta.length(),1);dummy.updateMatrix();bristles.setMatrixAt(i,dummy.matrix);
  }
  bristles.castShadow=true;bristles.computeBoundingSphere();root.add(bristles);
  for(const y of [.61,.67,.73])add(root,new THREE.CylinderGeometry(.08,.09,.03,12),binding,0,y,0,1,1,.75);
  return root;
}

export class YardCare{
  constructor(parent,garden,groundHeight){
    this.root=new THREE.Group();this.root.name='courtyard-care';parent.add(this.root);this.garden=garden;this.groundHeight=groundHeight;this.patches=new Map();this.carried=new Map();this.dummy=new THREE.Object3D();
    this.buildLights();this.buildRacks();
    this.leafMaterial=standard('#c1a46b',{side:THREE.DoubleSide});this.leafGeometry=makeLeafGeometry(0);
    this.leafStream=new THREE.InstancedMesh(this.leafGeometry,this.leafMaterial,window.TempleSweeping.LEAF_PATCHES.length*6);
    this.leafStream.name='continuous-falling-yard-leaves';this.leafStream.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.leafStream.frustumCulled=false;this.leafStream.count=0;this.root.add(this.leafStream);
  }
  buildLights(){
    this.lights=[];
    const metal=standard('#879394',{metalness:.65,roughness:.4}),dark=standard('#586162',{metalness:.45}),concrete=standard('#a9ab9c');
    const lens=standard('#f5e6ba',{emissive:'#ffdea0',emissiveIntensity:0});lens.userData.nightEmission=2.4;
    for(const {x,z} of ENTRANCE_LIGHTS){
      const pole=new THREE.Group();pole.name='vietnam-street-light';pole.position.set(x,0,z);pole.rotation.y=x>0?Math.PI:0;this.root.add(pole);this.lights.push(pole);
      add(pole,new THREE.BoxGeometry(.8,.25,.8),concrete,0,.125,0);
      add(pole,new THREE.CylinderGeometry(.3,.3,.08,16),metal,0,.29,0);
      for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])add(pole,new THREE.CylinderGeometry(.045,.045,.1,6),dark,Math.cos(a)*.23,.35,Math.sin(a)*.23);
      add(pole,new THREE.CylinderGeometry(.09,.18,7.9,16),metal,0,4.3,0);
      add(pole,new THREE.BoxGeometry(.17,.53,.045),dark,0,1.1,.17);
      const curve=new THREE.CatmullRomCurve3([[0,8.15,0],[.08,8.62,0],[.6,8.94,0],[1.65,9.05,0]].map(p=>new THREE.Vector3(...p)));
      add(pole,new THREE.TubeGeometry(curve,32,.085,10,false),metal);
      const lamp=add(pole,new THREE.SphereGeometry(1,24,12),dark,2.02,9.02,0,.9,.16,.38);lamp.rotation.z=-.06;
      add(pole,new THREE.BoxGeometry(1.3,.035,.5),lens,2.12,8.91,0);
      addNightLight(pole,2.12,8.6,0,108,24);
      addLightPool(pole,2.12,.026,0,7,.85);
      for(let i=0;i<5;i++)add(pole,new THREE.BoxGeometry(.055,.07,.48),metal,1.55+i*.2,9.15,0);
    }
  }
  buildRacks(){
    this.racks=[];const wood=standard('#725a3d'),iron=standard('#69726b');
    for(const rack of window.TempleSweeping.BROOM_RACKS){
      const root=new THREE.Group();root.name='broom-rack-'+rack.id;root.position.set((rack.x-500)/10,0,(rack.y-350)/10);this.root.add(root);this.racks.push(root);
      for(const side of [-1,1]){
        add(root,new THREE.CylinderGeometry(.065,.075,2.6,12),wood,side*.8,1.3,0);
        add(root,new THREE.BoxGeometry(.4,.1,.9),wood,side*.8,.05,0);
      }
      add(root,new THREE.BoxGeometry(1.85,.16,.16),wood,0,2.37,0);
      for(let i=-1;i<=1;i++){
        add(root,new THREE.TorusGeometry(.08,.018,6,12),iron,i*.5,2.23,.07);
        const broom=createBroom();broom.position.set(i*.5,.04,.18);broom.rotation.z=i*.055;root.add(broom);
      }
    }
  }
  setPatches(patches){
    for(const patch of patches){
      let entry=this.patches.get(patch.id);
      if(!entry){
        const random=seededRandom(910+patch.tree*13),leaves=[];
        for(let i=0;i<18;i++)leaves.push({x:(random()-.5)*1.75,z:(random()-.5)*1.35,angle:random()*Math.PI*2,size:.32+random()*.22,phase:random()});
        const mesh=new THREE.InstancedMesh(this.leafGeometry,this.leafMaterial,leaves.length);mesh.name=patch.id;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;
        leaves.forEach((leaf,i)=>mesh.setColorAt(i,new THREE.Color(['#c6a169','#a6965f','#cfb97c'][i%3])));mesh.receiveShadow=true;this.root.add(mesh);
        entry={mesh,leaves};this.patches.set(patch.id,entry);
      }
      entry.patch=patch;
    }
  }
  update(time,players,models,myId,first){
    const now=performance.now(),fallDuration=window.TempleSweeping.LEAF_FALL_DURATION/1000;let streamIndex=0;
    for(const {mesh,leaves,patch}of this.patches.values()){
      const remaining=(patch.readyAt-now)/1000,tree=this.garden.trees[patch.tree];
      // A staggered stream keeps falling even while a pile has just been swept.
      for(let i=0;i<6;i++){
        const leaf=leaves[i],cycle=3.2+leaf.phase*.8,t=(time/cycle+i/6+patch.tree*.137)%1;
        const origin=tree.leaves[(i*31)%tree.leaves.length].base;
        const x=(patch.x-500)/10+leaf.x,z=(patch.y-350)/10+leaf.z,ground=this.groundHeight(patch.x,patch.y)+.05;
        this.dummy.position.set(THREE.MathUtils.lerp(origin.x,x,t)+Math.sin(t*Math.PI*4+leaf.angle)*Math.sin(t*Math.PI)*.25,THREE.MathUtils.lerp(origin.y,ground,t),THREE.MathUtils.lerp(origin.z,z,t));
        this.dummy.rotation.set(-Math.PI/2+Math.sin(time*2+leaf.angle)*.7,leaf.angle+t*2,Math.sin(time+leaf.angle));
        this.dummy.scale.setScalar(leaf.size*Math.min(1,t*12,(1-t)*14));this.dummy.updateMatrix();this.leafStream.setMatrixAt(streamIndex++,this.dummy.matrix);
      }
      mesh.visible=remaining<=fallDuration;
      if(!mesh.visible)continue;
      leaves.forEach((leaf,i)=>{
        const t=THREE.MathUtils.clamp((fallDuration-Math.max(0,remaining))/(fallDuration*(.83+leaf.phase*.17)),0,1);
        const landed=remaining<=0,progress=landed?1:t;
        const x=(patch.x-500)/10+leaf.x,z=(patch.y-350)/10+leaf.z;
        const origin=tree.leaves[(i*23)%tree.leaves.length].base;
        this.dummy.position.set(THREE.MathUtils.lerp(origin.x,x,progress),THREE.MathUtils.lerp(origin.y,this.groundHeight(patch.x,patch.y)+.045+(i%3)*.006,progress),THREE.MathUtils.lerp(origin.z,z,progress));
        if(!landed){this.dummy.position.x+=Math.sin(time*2+leaf.angle)*Math.sin(progress*Math.PI)*.3;}
        this.dummy.rotation.set(-Math.PI/2,0,leaf.angle+(landed?0:Math.sin(time+leaf.angle)));this.dummy.scale.setScalar(leaf.size);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);
      });mesh.instanceMatrix.needsUpdate=true;
    }
    this.leafStream.count=streamIndex;this.leafStream.instanceMatrix.needsUpdate=true;
    const ids=new Set(players.map(p=>p.id));
    for(const [id,broom]of this.carried)if(!ids.has(id)){this.disposeBroom(broom);this.carried.delete(id);}
    for(const p of players){
      let broom=this.carried.get(p.id);
      if(!p.hasBroom){if(broom)broom.visible=false;continue;}
      if(!broom){broom=createBroom();this.root.add(broom);this.carried.set(p.id,broom);}
      broom.visible=!(p.id===myId&&first)&&p.action==='stand';if(!broom.visible)continue;
      const model=models.get(p.id);if(!model)continue;
      model.root.updateMatrixWorld(true);broom.position.set(0,-.08,.018);model.wrists[RIGHT_HAND].localToWorld(broom.position);
      model.body.getWorldQuaternion(broom.quaternion);broom.quaternion.multiply(model.broomQuaternion||new THREE.Quaternion());broom.scale.setScalar(BROOM_SCALE);
      const grip=new THREE.Vector3(0,BROOM_GRIP,0).applyQuaternion(broom.quaternion);broom.position.sub(grip);
    }
  }
  disposeBroom(broom){broom.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.geometry?.dispose();if(o.material)o.material.dispose();});broom.removeFromParent();}
}
