import * as THREE from 'three';
import {makeTreeLayout,seededRandom,fallingLeafPose} from './garden-layout.mjs';

const TAU=Math.PI*2,UP=new THREE.Vector3(0,1,0);
const PALETTES=[['#28744a','#398b51','#55a75e','#75bb75'],['#387d43','#4b9850','#6ab05f','#88c477'],['#256f50','#378b60','#53a86d','#7fbd86']];

export function makeLeafGeometry(species=0){
  const positions=[],uvs=[],colors=[],indices=[],rows=9;
  for(let i=0;i<=rows;i++){
    const t=i/rows;
    let width=species===0?.34*Math.sin(Math.PI*Math.pow(t,.63))**.75:species===1?.32*Math.sin(Math.PI*t)**.7*(.75+.25*Math.cos(t*Math.PI*8)):.18*Math.sin(Math.PI*t)**.7;
    width=Math.max(.001,width);
    for(let side=-1;side<=1;side++){
      positions.push(side*width,t,.055*Math.sin(Math.PI*t)*(side===0?1:-.25));uvs.push((side+1)/2,t);colors.push(side===0?.95:.84,side===0?1:.94,side===0?.85:.73);
    }
    if(i<rows){const a=i*3;indices.push(a,a+3,a+1,a+1,a+3,a+4,a+1,a+4,a+2,a+2,a+4,a+5);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function leafTexture(){
  const width=64,height=128,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=(x+.5)/width,v=(y+.5)/height,side=Math.abs(u-.5);
    let vein=side<.014;
    for(let branch=1;branch<8;branch++)if(Math.abs(v-(branch/9+side*.55))<.009)vein=true;
    const cells=Math.sin(u*130+Math.sin(v*40))*Math.sin(v*155)*3;
    const value=Math.round((vein?251:219-side*24)+cells),i=(y*width+x)*4;
    data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255;
  }
  const map=new THREE.DataTexture(data,width,height);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
}
function barkTexture(){
  const width=64,height=128,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const grain=Math.sin(x*.9+Math.sin(y*.09)*.65)+Math.sin(x*2.1+y*.03)*.25;
    const knots=Math.sin(Math.hypot((x-31)*1.7,(y-64)*.5)*.8)*Math.exp(-((x-31)**2/80+(y-64)**2/380));
    const value=Math.round(213+grain*15+knots*10),i=(y*width+x)*4;data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255;
  }
  const map=new THREE.DataTexture(data,width,height);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
}

export class TempleGarden{
  constructor(parent,{batterySaver=false,groundHeight=()=>0}={}){
    this.root=new THREE.Group();this.root.name='detailed-garden';parent.add(this.root);this.layout=makeTreeLayout();this.trees=[];this.birds=[];this.audioSources=[];this.fallBatches=[];this.wind={value:0};this.groundHeight=groundHeight;
    this.dummy=new THREE.Object3D();this.matrix=new THREE.Matrix4();this.color=new THREE.Color();this.branchTransforms=[];this.crownTransforms=[];this.leafMap=leafTexture();this.barkMap=barkTexture();this.geometries=[0,1,2].map(makeLeafGeometry);
    this.material=new THREE.MeshStandardMaterial({map:this.leafMap,roughness:.94,side:THREE.DoubleSide,vertexColors:true});
    this.material.onBeforeCompile=shader=>{
      shader.uniforms.uGardenTime=this.wind;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uGardenTime;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float gardenSeed = 0.0;
        #ifdef USE_INSTANCING
          gardenSeed = instanceMatrix[3].x * 0.51 + instanceMatrix[3].z * 0.37;
        #endif
        transformed.z += sin(uGardenTime * 1.15 + gardenSeed + uv.y * 2.5) * 0.055 * uv.y;
        transformed.x += sin(uGardenTime * 0.85 + gardenSeed) * 0.03 * uv.y * uv.y;
      `);
    };
    this.material.customProgramCacheKey=()=> 'garden-leaf-wind-v1';
    this.branchGeometry=new THREE.CylinderGeometry(.72,1,1,9);this.branchMaterial=new THREE.MeshStandardMaterial({map:this.barkMap,roughness:1,color:'#80694d'});
    for(const tree of this.layout)this.buildTree(tree);
    const crownGeo=new THREE.SphereGeometry(1,16,10),crownPoints=crownGeo.attributes.position;
    for(let i=0;i<crownPoints.count;i++){const x=crownPoints.getX(i),y=crownPoints.getY(i),z=crownPoints.getZ(i),r=1+.07*Math.sin(x*4+y*3)*Math.cos(z*4-y*2);crownPoints.setXYZ(i,x*r,y*r,z*r);}crownGeo.computeVertexNormals();
    this.crowns=new THREE.InstancedMesh(crownGeo,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95}),this.crownTransforms.length);this.crowns.name='lush-green-tree-crowns';
    this.crownTransforms.forEach((c,i)=>{this.dummy.position.copy(c.position);this.dummy.quaternion.identity();this.dummy.scale.set(c.radius,c.radius*.74,c.radius*.92);this.dummy.updateMatrix();this.crowns.setMatrixAt(i,this.dummy.matrix);this.crowns.setColorAt(i,new THREE.Color(c.color));});
    this.crowns.castShadow=true;this.crowns.receiveShadow=true;this.crowns.computeBoundingSphere();this.root.add(this.crowns);
    this.branches=new THREE.InstancedMesh(this.branchGeometry,this.branchMaterial,this.branchTransforms.length);this.branches.name='bark-and-branches';
    this.branchTransforms.forEach((t,i)=>{this.dummy.position.copy(t.center);this.dummy.quaternion.copy(t.quaternion);this.dummy.scale.set(t.radius,t.length,t.radius);this.dummy.updateMatrix();this.branches.setMatrixAt(i,this.dummy.matrix);this.branches.setColorAt(i,new THREE.Color(t.tint));});
    this.branches.castShadow=true;this.branches.receiveShadow=true;this.branches.computeBoundingSphere();this.root.add(this.branches);
    this.buildFallingLeaves();this.buildBirds();this.setQuality(batterySaver);this.update(0);
  }
  branch(a,b,radius,tint='#ffffff'){
    const delta=b.clone().sub(a);this.branchTransforms.push({center:a.clone().add(b).multiplyScalar(.5),quaternion:new THREE.Quaternion().setFromUnitVectors(UP,delta.clone().normalize()),length:delta.length(),radius,tint});
  }
  buildTree(tree){
    const random=seededRandom(tree.seed),leaves=[],perches=[],h=tree.height,r=tree.radius;
    const trunkPoint=y=>new THREE.Vector3(tree.x+Math.sin(y/h*2.2)*.28,y,tree.z+Math.sin(y/h*1.5)*.18);
    const trunkPositions=[],trunkUV=[],trunkIndices=[],rows=14,sides=16;
    for(let row=0;row<=rows;row++){
      const t=row/rows,p=trunkPoint(t*h*.86),radius=.46*(1-t*.77);
      for(let j=0;j<=sides;j++){const a=j/sides*TAU,grain=1+Math.sin(a*5+t*3)*.035;trunkPositions.push(p.x+Math.cos(a)*radius*grain,p.y,p.z+Math.sin(a)*radius*grain);trunkUV.push(j/sides*1.3,t*2.1);}
      if(row<rows)for(let j=0;j<sides;j++){const a=row*(sides+1)+j,b=a+sides+1;trunkIndices.push(a,b,a+1,b,b+1,a+1);}
    }
    const trunkGeo=new THREE.BufferGeometry();trunkGeo.setAttribute('position',new THREE.Float32BufferAttribute(trunkPositions,3));trunkGeo.setAttribute('uv',new THREE.Float32BufferAttribute(trunkUV,2));trunkGeo.setIndex(trunkIndices);trunkGeo.computeVertexNormals();
    const trunk=new THREE.Mesh(trunkGeo,this.branchMaterial);trunk.name=tree.id+'-continuous-trunk';trunk.castShadow=true;trunk.receiveShadow=true;this.root.add(trunk);
    for(let i=0;i<6;i++){const a=i/6*TAU;this.branch(new THREE.Vector3(tree.x+Math.cos(a)*.85,.02,tree.z+Math.sin(a)*.85),trunkPoint(.8),.2,'#e5e3d5');}
    const primary=8;
    for(let i=0;i<primary;i++){
      const angle=i/primary*TAU+random()*.5,level=.56+random()*.28;
      const start=trunkPoint(h*(.37+random()*.25));
      const end=new THREE.Vector3(tree.x+Math.cos(angle)*r*.57,h*level+.6,tree.z+Math.sin(angle)*r*.57);this.branch(start,end,.15,'#f0e7d5');perches.push(start.clone().lerp(end,.72));
      this.crownTransforms.push({position:end.clone().add(new THREE.Vector3(0,.55,0)),radius:r*.32,color:PALETTES[tree.species][i%3]});
      for(let j=0;j<4;j++){
        const a=angle+(j-1.5)*.43,reach=r*(.32+random()*.2);
        const tip=end.clone().add(new THREE.Vector3(Math.cos(a)*reach,.8+random()*.9,Math.sin(a)*reach));this.branch(end,tip,.065,'#ebdfca');
        if(j%2===0)this.crownTransforms.push({position:end.clone().lerp(tip,.68),radius:r*.30,color:PALETTES[tree.species][1+j]});
        for(let k=0;k<3;k++){
          const b=a+(k-1)*.63,origin=end.clone().lerp(tip,.45+k*.24);
          const twig=origin.clone().add(new THREE.Vector3(Math.cos(b)*.8,tree.species===2?-.55:.32+random()*.4,Math.sin(b)*.8));this.branch(origin,twig,.025,'#d9c8a7');
          const axis=twig.clone().sub(origin).normalize(),across=new THREE.Vector3(-axis.z,0,axis.x);
          for(let pair=0;pair<3;pair++)for(const side of [-1,1]){
            const base=origin.clone().lerp(twig,.22+pair*.32),direction=axis.clone().multiplyScalar(.35).addScaledVector(across,side*.8).add(new THREE.Vector3(0,tree.species===2?-.4:.24,0)).normalize();
            const quaternion=new THREE.Quaternion().setFromUnitVectors(UP,direction);quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP,(random()-.5)*1.9));
            const size=(tree.species===2?.72:.60)+random()*.32;leaves.push({base,quaternion,size,color:PALETTES[tree.species][Math.floor(random()*4)]});
          }
        }
      }
    }
    // Shuffle once so lowering the instance count thins the whole crown evenly.
    for(let i=leaves.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[leaves[i],leaves[j]]=[leaves[j],leaves[i]];}
    const foliage=new THREE.InstancedMesh(this.geometries[tree.species],this.material,leaves.length);foliage.name=tree.id+'-individual-leaves';
    leaves.forEach((leaf,i)=>{this.dummy.position.copy(leaf.base);this.dummy.quaternion.copy(leaf.quaternion);this.dummy.scale.setScalar(leaf.size);this.dummy.updateMatrix();foliage.setMatrixAt(i,this.dummy.matrix);foliage.setColorAt(i,this.color.set(leaf.color));});
    foliage.castShadow=true;foliage.receiveShadow=true;foliage.computeBoundingSphere();foliage.boundingSphere.radius+=.2;this.root.add(foliage);
    const perch=perches[tree.seed%perches.length].clone();perch.y+=.2;
    this.trees.push({...tree,foliage,leaves,perch,trunk});
  }
  buildFallingLeaves(){
    const random=seededRandom(81721);
    for(let species=0;species<3;species++){
      const mesh=new THREE.InstancedMesh(this.geometries[species],this.material,24);mesh.name='falling-leaves-'+species;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;const leaves=[];
      for(let i=0;i<24;i++){
        const candidates=this.trees.filter(t=>t.species===species),tree=candidates[i%candidates.length],from=tree.leaves[Math.floor(random()*tree.leaves.length)].base;
        const fallTime=8+random()*7;leaves.push({x:from.x,y:from.y,z:from.z,fallTime,cycle:fallTime+3+random()*4,offset:random()*22,drift:.6+random()*2,crossDrift:(random()-.5)*1.8,seed:random()*TAU,size:.38+random()*.28});
        mesh.setColorAt(i,this.color.set(['#c4ad65','#b2ac6b','#96a367'][i%3]));
      }
      this.root.add(mesh);this.fallBatches.push({mesh,leaves});
    }
  }
  buildBirds(){
    const geometry=new THREE.SphereGeometry(1,12,8),dark=new THREE.MeshStandardMaterial({color:'#645e4e',roughness:1}),cream=new THREE.MeshStandardMaterial({color:'#d7c59b',roughness:1}),black=new THREE.MeshBasicMaterial({color:'#393b31'});
    for(let i=0;i<4;i++){
      const root=new THREE.Group(),head=new THREE.Group(),tree=this.trees[[7,9,11,4][i]];this.root.add(root);root.add(head);head.position.set(0,.13,.12);
      const part=(parent,material,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;};
      part(root,dark,0,.08,0,.16,.19,.27);part(root,cream,0,.035,.12,.13,.13,.17);part(head,dark,0,.06,.03,.14,.14,.14);
      for(const side of [-1,1])part(head,black,side*.115,.085,.1,.018,.022,.018);
      const beak=part(head,cream,0,.035,.2,.045,.035,.09),wings=[];
      for(const side of [-1,1]){const pivot=new THREE.Group();pivot.position.set(side*.13,.12,-.025);root.add(pivot);const wing=part(pivot,dark,side*.12,0,-.07,.16,.045,.21);wing.rotation.y=-side*.2;wings.push(pivot);}
      const tail=part(root,dark,0,.05,-.3,.09,.035,.18);tail.rotation.x=.25;
      for(const side of [-1,1])part(root,cream,side*.055,-.12,.04,.018,.085,.022);
      const source={id:'bird-'+i,position:{x:tree.perch.x,y:tree.perch.y,z:tree.perch.z},voice:['whistle','warble','chirp','whistle'][i]};
      root.position.copy(tree.perch);root.rotation.y=i*1.6;
      this.birds.push({root,head,beak,wings,tree,source,nextFlight:17+i*7,from:null,to:null,flightStart:0,singStart:0,singUntil:0});this.audioSources.push(source);
    }
  }
  sing(id,time,duration=1.4){const bird=this.birds.find(b=>b.source.id===id);if(bird){bird.singStart=time;bird.singUntil=time+duration;}}
  setQuality(batterySaver){this.batterySaver=batterySaver;for(const tree of this.trees)tree.foliage.count=Math.min(tree.leaves.length,batterySaver?320:620);for(const batch of this.fallBatches)batch.mesh.count=batterySaver?10:24;}
  update(time){
    this.wind.value=time;
    for(const batch of this.fallBatches){for(let i=0;i<batch.mesh.count;i++){
      const leaf=batch.leaves[i],sample=fallingLeafPose(leaf,time),height=this.groundHeight(sample.x*10+500,sample.z*10+350),pose=fallingLeafPose(leaf,time,height);
      this.dummy.position.set(pose.x,pose.y,pose.z);this.dummy.rotation.set(pose.rx,pose.ry,pose.rz);this.dummy.scale.setScalar(pose.scale);this.dummy.updateMatrix();batch.mesh.setMatrixAt(i,this.dummy.matrix);
    }batch.mesh.instanceMatrix.needsUpdate=true;}
    for(let i=0;i<this.birds.length;i++){
      const bird=this.birds[i],singing=time>=bird.singStart&&time<bird.singUntil;
      if(!bird.to&&time>bird.nextFlight&&time>bird.singUntil){bird.from=bird.root.position.clone();bird.tree=this.trees[(this.trees.indexOf(bird.tree)+5+i)%this.trees.length];bird.to=bird.tree.perch.clone();bird.flightStart=time;}
      if(bird.to){const p=Math.min(1,(time-bird.flightStart)/5.5);bird.root.position.lerpVectors(bird.from,bird.to,p);bird.root.position.y+=Math.sin(p*Math.PI)*3;bird.root.rotation.y=Math.atan2(bird.to.x-bird.from.x,bird.to.z-bird.from.z);bird.wings.forEach((w,j)=>w.rotation.z=(j?-1:1)*Math.sin(time*17)*.9);if(p===1){bird.to=null;bird.nextFlight=time+25+i*7;}}
      else{bird.wings.forEach((w,j)=>w.rotation.z=(j?-1:1)*.16);bird.head.rotation.y=Math.sin(time*.7+i)*.25;}
      bird.beak.scale.y=singing?.035+Math.max(0,Math.sin(time*27))*.035:.035;bird.head.rotation.x=singing?Math.sin(time*13)*.07:0;
      Object.assign(bird.source.position,{x:bird.root.position.x,y:bird.root.position.y,z:bird.root.position.z});
    }
  }
  dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();this.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material){materials.add(o.material);if(o.material.map)textures.add(o.material.map);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.root.removeFromParent();}
}
