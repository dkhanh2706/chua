import * as THREE from 'three';

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

  box(root,0,.53,-17.5,38.8,1.06,18.8,'#8a7961');
  box(root,0,1.04,-17.5,39,.12,19,'#ba9d73');
  // Equal square terracotta tiles, all at the same walking height.
  const floor=new THREE.InstancedMesh(new THREE.BoxGeometry(1.96,.09,1.96),material('#9b7756'),19*9),dummy=new THREE.Object3D();
  for(let row=0;row<9;row++)for(let col=0;col<19;col++){
    const i=row*19+col;dummy.position.set(-18+col*2,1.155,-25.5+row*2);dummy.updateMatrix();floor.setMatrixAt(i,dummy.matrix);
    const shade=.96+((row*7+col*11)%5)*.012;floor.setColorAt(i,new THREE.Color(shade,shade,shade));
  }
  floor.name='interior-square-floor';floor.receiveShadow=true;floor.computeBoundingSphere();root.add(floor);
  for(let i=0;i<5;i++)box(root,0,.12+i*.12,-5.98-i*.56,37,.24+i*.24,.7,'#b4a084');
  // Walls have a warm plaster finish and a dark timber dado.
  for(const side of [-1,1]){
    box(root,side*19.2,5.7,-17.5,.5,9,18.5,'#8e7458');
    box(root,side*18.9,2.15,-17.5,.13,1.9,18,'#62432e');
    box(root,side*18.8,3.14,-17.5,.2,.1,18.1,trim);
    box(root,side*18.8,1.36,-17.5,.2,.28,18.1,trim);
    // Recessed lattice panels give the side walls some depth.
    for(const z of [-12.5,-20.5]){
      box(root,side*18.88,6.2,z,.16,3.1,3.3,'#3a3027');
      for(let k=-2;k<=2;k++)box(root,side*18.72,6.2,z+k*.59,.13,3.2,.07,trim);
      for(const y of [4.65,6.2,7.75])box(root,side*18.7,y,z,.16,.1,3.5,trim);
    }
  }
  box(root,0,5.7,-26.8,38.8,9,.6,'#796146');
  box(root,0,5.5,-26.42,11.8,7.7,.15,'#493527');
  for(const x of [-6.1,6.1])box(root,x,5.5,-26.2,.18,8,.18,trim);
  for(const y of [1.55,9.45])box(root,0,y,-26.2,12.4,.15,.18,trim);
  for(const x of [-17,-12,12,17])for(const z of [-9,-25.5]){
    cyl(root,x,1.35,z,.55,.62,.3,'#9f8969');cyl(root,x,5.7,z,.3,.38,8.4,wood);cyl(root,x,9.92,z,.55,.4,.3,trim);
  }
  // A closed, ordered ceiling hides the roof structure from eye level.
  const ceiling=new THREE.Group();ceiling.name='timber-ceiling';root.add(ceiling);
  for(let i=0;i<19;i++)box(ceiling,-18+i*2,10.3,-17.5,1.97,.22,18.5,i%2?'#674830':'#6e4c33');
  for(const z of [-8.5,-17.5,-26.5])box(ceiling,0,10.03,z,39,.38,.42,wood);
  for(const x of [-18.8,0,18.8])box(ceiling,x,10.03,-17.5,.38,.38,18.5,wood);

  const seats=new THREE.Group();seats.name='temple-sofas';root.add(seats);
  const upholstery=new THREE.BoxGeometry(1,1,1,8,8,8),vertices=upholstery.attributes.position;
  const vertex=new THREE.Vector3(),core=new THREE.Vector3();
  for(let i=0;i<vertices.count;i++){
    vertex.fromBufferAttribute(vertices,i);core.copy(vertex).clampScalar(-.38,.38);
    vertex.sub(core).normalize().multiplyScalar(.12).add(core);vertices.setXYZ(i,vertex.x,vertex.y,vertex.z);
  }
  upholstery.computeVertexNormals();
  const padded=(p,x,y,z,w,h,d,c)=>part(p,upholstery,c,x,y,z,w,h,d,{roughness:.98});
  for(const x of [-9,9])for(const z of [-11.3,-16]){
    const sofa=new THREE.Group();sofa.name='three-seat-sofa';sofa.position.set(x,0,z);seats.add(sofa);
    for(const sx of [-2.45,2.45])for(const sz of [-.87,.87])box(sofa,sx,1.34,sz,.2,.28,.2,wood);
    padded(sofa,0,1.59,0,5.9,.36,2.45,'#665744');
    padded(sofa,0,2.3,1.02,5.9,1.35,.4,'#8c7c64');
    for(const side of [-1,1])padded(sofa,side*2.77,2.05,0,.43,.95,2.42,'#8c7c64');
    for(let i=-1;i<=1;i++){
      const cushion=padded(sofa,i*1.69,1.9,-.12,1.63,.31,1.92,'#a09077');cushion.name='sofa-seat-cushion';
      const back=padded(sofa,i*1.69,2.4,.73,1.63,1.02,.4,'#a3947c');back.rotation.x=.09;
      tube(sofa,[[i*1.69-.72,2.025,-.99],[i*1.69,2.045,-1.02],[i*1.69+.72,2.025,-.99]],.012,'#b5a58a');
    }
    for(const side of [-1,1]){
      const pillow=padded(sofa,side*2.08,2.2,.29,.57,.62,.3,'#a58555');pillow.rotation.z=side*.17;pillow.rotation.x=-.12;
    }
  }
  // Altar table, lotus throne and a sculpted seated Buddha facing the entrance.
  const altar=new THREE.Group();altar.name='buddha-altar';root.add(altar);
  box(altar,0,1.42,-22.6,12,.44,5.6,wood);box(altar,0,2,-22.6,11.7,.72,5.1,'#66432c');box(altar,0,2.42,-22.6,12.1,.18,5.6,trim);
  for(const x of [-5.2,5.2])box(altar,x,1.65,-20.1,.38,.88,.3,gold);
  for(let x=-4;x<=4;x+=2)box(altar,x,2,-19.98,1.55,.35,.07,'#8c6338');
  const statue=new THREE.Group();statue.position.set(0,2.52,-22.8);statue.name='seated-buddha';altar.add(statue);
  cyl(statue,0,.24,0,2.65,2.9,.48,gold);cyl(statue,0,.53,0,2.45,2.65,.14,goldLight);
  for(let i=0;i<18;i++){
    const a=i/18*Math.PI*2,p=ball(statue,Math.cos(a)*2.35,.55,Math.sin(a)*1.7,.42,.45,.24,goldLight);p.rotation.y=-a;p.rotation.z=Math.cos(a)*.35;
  }
  for(const side of [-1,1]){const leg=ball(statue,side*.88,.97,.45,1.55,.51,.85,gold);leg.rotation.y=side*.26;}
  const profile=[[0,1.05],[1.24,1.05],[1.32,1.4],[1.1,1.9],[.95,2.55],[1.12,3.05],[.8,3.38],[.38,3.48],[0,3.48]].map(([r,y])=>new THREE.Vector2(r,y));
  part(statue,new THREE.LatheGeometry(profile,64),gold,0,0,0,1,1,.72,{metalness:.38,roughness:.45});
  cyl(statue,0,3.52,0,.3,.38,.55,goldLight);
  ball(statue,0,4.12,.04,.68,.86,.62,goldLight,{metalness:.35,roughness:.46});
  for(const side of [-1,1]){
    ball(statue,side*.69,4.02,.03,.16,.48,.18,goldLight);
    tube(statue,[[side*.92,3.03,.12],[side*1.48,2.45,.35],[side*1.27,1.63,.73],[side*.46,1.45,1.05]],.24,gold);
    ball(statue,side*.33,1.45,1.07,.42,.12,.28,goldLight);
    tube(statue,[[side*.46,4.22,.55],[side*.3,4.17,.63],[side*.13,4.2,.62]],.022,'#674c2d');
    tube(statue,[[side*.46,4.37,.52],[side*.3,4.4,.6],[side*.14,4.36,.6]],.025,'#977039');
  }
  ball(statue,0,4.02,.65,.1,.2,.12,goldLight);
  tube(statue,[[-.19,3.8,.59],[0,3.77,.65],[.19,3.8,.59]],.022,'#916131');
  ball(statue,0,4.88,.01,.52,.32,.5,'#695039');ball(statue,0,5.17,.01,.25,.24,.24,gold);
  for(let i=0;i<70;i++){
    const a=i*2.39996,t=(i+.5)/70,y=4.42+t*.55,r=.65*Math.sqrt(Math.max(0,1-((y-4.12)/.91)**2));
    ball(statue,Math.cos(a)*r,y,Math.sin(a)*r,.075,.075,.075,'#795a32');
  }
  for(let i=0;i<6;i++)tube(statue,[[-.88+i*.19,3.04,.48],[-.92+i*.21,2.6,.63],[-.7+i*.23,2,.75],[-.3+i*.22,1.19,.99]],.025,'#a57436');
  const halo=part(statue,new THREE.TorusGeometry(2.88,.065,12,96),goldLight,0,2.98,-.88,1,1,1,{emissive:'#b57a29',emissiveIntensity:.45});
  part(statue,new THREE.CircleGeometry(2.8,96),'#93652f',0,2.98,-.94,1,1,1,{emissive:'#75421c',emissiveIntensity:.25});
  for(const x of [-4.6,4.6]){
    cyl(altar,x,2.65,-21.5,.48,.34,.36,gold);ball(altar,x,3.22,-21.5,.44,.55,.44,'#967552');
    for(let i=0;i<5;i++){const a=i*2.4;tube(altar,[[x,3.4,-21.5],[x+Math.cos(a)*.3,4.2,-21.5+Math.sin(a)*.3]],.025,'#687049');ball(altar,x+Math.cos(a)*.3,4.2,-21.5+Math.sin(a)*.3,.24,.22,.22,'#d2b183');}
    cyl(altar,x,2.7,-20.35,.16,.24,.45,gold);ball(altar,x,3.02,-20.35,.075,.17,.075,'#ffd38a',{emissive:'#ffb34c',emissiveIntensity:2});
  }
  const fans=[];
  for(const x of [-9,9]){
    cyl(root,x,9.75,-16,.12,.12,1,wood);cyl(root,x,10.17,-16,.35,.24,.16,trim);
    const rotor=new THREE.Group();rotor.name='ceiling-fan-rotor';rotor.position.set(x,9.15,-16);root.add(rotor);fans.push(rotor);
    ball(rotor,0,0,0,.38,.22,.38,'#806540');
    const shape=new THREE.Shape();shape.moveTo(.25,-.12);shape.bezierCurveTo(1,-.18,2.1,-.44,2.85,-.2);shape.quadraticCurveTo(3.13,.05,2.8,.27);shape.bezierCurveTo(1.9,.39,.9,.2,.25,.12);shape.closePath();
    const bladeGeo=new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,steps:1});bladeGeo.rotateX(-Math.PI/2);
    for(let j=0;j<5;j++){const blade=part(rotor,bladeGeo,'#865c38',0,0,0);blade.rotation.y=j*Math.PI*2/5;}
  }
  const lights=[];
  for(const x of [-14,14])for(const z of [-11.5,-22]){
    cyl(root,x,9.35,z,.045,.045,1.2,wood);cyl(root,x,8.45,z,.43,.36,.85,'#e3bf83');
    const glow=ball(root,x,8.45,z,.37,.38,.37,'#ecc17f',{emissive:'#ffc275',emissiveIntensity:1.1});
    for(const y of [8.02,8.88])cyl(root,x,y,z,.46,.46,.1,wood);
    const light=new THREE.PointLight('#ffc383',28,16,1.6);light.position.set(x,7.8,z);root.add(light);lights.push(light);
  }
  const altarLight=new THREE.PointLight('#ffd698',100,17,1.5);altarLight.position.set(0,6.7,-18.5);root.add(altarLight);lights.push(altarLight);
  return{root,ceiling,fans,lights,statue,floor,seats,update(time){fans.forEach((fan,i)=>fan.rotation.y=time*(1.65+i*.08));}};
}
