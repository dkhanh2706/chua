import * as THREE from 'three';

export const GARDEN_BOUNDS={left:-56,right:56,rear:-78,front:44};

// One enclosure, with a recessed entrance and a finished arch over the outlet.
export class GardenBoundary{
  constructor(parent,{riverX=window.riverX}={}){
    this.root=new THREE.Group();this.root.name='complete-garden-enclosure';parent.add(this.root);
    const {left,right,rear,front}=GARDEN_BOUNDS,river=(riverX(front*10+350)-500)/10,radius=4.8;
    this.segments=[[[left,rear],[left,front]],[[left,front],[-12,front]],[[-12,front],[-8.4,30.7]],[[8.4,30.7],[12,front]],[[12,front],[river-radius,front]],[[river+radius,front],[right,front]],[[right,front],[right,rear]],[[right,rear],[left,rear]]];
    const plaster=new THREE.MeshStandardMaterial({color:'#e0ddcc',roughness:.93}),stone=new THREE.MeshStandardMaterial({color:'#a5b6a2',roughness:.9}),cap=new THREE.MeshStandardMaterial({color:'#49755b',roughness:.76});
    const box=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
    const batch=(name,mat,parts)=>{
      const mesh=new THREE.InstancedMesh(box,mat,parts.length);mesh.name=name;
      parts.forEach((p,i)=>{dummy.position.set(...p.position);dummy.rotation.set(0,p.angle||0,0);dummy.scale.set(...p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.root.add(mesh);return mesh;
    };
    const panels=[],bases=[],caps=[],pillars=[],tops=[],posts=new Set();
    for(const [a,b] of this.segments){
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
      panels.push({position:[x,1.75,z],scale:[length,3.5,.85],angle});bases.push({position:[x,.22,z],scale:[length,.44,1],angle});caps.push({position:[x,3.6,z],scale:[length,.22,1.12],angle});
      const count=Math.ceil(length/8);
      for(let i=0;i<=count;i++){const t=i/count,px=a[0]+dx*t,pz=a[1]+dz*t,key=px.toFixed(4)+','+pz.toFixed(4);if(posts.has(key))continue;posts.add(key);pillars.push({position:[px,1.8,pz],scale:[1.05,3.6,1.05]});tops.push({position:[px,3.7,pz],scale:[1.2,.24,1.2]});}
    }
    this.panels=batch('continuous-wall-panels',plaster,panels);batch('wall-stone-footings',stone,bases);batch('continuous-wall-coping',cap,caps);batch('wall-pilasters',plaster,pillars);batch('wall-pilaster-caps',cap,tops);
    const arch=new THREE.Shape();arch.moveTo(-radius,3.5);arch.lineTo(radius,3.5);arch.lineTo(radius,.16);arch.absellipse(0,.16,radius,2.85,0,Math.PI,false);arch.closePath();
    const portal=new THREE.Mesh(new THREE.ExtrudeGeometry(arch,{depth:.85,bevelEnabled:false,curveSegments:32}),plaster);portal.position.set(river,0,front-.425);portal.castShadow=true;portal.receiveShadow=true;portal.name='arched-stream-outlet';this.root.add(portal);
    const points=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI;return new THREE.Vector3(river+Math.cos(a)*radius,.16+Math.sin(a)*2.85,front+.46);});
    this.root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,.105,6,false),stone));batch('outlet-wall-coping',cap,[{position:[river,3.6,front],scale:[radius*2,.22,1.12]}]);
  }
}
