import * as THREE from 'three';
import { createAvatarMotion,advanceAvatarMotion } from './avatar-motion.mjs';

// Each arm/leg is one continuous surface, deformed by its connected bones.
// Blended skin weights keep elbows and knees smooth throughout the animation.
export function createAvatar(appearance){
  const a=appearance,c=a.colors,root=new THREE.Group(),geometries=new Map(),materials=new Map();
  const geometry=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key);};
  const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.94}));return materials.get(color);};
  const sphere=geometry('sphere',()=>new THREE.SphereGeometry(1,24,18));
  function add(parent,geo,color,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geo,material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const ball=(p,x,y,z,rx,ry,rz,color)=>add(p,sphere,color,x,y,z,rx,ry,rz);
  const cyl=(p,x,y,z,r1,r2,h,color)=>add(p,geometry(`c:${r1}:${r2}:${h}`,()=>new THREE.CylinderGeometry(r1,r2,h,18)),color,x,y,z);
  const capsule=(p,x,y,z,r,length,color)=>add(p,geometry(`cap:${r}:${length}`,()=>new THREE.CapsuleGeometry(r,length,6,14)),color,x,y,z);
  const group=(p,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g;};
  const bone=(p,x=0,y=0,z=0)=>{const b=new THREE.Bone();b.position.set(x,y,z);p.add(b);return b;};
  function limb(parent,start,joint,end,r1,r2,clothColor,bareBelow){
    const vertices=[],indices=[],skinIndices=[],weights=[],rows=26,sides=16;
    const geo=new THREE.BufferGeometry();
    for(let row=0;row<=rows;row++){
      const y=.13-row/rows*.84;
      let radius=THREE.MathUtils.lerp(r1,r2,THREE.MathUtils.clamp(-y/.63,0,1));
      if(y>0)radius*=Math.sqrt(Math.max(.0001,1-(y/.13)**2));
      if(y<-.59)radius*=Math.sqrt(Math.max(.0001,1-((y+.59)/.12)**2));
      let index=0,weight=THREE.MathUtils.smoothstep(-y,.22,.45);
      if(y<-.54){index=1;weight=THREE.MathUtils.smoothstep(-y,.54,.66);}
      for(let j=0;j<=sides;j++){
        const angle=j/sides*Math.PI*2;vertices.push(start.position.x+Math.cos(angle)*radius,start.position.y+y,start.position.z+Math.sin(angle)*radius);
        skinIndices.push(index,index+1,0,0);weights.push(1-weight,weight,0,0);
      }
      if(row<rows){const offset=indices.length;for(let j=0;j<sides;j++){const a=row*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}geo.addGroup(offset,indices.length-offset,bareBelow!==null&&y<bareBelow?1:0);}
    }
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geo.setIndex(indices);geo.computeVertexNormals();
    const skinned=new THREE.SkinnedMesh(geo,[material(clothColor),material(c.skin)]);parent.add(skinned);root.updateMatrixWorld(true);skinned.bind(new THREE.Skeleton([start,joint,end]));skinned.castShadow=true;skinned.receiveShadow=true;skinned.frustumCulled=false;
    return skinned;
  }
  const body=group(root,0,.72,0);
  const female=a.gender==='female',width=female?.96:1;
  const shirt=group(body);shirt.scale.x=width;
  const tunic=a.shirt==='tunic';
  const profile=new THREE.CatmullRomCurve3((tunic?[[.43,-.14],[.455,-.11],[.45,-.02],[.39,.22],[.33,.48],[.345,.7],[.31,.81],[.215,.88],[.16,.92]]:[[.34,.035],[.365,.07],[.35,.3],[.32,.49],[.34,.7],[.305,.81],[.21,.88],[.16,.92]]).map(([r,y])=>new THREE.Vector3(r,y,0)));
  const clothGeometry=new THREE.LatheGeometry(profile.getPoints(40).map(p=>new THREE.Vector2(p.x,p.y)),40);
  const cloth=add(shirt,clothGeometry,c.shirt,0,0,0);cloth.scale.z=.84;
  function outline(parent,geo,color,x,y,z,sx,sy,sz){const tint=new THREE.Color(color).multiplyScalar(.54);const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:tint,side:THREE.BackSide}));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  outline(shirt,clothGeometry,c.shirt,0,0,0,1.017,1.01,.855);
  function stroke(parent,points,color,r=.008){return add(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,r,5,false),color,0,0,0);}
  const clothShade='#'+new THREE.Color(c.shirt).multiplyScalar(.75).getHexString();
  const collarColor='#'+new THREE.Color(c.shirt).lerp(new THREE.Color('#f0dfba'),.32).getHexString();
  if(tunic)stroke(shirt,[[-.15,.89,.13],[-.08,.73,.25],[.1,.48,.285],[.17,.2,.3]],collarColor,.013);
  else stroke(shirt,[[-.16,.88,.13],[-.1,.83,.23],[0,.81,.27],[.1,.83,.23],[.16,.88,.13]],collarColor,.012);
  if(tunic){
    stroke(shirt,[[-.21,.42,.235],[-.26,.16,.294],[-.29,-.1,.299]],clothShade,.006);
    stroke(shirt,[[.24,.35,.23],[.30,.12,.27],[.33,-.1,.277]],clothShade,.006);
    const belt=cyl(shirt,0,.25,0,.365,.37,.032,collarColor);belt.scale.z=.84;
  }else if(a.shirt==='long')for(let i=0;i<3;i++)ball(shirt,.02,.3+i*.17,.284,.017,.017,.01,collarColor);
  // A short neck is tucked into both shirt and head.
  cyl(body,0,.95,0,.155,.18,.25,c.skin);
  const head=group(body,0,1.28,0);
  ball(head,0,0,0,.46,.52,.425,c.skin);
  outline(head,sphere,c.skin,0,0,0,.468,.528,.433);
  const eyes=[];
  const cheekColor='#'+new THREE.Color(c.skin).lerp(new THREE.Color('#c87872'),.22).getHexString();
  for(const side of [-1,1]){
    ball(head,side*.445,-.015,0,.067,.105,.073,c.skin);
    const eye=group(head,side*.148,-.025,.41);
    ball(eye,0,0,0,.045,female?.06:.054,.026,'#493c32');ball(eye,-.011,.017,.021,.012,.017,.009,'#fff8e9');eyes.push(eye);
    const brow=ball(head,side*.148,.115,.405,.061,.013,.013,c.hair);brow.rotation.z=side*.1;
    ball(head,side*.26,-.135,.35,.061,.024,.011,cheekColor);
    if(female)stroke(head,[[side*.18,.005,.418],[side*.205,.022,.405]],c.hair,.006);
  }
  ball(head,0,-.087,.428,.029,.034,.034,c.skin);
  const smile=new THREE.CatmullRomCurve3([new THREE.Vector3(-.061,-.19,.395),new THREE.Vector3(0,-.21,.405),new THREE.Vector3(.061,-.19,.395)]);
  add(head,new THREE.TubeGeometry(smile,12,.009,5,false),'#a66e59',0,0,0);
  const hair=group(head);
  if(a.hair!=='bald'){
    add(hair,new THREE.SphereGeometry(.472,28,18,0,Math.PI*2,0,1.54),c.hair,0,.045,-.012,1,1.1,.93);
    if(['short','side'].includes(a.hair))for(let i=0;i<3;i++){const x=(i-1)*.18;const lock=ball(hair,x,.26+(a.hair==='side'?.055*(i-1):0),.32,.16,.135,.082,c.hair);lock.rotation.z=a.hair==='side'?-.48:(i-1)*.16;}
    if(a.hair==='bob'){ball(hair,0,-.12,-.21,.45,.44,.3,c.hair);for(const side of [-1,1])ball(hair,side*.35,-.13,.025,.12,.36,.24,c.hair);}
    if(a.hair==='long'){ball(hair,0,-.37,-.28,.39,.65,.2,c.hair);for(const side of [-1,1])capsule(hair,side*.36,-.22,-.035,.11,.55,c.hair);}
    if(a.hair==='ponytail'){ball(hair,0,.13,-.42,.21,.23,.18,c.hair);const tail=capsule(hair,0,-.27,-.49,.18,.48,c.hair);tail.rotation.x=-.2;ball(hair,0,.05,-.5,.16,.06,.15,c.hairTie);}
    if(a.hair==='braids')for(const side of [-1,1]){for(let i=0;i<5;i++)ball(hair,side*(.39+.012*Math.sin(i*2)),-.12-i*.125,-.015,.105,.115,.105,c.hair);ball(hair,side*.39,-.64,-.015,.11,.045,.11,c.hairTie);}
  }
  if(female&&a.hairAccessory!=='none'){
    const accessory=group(head,.32,.32,.23);accessory.rotation.z=-.35;
    if(a.hairAccessory==='bow'){
      for(const side of [-1,1]){const wing=ball(accessory,side*.115,0,0,.13,.09,.05,c.hairAccessory);wing.rotation.z=side*.3;const ribbon=capsule(accessory,side*.06,-.11,0,.035,.14,c.hairAccessory);ribbon.rotation.z=side*.3;}
      ball(accessory,0,0,.025,.057,.055,.055,c.hairAccessory);
    }else{const clip=capsule(accessory,0,0,0,.035,.2,c.hairAccessory);clip.rotation.z=Math.PI/2;ball(accessory,.08,0,.035,.045,.045,.025,c.hairAccessory);}
  }
  if(a.necklace){
    const points=[];for(let i=0;i<=40;i++){const t=i/40*Math.PI*2;points.push(new THREE.Vector3(Math.sin(t)*.33,.84-Math.cos(t)*.22,Math.cos(t)*.305));}
    const curve=new THREE.CatmullRomCurve3(points);add(body,new THREE.TubeGeometry(curve,40,.009,6,true),c.necklace,0,0,0);
    for(let i=0;i<22;i++){const p=curve.getPoint(i/22);ball(body,p.x,p.y,p.z,.025,.025,.025,c.necklace);}
    const pendant=ball(body,0,.57,.32,.045,.063,.02,c.necklace);pendant.rotation.z=.15;
  }
  const arms=[],elbows=[],wrists=[];
  for(const side of [-1,1]){
    const arm=bone(body,side*.345*width,.78,0),short=a.shirt==='short';
    const elbow=bone(arm,0,-.34,0),wrist=bone(elbow,0,-.29,0);
    limb(body,arm,elbow,wrist,.151,.1,c.shirt,short?-.24:null);
    ball(wrist,0,-.08,.018,.092,.12,.072,c.skin);ball(wrist,-side*.075,-.055,.055,.04,.065,.04,c.skin);
    arms.push(arm);elbows.push(elbow);wrists.push(wrist);
  }
  cyl(root,0,.72,0,.32,.33,.25,c.pants);
  const legs=[],knees=[],footMeshes=[];
  const foot=(...args)=>{const m=ball(...args);footMeshes.push(m);return m;};
  for(const side of [-1,1]){
    const leg=bone(root,side*.19,.72,0),wide=a.pants==='wide',shorts=a.pants==='shorts';
    const knee=bone(leg,0,-.34,0),ankle=bone(knee,0,-.29,0);
    limb(root,leg,knee,ankle,wide?.19:.16,wide?.17:.125,c.pants,shorts?-.3:null);
    if(a.shoes==='sandals'){
      foot(knee,0,-.275,.075,.15,.09,.245,c.skin);foot(knee,0,-.345,.075,.17,.045,.27,c.shoes);
      const strap=capsule(knee,0,-.26,.14,.033,.25,c.shoes);strap.rotation.z=Math.PI/2;
    }else{
      foot(knee,0,-.265,.07,.17,.105,.265,c.shoes);
      if(a.shoes==='sneakers'){foot(knee,0,-.355,.07,.175,.025,.27,c.shoeTrim);for(let i=0;i<3;i++){const lace=capsule(knee,0,-.152-i*.004,.08+i*.045,.009,.13,c.shoeTrim);lace.rotation.z=Math.PI/2;}}
    }
    legs.push(leg);knees.push(knee);
  }
  const heldIncense=group(body,0,.65,.58);cyl(heldIncense,0,.24,0,.012,.012,.52,'#ab7852');ball(heldIncense,0,.505,0,.021,.025,.021,'#e8a062');heldIncense.visible=false;
  const shadowPixels=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const r=Math.hypot((x-15.5)/16,(y-15.5)/16),i=(y*32+x)*4;shadowPixels[i]=58;shadowPixels[i+1]=62;shadowPixels[i+2]=43;shadowPixels[i+3]=Math.round(Math.max(0,1-r)**2*140);}
  const shadowMap=new THREE.DataTexture(shadowPixels,32,32,THREE.RGBAFormat);shadowMap.needsUpdate=true;
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.12,.72),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;root.add(shadow);
  const seed=JSON.stringify(a).split('').reduce((s,char)=>(s*31+char.charCodeAt(0))%2147483647,19);
  const result={root,body,head,shirt,hair,eyes,arms,elbows,wrists,legs,knees,footMeshes,footMatrix:new THREE.Matrix4(),inverseRoot:new THREE.Matrix4(),heldIncense,shadow,motion:createAvatarMotion(seed),appearance:a,signature:JSON.stringify(a),heading:Math.PI,geometries,materials};
  poseAvatar(result,{action:'stand'},0,1);
  result.motion.nextBlink=null;
  return result;
}

export function poseAvatar(model,player,time,dt){
  const motion=advanceAvatarMotion(model.motion,player,time,dt);model.motionOutput=motion;
  const {sit,bow,prayer,incense,reach,moveBlend,phase,breath}=motion;
  const damp=(value,target)=>THREE.MathUtils.damp(value,target,22,Math.min(dt,.1));
  model.body.position.y=.72+breath*.007*(1-bow);
  model.body.rotation.x=damp(model.body.rotation.x,bow*1.12-moveBlend*.035);
  model.body.rotation.z=Math.sin(phase)*moveBlend*.025*(1-sit);
  model.head.rotation.x=-sit*.05+bow*.08;
  model.head.rotation.z=Math.sin(phase)*moveBlend*-.015;
  model.eyes.forEach(eye=>eye.scale.y=Math.max(.045,motion.blink));
  model.shirt.rotation.z=Math.sin(phase+.4)*moveBlend*.018;
  model.hair.rotation.x=Math.sin(phase)*moveBlend*.012;
  const clasp=Math.max(sit,prayer);
  model.arms.forEach((arm,i)=>{
    const side=i===0?-1:1,swing=Math.sin(phase+i*Math.PI)*moveBlend;
    arm.rotation.x=damp(arm.rotation.x,.04+swing*.4*(1-clasp)-clasp*.94-incense*.65+reach*.2);
    arm.rotation.z=damp(arm.rotation.z,-side*(.08+clasp*.8-reach*.12));
    model.elbows[i].rotation.x=damp(model.elbows[i].rotation.x,-.1-clasp*.5-incense*.1);
    model.wrists[i].rotation.y=damp(model.wrists[i].rotation.y,side*clasp*.4);
  });
  model.legs.forEach((leg,i)=>{
    const side=i===0?-1:1,swing=Math.sin(phase+i*Math.PI)*moveBlend;
    leg.rotation.x=damp(leg.rotation.x,-swing*.48*(1-sit)-sit*1.35-bow*.3);
    leg.rotation.z=damp(leg.rotation.z,side*sit*.55);
    model.knees[i].rotation.x=damp(model.knees[i].rotation.x,.04+Math.max(0,swing)*.42*(1-sit)+sit*1.95+bow*.65);
    model.knees[i].rotation.z=damp(model.knees[i].rotation.z,-side*sit*.95);
  });
  // Solve the lowest point of the ellipsoid shoes in model coordinates. The
  // planted foot stays on the floor instead of clipping when knees bend.
  model.root.updateMatrixWorld(true);model.inverseRoot.copy(model.root.matrixWorld).invert();let floor=Infinity;
  for(const foot of model.footMeshes){model.footMatrix.multiplyMatrices(model.inverseRoot,foot.matrixWorld);const e=model.footMatrix.elements;floor=Math.min(floor,e[13]-Math.hypot(e[1],e[5],e[9]));}
  model.postureOffset=-floor;
  model.shadow.position.y=.012-model.postureOffset;model.shadow.scale.set(1+sit*.3,1+sit*.3,1);
  model.heldIncense.visible=incense>.03&&motion.progress<.84;
  model.heldIncense.position.set(0,.65+incense*.2-reach*.22,.58+reach*.3);
  model.heldIncense.rotation.x=-reach*.45;
}

export function disposeAvatar(model){
  model.root.removeFromParent();
  const textures=new Set(),geometries=new Set(),materials=new Set(),skeletons=new Set();
  model.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);if(o.material)for(const material of Array.isArray(o.material)?o.material:[o.material]){materials.add(material);if(material.map)textures.add(material.map);}});
  textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());
}

export function drawPortrait(canvas,a){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.save();c.scale(w/60,h/72);
  c.fillStyle=a.colors.shirt;c.beginPath();c.ellipse(30,65,20,22,0,0,Math.PI*2);c.fill();
  c.fillStyle=a.colors.skin;c.beginPath();c.ellipse(30,30,17,21,0,0,Math.PI*2);c.fill();
  if(a.hair!=='bald'){c.fillStyle=a.colors.hair;c.beginPath();c.ellipse(30,15,18,10,0,Math.PI,Math.PI*2);c.lineTo(48,24);c.quadraticCurveTo(33,9,13,24);c.fill();if(['long','bob','braids','ponytail'].includes(a.hair)){c.fillRect(12,18,5,24);c.fillRect(44,18,5,24);}}
  c.fillStyle='#443b32';for(const x of [24,36]){c.beginPath();c.ellipse(x,31,1.5,2,0,0,Math.PI*2);c.fill();}
  c.strokeStyle='#a46e59';c.lineWidth=1;c.beginPath();c.arc(30,36,4,0,Math.PI);c.stroke();
  if(a.gender==='female'&&a.hairAccessory!=='none'){c.fillStyle=a.colors.hairAccessory;c.beginPath();c.ellipse(43,18,7,3,-.3,0,Math.PI*2);c.fill();}
  c.restore();
}
