import * as THREE from 'three';
import {createTempleFloorGeometry} from './temple-floor.mjs';
import {buildCircularHallShell} from './circular-temple.mjs';
import { setupStatuePortraits } from './statue-portraits.mjs';

export const HALL_RAISE=3.8;
export const HALL_CEILING=10.3+HALL_RAISE;

export function buildTempleInterior(parent){
  const root=new THREE.Group();root.name='warm-temple-interior';parent.add(root);
  const materials=new Map(),cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,28,20);
  const material=(color,extra={})=>{const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.8,...extra}));return materials.get(key);};
  const part=(p,g,color,x,y,z,sx=1,sy=1,sz=1,extra={})=>{const m=new THREE.Mesh(g,material(color,extra));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;};
  const box=(p,x,y,z,w,h,d,c)=>part(p,cube,c,x,y,z,w,h,d);
  const ball=(p,x,y,z,w,h,d,c,extra={})=>part(p,sphere,c,x,y,z,w,h,d,extra);
  const cyl=(p,x,y,z,rt,rb,h,c)=>part(p,new THREE.CylinderGeometry(rt,rb,h,40),c,x,y,z);
  const tube=(p,points,r,c)=>part(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(a=>new THREE.Vector3(...a))),40,r,8,false),c,0,0,0);
  const gold='#bd8c3f',goldLight='#d4ab60',wood='#523526',trim='#805333';

  const hall=window.HALL,radius=hall.radius/10,centerZ=(hall.y-350)/10;
  const entranceZ=(window.HALL_ENTRY.y-350)/10;
  const platform=(r,top,depth,color)=>{
    const shape=new THREE.Shape(),start=Math.acos((entranceZ-centerZ)/r);
    for(let i=0;i<=128;i++){const a=start+(Math.PI*2-2*start)*i/128,x=Math.sin(a)*r,z=Math.cos(a)*r;if(i===0)shape.moveTo(x,z);else shape.lineTo(x,z);}shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});geometry.rotateX(Math.PI/2);
    part(root,geometry,color,0,top,centerZ);
  };
  platform(radius+.4,1.02,1.02,'#626b63');platform(radius+.35,1.12,.1,'#ba9d73');
  const floor=new THREE.Mesh(createTempleFloorGeometry(radius,entranceZ,centerZ),material('#b09a7b',{vertexColors:true,roughness:.94}));
  floor.name='interior-square-floor';floor.receiveShadow=true;root.add(floor);
  buildCircularHallShell(root);
  for(let i=0;i<6;i++)box(root,0,.1+i*.1,entranceZ+4.1-i*.68,(window.HALL_ENTRY.right-window.HALL_ENTRY.left)/10+2,.2+i*.2,.78,'#b4a084');
  const entry=window.HALL_ENTRY,frontZ=(entry.y-350)/10;
  const doorway=new THREE.Group();doorway.name='open-temple-doorway';root.add(doorway);
  const halfOpening=(entry.right-entry.left)/20;
  const archHalf=Math.sin(hall.entryAngle)*radius,openingTop=8.9;
  for(const side of [-1,1]){
    box(doorway,side*(halfOpening+.2),5.05,frontZ,.4,7.7,.85,wood);
    box(doorway,side*(halfOpening+.2),1.43,frontZ,.65,.46,1,'#9f8969');
    const sideWidth=archHalf-halfOpening;
    box(doorway,side*(halfOpening+sideWidth/2),(1.2+openingTop)/2,frontZ,sideWidth,openingTop-1.2,.52,'#743b2d');
    box(doorway,side*(halfOpening+sideWidth*.66),5.1,frontZ+.3,.055,5.9,.07,gold);
  }
  box(doorway,0,openingTop+.12,frontZ,halfOpening*2+.9,.46,.88,wood);
  box(doorway,0,(openingTop+.35+HALL_CEILING)/2,frontZ,archHalf*2,HALL_CEILING-openingTop-.35,.52,'#743b2d');
  // The threshold stays level with the hall floor so walking never catches on it.
  box(doorway,0,1.14,frontZ,halfOpening*2,.12,1,'#ba9d73');
  box(root,0,5.5,-26.42,16,7.7,.15,'#493527');
  for(const x of [-8.2,8.2])box(root,x,5.5,-26.2,.18,8,.18,trim);
  for(const y of [1.55,9.45])box(root,0,y,-26.2,16.6,.15,.18,trim);
  // Opaque circular ceiling with radial beams joining the column ring.
  const ceiling=new THREE.Group();ceiling.name='timber-ceiling';root.add(ceiling);
  cyl(ceiling,0,HALL_CEILING,centerZ,radius+.05,radius+.05,.24,'#674830');
  const beamGeo=new THREE.BoxGeometry(.2,.25,radius*2),ceilingMaterial=material(wood);
  for(let i=0;i<12;i++){
    const beam=new THREE.Mesh(beamGeo,ceilingMaterial);beam.position.set(0,HALL_CEILING-.27,centerZ);beam.rotation.y=i*Math.PI/12;ceiling.add(beam);
  }
  const centerRing=part(ceiling,new THREE.TorusGeometry(2.2,.12,8,64),trim,0,HALL_CEILING-.3,centerZ);centerRing.rotation.x=Math.PI/2;

  const seats=new THREE.Group();seats.name='temple-sofas';root.add(seats);
  const upholstery=new THREE.BoxGeometry(1,1,1,8,8,8),vertices=upholstery.attributes.position;
  const vertex=new THREE.Vector3(),core=new THREE.Vector3();
  for(let i=0;i<vertices.count;i++){
    vertex.fromBufferAttribute(vertices,i);core.copy(vertex).clampScalar(-.38,.38);
    vertex.sub(core).normalize().multiplyScalar(.12).add(core);vertices.setXYZ(i,vertex.x,vertex.y,vertex.z);
  }
  upholstery.computeVertexNormals();
  const padded=(p,x,y,z,w,h,d,c)=>part(p,upholstery,c,x,y,z,w,h,d,{roughness:.98});
  for(const spec of window.SOFA_LAYOUT){const x=(spec.x-500)/10,z=(spec.y-350)/10;
    const sofa=new THREE.Group();sofa.name='three-seat-sofa';sofa.userData.sofaId=spec.id;sofa.position.set(x,1.2,z);seats.add(sofa);
    for(const sx of [-2.45,2.45])for(const sz of [-.87,.87])box(sofa,sx,.09,sz,.16,.18,.16,wood);
    padded(sofa,0,.23,0,5.88,.18,2.42,'#806a50');
    for(const sz of [-1.12,1.12])box(sofa,0,.25,sz,5.65,.1,.1,wood);
    padded(sofa,0,.77,1.02,5.9,.96,.34,'#aa987c');
    for(const side of [-1,1]){
      padded(sofa,side*2.77,.53,0,.43,.5,2.42,'#b5a58a');
      padded(sofa,side*2.77,.79,0,.45,.1,2.36,'#c7b79a');
    }
    for(let i=-1;i<=1;i++){
      const cushion=padded(sofa,i*1.69,.34,-.12,1.63,.12,1.92,'#c6b699');cushion.name='sofa-seat-cushion';
      const back=padded(sofa,i*1.69,.8,.77,1.63,.78,.27,'#bcae93');back.rotation.x=.08;
      tube(sofa,[[i*1.69-.72,.396,-.99],[i*1.69,.404,-1.02],[i*1.69+.72,.396,-.99]],.009,'#e0d2b7');
      ball(sofa,i*1.69,.82,.615,.036,.025,.012,'#9b8b72');
    }
    for(const side of [-1,1]){
      const pillow=padded(sofa,side*2.08,.65,.39,.55,.5,.23,side<0?'#7c8968':'#b39768');pillow.rotation.z=side*.17;pillow.rotation.x=-.12;
    }
  }
  // Altar table, lotus throne and a sculpted seated Buddha facing the entrance.
  const altar=new THREE.Group();altar.name='buddha-altar';root.add(altar);
  box(altar,0,1.42,-22.6,12,.44,5.6,wood);box(altar,0,2,-22.6,11.7,.72,5.1,'#66432c');box(altar,0,2.42,-22.6,12.1,.18,5.6,trim);
  for(const x of [-5.2,5.2])box(altar,x,1.65,-20.1,.38,.88,.3,gold);
  for(let x=-4;x<=4;x+=2)box(altar,x,2,-19.98,1.55,.35,.07,'#8c6338');
  const statue=new THREE.Group();statue.position.set(-3.15,2.52,-22.8);statue.scale.setScalar(.82);statue.name='seated-buddha';altar.add(statue);
  cyl(statue,0,.24,0,2.65,2.9,.48,gold);cyl(statue,0,.53,0,2.45,2.65,.14,goldLight);
  for(let i=0;i<18;i++){
    const a=i/18*Math.PI*2,p=ball(statue,Math.cos(a)*2.35,.55,Math.sin(a)*1.7,.42,.45,.24,goldLight);p.rotation.y=-a;p.rotation.z=Math.cos(a)*.35;
  }
  for(const side of [-1,1]){const leg=ball(statue,side*.88,.97,.45,1.55,.51,.85,gold);leg.rotation.y=side*.26;}
  const profile=[[0,1.05],[1.24,1.05],[1.32,1.4],[1.1,1.9],[.95,2.55],[1.12,3.05],[.8,3.38],[.38,3.48],[0,3.48]].map(([r,y])=>new THREE.Vector2(r,y));
  part(statue,new THREE.LatheGeometry(profile,64),gold,0,0,0,1,1,.72,{metalness:.38,roughness:.45});
  cyl(statue,0,3.52,0,.3,.38,.55,goldLight);
  ball(statue,0,4.12,.04,.68,.86,.62,goldLight,{metalness:.35,roughness:.46});
  const faceDetails=new THREE.Group();faceDetails.name='sculpted-face';statue.add(faceDetails);
  for(const side of [-1,1]){
    ball(statue,side*.69,4.02,.03,.16,.48,.18,goldLight);
    tube(statue,[[side*.92,3.03,.12],[side*1.48,2.45,.35],[side*1.27,1.63,.73],[side*.46,1.45,1.05]],.24,gold);
    ball(statue,side*.33,1.45,1.07,.42,.12,.28,goldLight);
    tube(faceDetails,[[side*.46,4.22,.55],[side*.3,4.17,.63],[side*.13,4.2,.62]],.022,'#674c2d');
    tube(faceDetails,[[side*.46,4.37,.52],[side*.3,4.4,.6],[side*.14,4.36,.6]],.025,'#977039');
  }
  ball(faceDetails,0,4.02,.65,.1,.2,.12,goldLight);
  tube(faceDetails,[[-.19,3.8,.59],[0,3.77,.65],[.19,3.8,.59]],.022,'#916131');
  ball(statue,0,4.88,.01,.52,.32,.5,'#695039');ball(statue,0,5.17,.01,.25,.24,.24,gold);
  for(let i=0;i<70;i++){
    const a=i*2.39996,t=(i+.5)/70,y=4.42+t*.55,r=.65*Math.sqrt(Math.max(0,1-((y-4.12)/.91)**2));
    ball(statue,Math.cos(a)*r,y,Math.sin(a)*r,.075,.075,.075,'#795a32');
  }
  for(let i=0;i<6;i++)tube(statue,[[-.88+i*.19,3.04,.48],[-.92+i*.21,2.6,.63],[-.7+i*.23,2,.75],[-.3+i*.22,1.19,.99]],.025,'#a57436');
  const halo=part(statue,new THREE.TorusGeometry(2.88,.065,12,96),goldLight,0,2.98,-.88,1,1,1,{emissive:'#b57a29',emissiveIntensity:.45});
  part(statue,new THREE.CircleGeometry(2.8,96),'#93652f',0,2.98,-.94,1,1,1,{emissive:'#75421c',emissiveIntensity:.25});
  const secondStatue=statue.clone(true);secondStatue.position.x=3.15;altar.add(secondStatue);
  const statues=[statue,secondStatue];
  setupStatuePortraits(statues);
  for(const x of [-5.1,5.1]){
    cyl(altar,x,2.65,-21.5,.48,.34,.36,gold);ball(altar,x,3.22,-21.5,.44,.55,.44,'#967552');
    for(let i=0;i<5;i++){const a=i*2.4;tube(altar,[[x,3.4,-21.5],[x+Math.cos(a)*.3,4.2,-21.5+Math.sin(a)*.3]],.025,'#687049');ball(altar,x+Math.cos(a)*.3,4.2,-21.5+Math.sin(a)*.3,.24,.22,.22,'#d2b183');}
    cyl(altar,x,2.7,-20.35,.16,.24,.45,gold);ball(altar,x,3.02,-20.35,.075,.17,.075,'#ffd38a',{emissive:'#ffb34c',emissiveIntensity:2});
  }
  const fans=[];
  for(const x of [-9,9]){
    cyl(root,x,9.75+HALL_RAISE,-16,.12,.12,1,wood);cyl(root,x,10.17+HALL_RAISE,-16,.35,.24,.16,trim);
    const rotor=new THREE.Group();rotor.name='ceiling-fan-rotor';rotor.position.set(x,9.15+HALL_RAISE,-16);root.add(rotor);fans.push(rotor);
    ball(rotor,0,0,0,.38,.22,.38,'#806540');
    const shape=new THREE.Shape();shape.moveTo(.25,-.12);shape.bezierCurveTo(1,-.18,2.1,-.44,2.85,-.2);shape.quadraticCurveTo(3.13,.05,2.8,.27);shape.bezierCurveTo(1.9,.39,.9,.2,.25,.12);shape.closePath();
    const bladeGeo=new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,steps:1});bladeGeo.rotateX(-Math.PI/2);
    for(let j=0;j<5;j++){const blade=part(rotor,bladeGeo,'#865c38',0,0,0);blade.rotation.y=j*Math.PI*2/5;}
  }
  const lights=[];
  for(const x of [-14,14])for(const z of [-11.5,-22]){
    cyl(root,x,9.35+HALL_RAISE/2,z,.045,.045,1.2+HALL_RAISE,wood);cyl(root,x,8.45,z,.43,.36,.85,'#e3bf83');
    const glow=ball(root,x,8.45,z,.37,.38,.37,'#ecc17f',{emissive:'#ffc275',emissiveIntensity:.88});
    for(const y of [8.02,8.88])cyl(root,x,y,z,.46,.46,.1,wood);
    const light=new THREE.PointLight('#ffc383',22.4,16,1.6);light.position.set(x,7.8,z);root.add(light);lights.push(light);
  }
  const altarLight=new THREE.PointLight('#ffd698',80,17,1.5);altarLight.position.set(0,6.7,-18.5);root.add(altarLight);lights.push(altarLight);
  return{root,ceiling,doorway,fans,lights,statue,statues,floor,seats,update(time){fans.forEach((fan,i)=>fan.rotation.y=time*(1.65+i*.08));}};
}
