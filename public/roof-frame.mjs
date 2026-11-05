import * as THREE from 'three';

export function buildRoofFrame(parent,{width,depth,base,height,columnTop,columns,plateWidth=width*.84}){
  const root=new THREE.Group();root.name='connected-timber-roof-frame';parent.add(root);
  const timber=[],brackets=[],up=new THREE.Vector3(0,1,0);
  const heightAt=(x,z)=>{const t=THREE.MathUtils.clamp(Math.min(2*(1-Math.abs(x)/(width/2)),1-Math.abs(z)/(depth/2)),0,1);return base+height*Math.pow(t,.78)+.75*Math.pow(1-t,8);};
  const beam=(list,a,b,thickness)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);if(delta.length()<.01)return;list.push({position:start.add(end).multiplyScalar(.5),rotation:new THREE.Quaternion().setFromUnitVectors(up,delta.clone().normalize()),scale:[thickness,delta.length(),thickness]});};
  const rows=[...new Set(columns.map(c=>c.z))].sort((a,b)=>a-b),low=rows[0],high=rows[rows.length-1];
  for(const z of rows)beam(timber,[-plateWidth/2,columnTop+.12,z],[plateWidth/2,columnTop+.12,z],.42);
  for(const x of [-plateWidth/2,plateWidth/2])beam(timber,[x,columnTop+.12,low],[x,columnTop+.12,high],.42);
  root.userData.supports=[];
  for(const {x,z} of columns){
    const top=heightAt(x,z)-.14;beam(timber,[x,columnTop,z],[x,top,z],.24);root.userData.supports.push({bottom:[x,columnTop,z],top:[x,top,z]});
    beam(brackets,[x,columnTop-1,z],[x-Math.sign(x)*1.8,columnTop+.12,z],.18);
    for(const side of [-1,1])beam(brackets,[x,columnTop-.1,z],[x, heightAt(x,side*(depth/2-.35))-.16, side*(depth/2-.35)],.16);
  }
  const xs=[...new Set(columns.map(c=>c.x).concat(0))];
  for(const x of xs)for(let i=0;i<16;i++){
    const za=-depth/2+i*depth/16,zb=za+depth/16;
    beam(timber,[x,heightAt(x,za)-.14,za],[x,heightAt(x,zb)-.14,zb],.15);
  }
  for(const z of rows)for(let i=0;i<12;i++){
    const xa=-plateWidth/2+i*plateWidth/12,xb=xa+plateWidth/12;
    beam(timber,[xa,heightAt(xa,z)-.14,z],[xb,heightAt(xb,z)-.14,z],.19);
  }
  const geo=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
  for(const [parts,color,name] of [[timber,'#62442f','load-bearing-roof-timbers'],[brackets,'#8b6038','column-knee-braces']]){
    const mesh=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color,roughness:.85}),parts.length);mesh.name=name;
    parts.forEach((p,i)=>{dummy.position.copy(p.position);dummy.quaternion.copy(p.rotation);dummy.scale.set(...p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);
  }
  return root;
}
