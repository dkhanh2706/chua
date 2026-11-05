import * as THREE from 'three';

const TAU=Math.PI*2,wood='#783e2b',darkWood='#452e25',gold='#c49a53',teal='#365854';
const boxGeo=new THREE.BoxGeometry(1,1,1),up=new THREE.Vector3(0,1,0);
function builder(root){
  const batches=new Map(),dummy=new THREE.Object3D();
  const box=(x,y,z,w,h,d,color,angle=0)=>{
    if(!batches.has(color))batches.set(color,[]);
    dummy.position.set(x,y,z);dummy.rotation.set(0,angle,0);dummy.scale.set(w,h,d);dummy.updateMatrix();batches.get(color).push(dummy.matrix.clone());
  };
  const beam=(a,b,width,color)=>{
    if(!batches.has(color))batches.set(color,[]);
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    dummy.position.copy(start).add(end).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,delta.clone().normalize());dummy.scale.set(width,delta.length(),width);dummy.updateMatrix();batches.get(color).push(dummy.matrix.clone());
  };
  const flush=()=>{for(const [color,matrices] of batches){const mesh=new THREE.InstancedMesh(boxGeo,new THREE.MeshStandardMaterial({color,roughness:.78}),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);}};
  return{box,beam,flush};
}
function torus(root,radius,y,thickness,color){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,thickness,8,128),new THREE.MeshStandardMaterial({color,roughness:.7,metalness:.12}));ring.rotation.x=Math.PI/2;ring.position.y=y;ring.castShadow=true;root.add(ring);return ring;
}
function drum(root,radius,bottom,top,color){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,top-bottom,96),new THREE.MeshStandardMaterial({color,roughness:.85}));mesh.position.y=(bottom+top)/2;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
function wallSector(radius,bottom,top,start,length){
  const p=[],indices=[],steps=8;
  for(let i=0;i<=steps;i++)for(const r of [radius-.22,radius+.22])for(const y of [bottom,top]){
    const a=start+length*i/steps;p.push(Math.sin(a)*r,y,Math.cos(a)*r);
  }
  for(let i=0;i<steps;i++){
    const a=i*4,b=a+4;
    for(const [c,d] of [[0,1],[2,3],[0,2],[1,3]])indices.push(a+c,b+c,a+d,a+d,b+c,b+d);
  }
  indices.push(0,1,2,2,1,3,steps*4,steps*4+2,steps*4+1,steps*4+1,steps*4+2,steps*4+3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function buildCircularHallShell(parent){
  const {HALL,HALL_COLUMNS}=window,r=HALL.radius/10,cz=(HALL.y-350)/10;
  const root=new THREE.Group();root.name='circular-hall-shell';root.position.z=cz;parent.add(root);
  const decor=builder(root),wallMaterial=new THREE.MeshStandardMaterial({color:'#743b2d',roughness:.9,side:THREE.DoubleSide});
  const walls=new THREE.Group();walls.name='curved-hall-walls';root.add(walls);
  for(let i=0;i<24;i++){
    if(i===0||i===1||i===23)continue;
    const angle=i*TAU/24;
    const wall=new THREE.Mesh(wallSector(r,1.2,HALL.ceiling,angle-TAU/48,TAU/24),wallMaterial);wall.castShadow=true;wall.receiveShadow=true;walls.add(wall);
    const panel=(x,y,z,w,h,d,c)=>decor.box(Math.sin(angle)*z+Math.cos(angle)*x,y,Math.cos(angle)*z-Math.sin(angle)*x,w,h,d,c,angle);
    panel(0,2.05,r+.25,4.63,1.7,.16,darkWood);
    for(const x of [-1.94,1.94])panel(x,6,r+.27,.07,6.8,.08,gold);
    for(const y of [2.6,3.0,9,9.35])panel(0,y,r+.27,3.94,.06,.08,gold);
    for(const x of [-.98,0,.98])panel(x,6,r+.25,.055,5.5,.07,gold);
    panel(0,11.4,r+.26,3.65,1.45,.1,darkWood);
    for(let k=-4;k<=4;k++)panel(k*.4,11.4,r+.36,.055,1.5,.07,teal);
    for(const y of [10.65,11.4,12.15])panel(0,y,r+.36,3.75,.07,.07,gold);
    // Brackets and friezes repeat on the same angular grid as the columns.
    for(const y of [12.6,13.2,13.65])panel(0,y,r+.3,4.66,.12,.16,y===13.2?teal:gold);
    for(const x of [-1.6,-.8,0,.8,1.6])panel(x,13.2,r+.4,.25,.35,.18,wood);
  }
  const shaft=new THREE.CylinderGeometry(.3,.39,HALL.ceiling-1.47,16),foot=new THREE.CylinderGeometry(.57,.65,.34,20),cap=new THREE.CylinderGeometry(.57,.42,.3,20);
  for(const [geo,color,y,name] of [[shaft,wood,(HALL.ceiling+1.47)/2,'round-hall-columns'],[foot,'#8f9187',1.37,'stone-column-feet'],[cap,gold,HALL.ceiling-.08,'gilded-column-capitals']]){
    const mesh=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color,roughness:.8}),HALL_COLUMNS.length),dummy=new THREE.Object3D();mesh.name=name;
    HALL_COLUMNS.forEach((c,i)=>{dummy.position.set((c.x-500)/10,y,(c.y-HALL.y)/10);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);
  }
  // Brick courses circle the foundation, with subtle alternating stone shades.
  for(let row=0;row<4;row++)for(let i=0;i<96;i++){
    const a=(i+(row%2)*.5)*TAU/96;
    if(Math.min(a,TAU-a)<HALL.entryAngle+.02)continue;
    decor.box(Math.sin(a)*(r+.32),.18+row*.25,Math.cos(a)*(r+.32),1.19,.22,.32,(row+i)%3?'#505854':'#626b63',a);
  }
  decor.flush();return root;
}

export function buildCircularRoofs(parent){
  const {HALL,HALL_COLUMNS}=window,cz=(HALL.y-350)/10,roofs=[];
  const tiers=[{radius:22.3,inner:13.2,base:14.35,rise:3.9},{radius:17.2,inner:9.2,base:21.5,rise:3.7},{radius:12.3,inner:.45,base:28.1,rise:4.5}];
  for(let tier=0;tier<tiers.length;tier++){
    const {radius,inner,base,rise}=tiers[tier],root=new THREE.Group();root.position.z=cz;root.name=`circular-roof-tier-${tier+1}`;parent.add(root);roofs.push(root);
    const decor=builder(root),height=t=>base+rise*Math.pow(t,.8)+.36*Math.pow(1-t,8);
    const points=Array.from({length:33},(_,i)=>{const t=i/32;return new THREE.Vector2(radius+(inner-radius)*t,height(t));});
    const geo=new THREE.LatheGeometry(points,144),top=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:tier===1?'#354e4e':'#304648',side:THREE.DoubleSide,roughness:.82}));top.name='curved-circular-tile-roof';top.castShadow=true;top.receiveShadow=true;root.add(top);
    const underside=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#51382b',side:THREE.DoubleSide,roughness:.9}));underside.position.y=-.16;root.add(underside);
    // Raised radial tile seams and concentric courses follow the curved surface.
    const ribPoints=points.map(p=>new THREE.Vector3(0,p.y+.035,p.x));
    const ribGeo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribPoints),32,.035,5,false),ribs=new THREE.InstancedMesh(ribGeo,new THREE.MeshStandardMaterial({color:'#68817a',roughness:.8}),144),dummy=new THREE.Object3D();
    for(let i=0;i<144;i++){dummy.rotation.set(0,i*TAU/144,0);dummy.updateMatrix();ribs.setMatrixAt(i,dummy.matrix);}ribs.name='radial-roof-tile-seams';ribs.computeBoundingSphere();root.add(ribs);
    for(let i=0;i<=12;i++){const t=i/12;torus(root,radius+(inner-radius)*t,height(t)+.04,i===0?.13:.026,i===0?gold:'#4d6966');}
    torus(root,radius-.08,base+.12,.13,wood);torus(root,radius-.3,base-.08,.09,gold);
    // The circular beam and radial brackets sit directly over the supporting wall.
    const supportRadius=tier===0?18.25:tier===1?13.2:9.2;
    const bottom=tier===0?HALL.ceiling:tiers[tier-1].base+tiers[tier-1].rise-.4;
    const drumTop=height((radius-supportRadius)/(radius-inner))-.1;
    drum(root,supportRadius,bottom-.05,drumTop,wood);
    if(tier>0){
      for(const y of [bottom+.2,base-1.7,base-.75,base-.2])torus(root,supportRadius+.08,y,.1,y===base-.75?gold:teal);
      for(let i=0;i<32;i++){
        const a=i*TAU/32,rr=supportRadius+.12;
        decor.box(Math.sin(a)*rr,(bottom+drumTop)/2,Math.cos(a)*rr,.14,drumTop-bottom,.18,gold,a);
        const panelWidth=TAU*rr/32*.76,panelHeight=base-bottom-.8,y=(base+bottom)/2;
        const panel=(x,py,w,h,color)=>decor.box(Math.sin(a)*(rr+.04)+Math.cos(a)*x,py,Math.cos(a)*(rr+.04)-Math.sin(a)*x,w,h,.08,color,a);
        panel(0,y,panelWidth,panelHeight,'#243e3a');
        for(let j=-2;j<=2;j++)panel(j*panelWidth/6,y,.035,panelHeight,gold);
        for(const offset of [-.38,0,.38])panel(0,y+offset*panelHeight,panelWidth,.035,gold);
        for(const step of [-.38,0,.38])decor.box(Math.sin(a)*rr,base-1.25+step,Math.cos(a)*rr,.65,.055,.2,teal,a);
      }
    }
    torus(root,supportRadius,bottom+.08,.19,darkWood);
    const frame=new THREE.Group();frame.name='connected-timber-roof-frame';frame.userData.supports=[];root.add(frame);
    const count=tier===0?HALL_COLUMNS.length:24;
    for(let i=0;i<count;i++){
      const a=tier===0?Math.atan2(HALL_COLUMNS[i].x-HALL.x,HALL_COLUMNS[i].y-HALL.y):i*TAU/count;
      const t=(radius-supportRadius)/(radius-inner),y=height(t)-.18,s=Math.sin(a),c=Math.cos(a);
      decor.beam([s*supportRadius,bottom,c*supportRadius],[s*supportRadius,y,c*supportRadius],.22,wood);
      decor.beam([s*(supportRadius-.6),bottom-.05,c*(supportRadius-.6)],[s*(radius-.65),base+.15,c*(radius-.65)],.16,darkWood);
      frame.userData.supports.push({bottom:[s*supportRadius,bottom,c*supportRadius],top:[s*supportRadius,y,c*supportRadius]});
      for(let j=0;j<3;j++){
        const r=supportRadius+.22+j*.38;
        decor.box(s*r,bottom+.15+j*.18,c*r,.46+j*.18,.24,.62,gold,a);
      }
    }
    decor.flush();
    if(tier===2){
      drum(root,.4,32.5,33.2,gold);torus(root,.58,32.7,.12,gold);
      const finial=new THREE.Mesh(new THREE.SphereGeometry(.64,24,16),new THREE.MeshStandardMaterial({color:'#d2a34d',metalness:.5,roughness:.32}));finial.scale.y=1.35;finial.position.y=33.6;root.add(finial);
    }
  }
  return roofs;
}
