import * as THREE from 'three';
import {makeTreeLayout,seededRandom} from './garden-layout.mjs';
import {streamCenter} from './waterfall-layout.mjs';

const trees=makeTreeLayout();
// Positive values are paving. Cut tiles against the actual shoreline and plinth,
// rather than dropping a whole tile when its centre is near a curved edge.
export function pavingClearance(x,z){
  const hallZ=-13,pond=Math.hypot((x+29.6)/13.55,(z-10.1)/8.75)-1;
  const hall=Math.hypot(x,z-hallZ)-18.62;
  const entry=Math.max(Math.abs(x)-6.665,4-z,z-8.59);
  const bank=Math.abs(x-streamCenter(z))-(3.6+Math.exp(-(((z+22)/3.6)**2))+.9);
  const front=z<=30.2?100:Math.abs(x)-(8.4+(z-30.7)*3.6/13.3)-.25;
  let distance=Math.min(hall,entry,pond*8.75,bank,front);
  for(const tree of trees)distance=Math.min(distance,Math.hypot(x-tree.x,z-tree.z)-1.05);
  return distance;
}

function clippedTriangle(vertices,positions,colors,shade){
  const polygon=[];
  for(let i=0;i<3;i++){
    const a=vertices[i],b=vertices[(i+1)%3],da=pavingClearance(...a),db=pavingClearance(...b);
    if(da>=0)polygon.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);polygon.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  for(let i=1;i<polygon.length-1;i++)for(const p of [polygon[0],polygon[i],polygon[i+1]]){
    positions.push(p[0],.016,p[1]);colors.push(shade,shade*.98,shade*.94);
  }
}

export function buildCourtyardPaving(parent){
  const full=[],positions=[],colors=[],groutPositions=[],groutColors=[],random=seededRandom(763),dummy=new THREE.Object3D();
  for(let z=-43;z<=43;z+=2)for(let x=-55;x<=55;x+=2){
    const shade=.95+random()*.07,d=pavingClearance(x,z);
    if(d>1.5){
      full.push({x,z,shade});
      for(const [px,pz] of [[x-1,z-1],[x-1,z+1],[x+1,z-1],[x+1,z-1],[x-1,z+1],[x+1,z+1]])groutPositions.push(px,-.009,pz);
      continue;
    }
    if(d< -1.5)continue;
    const n=8,step=1.94/n;
    for(let row=0;row<n;row++)for(let col=0;col<n;col++){
      const a=[x-.97+col*step,z-.97+row*step],b=[a[0]+step,a[1]],c=[a[0],a[1]+step],e=[b[0],c[1]];
      clippedTriangle([a,c,b],positions,colors,shade);clippedTriangle([b,c,e],positions,colors,shade);
      const ga=[x-1+col*.25,z-1+row*.25],gb=[ga[0]+.25,ga[1]],gc=[ga[0],ga[1]+.25],ge=[gb[0],gc[1]];
      clippedTriangle([ga,gc,gb],groutPositions,groutColors,1);clippedTriangle([gb,gc,ge],groutPositions,groutColors,1);
    }
  }
  const material=new THREE.MeshStandardMaterial({color:'#d2c8ae',roughness:.92});
  const paving=new THREE.InstancedMesh(new THREE.BoxGeometry(1.94,.12,1.94),material,full.length);paving.name='even-square-paving';
  full.forEach(({x,z,shade},i)=>{dummy.position.set(x,-.044,z);dummy.updateMatrix();paving.setMatrixAt(i,dummy.matrix);paving.setColorAt(i,new THREE.Color(shade,shade*.98,shade*.94));});
  paving.receiveShadow=true;paving.computeBoundingSphere();parent.add(paving);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const edges=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#d2c8ae',vertexColors:true,roughness:.92}));edges.name='shore-and-temple-cut-paving';edges.receiveShadow=true;parent.add(edges);
  for(let i=1;i<groutPositions.length;i+=3)groutPositions[i]=-.009;
  const groutGeo=new THREE.BufferGeometry();groutGeo.setAttribute('position',new THREE.Float32BufferAttribute(groutPositions,3));groutGeo.computeVertexNormals();
  const grout=new THREE.Mesh(groutGeo,new THREE.MeshStandardMaterial({color:'#9b9988',roughness:1}));grout.name='continuous-paving-grout';grout.receiveShadow=true;parent.add(grout);
  return paving;
}
