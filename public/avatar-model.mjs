import * as THREE from 'three';
import { createAvatarMotion,advanceAvatarMotion } from './avatar-motion.mjs';
import { createTomFaceTexture } from './tom-face.mjs';
import {addDoraemonDetails,drawDoraemonPortrait} from './doraemon-details.mjs';
import { createHumanAvatar,drawHumanPortrait } from './human-avatar.mjs';

// Each arm/leg is one continuous surface, deformed by its connected bones.
// Blended skin weights keep elbows and knees smooth throughout the animation.
export function createAvatar(appearance){
  if(!['tom','doraemon'].includes(appearance.special)){
    const model=createHumanAvatar(appearance);
    poseAvatar(model,{action:'stand'},0,1);model.motion.nextBlink=null;return model;
  }
  const tom=appearance.special==='tom',doraemon=appearance.special==='doraemon',cartoon=tom||doraemon;
  const a=cartoon?{...appearance,gender:'male',shirt:'short',pants:'straight',shoes:'slipon',hair:'bald',necklace:false,hairAccessory:'none'}:appearance;
  const c=doraemon?{...a.colors,shirt:'#008dcc',pants:'#008dcc',skin:'#f7faf6',shoes:'#f7faf6'}:tom?{...a.colors,shirt:'#77858b',pants:'#77858b',skin:'#f3f0df',shoes:'#f3f0df'}:a.colors,root=new THREE.Group(),geometries=new Map(),materials=new Map();
  const geometry=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key);};
  const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:cartoon?.8:.94}));return materials.get(color);};
  const sphere=geometry('sphere',()=>new THREE.SphereGeometry(1,32,24));
  function add(parent,geo,color,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geo,material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const ball=(p,x,y,z,rx,ry,rz,color)=>add(p,sphere,color,x,y,z,rx,ry,rz);
  const cyl=(p,x,y,z,r1,r2,h,color)=>add(p,geometry(`c:${r1}:${r2}:${h}`,()=>new THREE.CylinderGeometry(r1,r2,h,18)),color,x,y,z);
  const capsule=(p,x,y,z,r,length,color)=>add(p,geometry(`cap:${r}:${length}`,()=>new THREE.CapsuleGeometry(r,length,6,14)),color,x,y,z);
  const group=(p,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g;};
  const bone=(p,x=0,y=0,z=0)=>{const b=new THREE.Bone();b.position.set(x,y,z);p.add(b);return b;};
  function limb(parent,start,joint,end,r1,r2,clothColor,bareBelow){
    const vertices=[],indices=[],skinIndices=[],weights=[],rows=32,sides=24;
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
  if(doraemon)body.scale.y=.83;
  const female=a.gender==='female',width=female?.96:1;
  const shirt=group(body);shirt.scale.x=width;
  const tunic=a.shirt==='tunic';
  const profile=new THREE.CatmullRomCurve3((doraemon?[[0,-.39],[.23,-.38],[.36,-.26],[.435,-.03],[.445,.23],[.415,.48],[.35,.70],[.27,.84],[.19,.92],[0,.95]]:tom?[[0,-.19],[.16,-.17],[.26,-.10],[.30,.05],[.30,.25],[.265,.48],[.285,.67],[.255,.78],[.18,.87],[.13,.93],[0,.95]]:tunic?[[.43,-.14],[.455,-.11],[.45,-.02],[.39,.22],[.33,.48],[.345,.7],[.31,.81],[.215,.88],[.16,.92]]:[[.34,.035],[.365,.07],[.35,.3],[.32,.49],[.34,.7],[.305,.81],[.21,.88],[.16,.92]]).map(([r,y])=>new THREE.Vector3(r,y,0)));
  const clothGeometry=new THREE.LatheGeometry(profile.getPoints(cartoon?112:40).map(p=>new THREE.Vector2(p.x,p.y)),tom?96:doraemon?64:40);
  const cloth=add(shirt,clothGeometry,c.shirt,0,0,0);cloth.scale.z=.84;
  function outline(parent,geo,color,x,y,z,sx,sy,sz){const tint=new THREE.Color(color).multiplyScalar(.54);const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:tint,side:THREE.BackSide}));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  if(!cartoon)outline(shirt,clothGeometry,c.shirt,0,0,0,1.017,1.01,.855);
  if(cartoon){
    // The belly is a color on the continuous torso surface, without an overlay seam.
    const positions=clothGeometry.attributes.position,colors=[],fur=new THREE.Color(c.shirt),belly=new THREE.Color(doraemon?'#f7faf6':'#dce0db');
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      const ellipse=(x/(doraemon?.35:.225))**2+((y-(doraemon?.25:.34))/(doraemon?.49:.43))**2;
      const blend=(1-THREE.MathUtils.smoothstep(ellipse,.88,1.08))*THREE.MathUtils.smoothstep(z,.06,.17);
      const color=fur.clone().lerp(belly,blend);colors.push(color.r,color.g,color.b);
    }
    clothGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    cloth.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});
  }
  function stroke(parent,points,color,r=.008){return add(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,r,5,false),color,0,0,0);}
  const clothShade='#'+new THREE.Color(c.shirt).multiplyScalar(.75).getHexString();
  const collarColor='#'+new THREE.Color(c.shirt).lerp(new THREE.Color('#f0dfba'),.32).getHexString();
  if(tunic)stroke(shirt,[[-.15,.89,.13],[-.08,.73,.25],[.1,.48,.285],[.17,.2,.3]],collarColor,.013);
  else if(!cartoon)stroke(shirt,[[-.16,.88,.13],[-.1,.83,.23],[0,.81,.27],[.1,.83,.23],[.16,.88,.13]],collarColor,.012);
  if(tunic){
    stroke(shirt,[[-.21,.42,.235],[-.26,.16,.294],[-.29,-.1,.299]],clothShade,.006);
    stroke(shirt,[[.24,.35,.23],[.30,.12,.27],[.33,-.1,.277]],clothShade,.006);
    const belt=cyl(shirt,0,.25,0,.365,.37,.032,collarColor);belt.scale.z=.84;
  }else if(a.shirt==='long')for(let i=0;i<3;i++)ball(shirt,.02,.3+i*.17,.284,.017,.017,.01,collarColor);
  // A short neck is tucked into both shirt and head.
  if(cartoon)ball(body,0,.95,-.015,.145,.22,.14,c.shirt);
  else cyl(body,0,.95,0,.155,.18,.25,c.skin);
  const head=group(body,0,1.28,0);
  if(doraemon){head.position.y=1.39;head.scale.y=1/.83;}
  const faceStart=head.children.length;
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
  if(tom){
    // Replace the human face, retaining the same animated head and limb rig.
    head.children.slice(faceStart).forEach(o=>{o.visible=false;});eyes.length=0;
    head.scale.setScalar(.9);
    const face=add(head,new THREE.SphereGeometry(1,64,48),'#77858b',0,.015,0,.43,.43,.35);
    face.material=new THREE.MeshStandardMaterial({map:createTomFaceTexture(),roughness:.8});
    for(const side of [-1,1]){
      const ear=group(head,side*.285,.255,-.045);ear.rotation.z=-side*.30;
      const shape=new THREE.Shape();shape.moveTo(-.155,-.045);shape.quadraticCurveTo(-.17,.13,-.025,.44);shape.quadraticCurveTo(0,.49,.03,.43);shape.quadraticCurveTo(.18,.12,.17,-.035);shape.quadraticCurveTo(0,-.1,-.155,-.045);
      const geo=new THREE.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelThickness:.035,bevelSize:.028,bevelSegments:4,curveSegments:14,steps:1});
      add(ear,geo,'#77858b',0,0,0);add(ear,geo,'#dca7a3',0,.035,.104,.68,.75,.12);
      const eye=group(head,side*.155,.11,.32);
      ball(eye,0,0,0,.108,.15,.043,'#e2e7a2');ball(eye,-side*.012,-.006,.039,.043,.091,.018,'#25342c');ball(eye,-.025,.045,.055,.021,.027,.009,'#ffffff');eyes.push(eye);
      stroke(head,[[side*.06,.267,.30],[side*.15,.297,.30],[side*.25,.277,.27]],'#344249',.013);
    }
    for(let i=0;i<3;i++){const tuft=add(head,new THREE.ConeGeometry(.045,.15,16),'#77858b',-.11+i*.075,.425,-.04);tuft.rotation.z=-.35+i*.22;}
  }
  if(doraemon){
    head.children.slice(faceStart).forEach(o=>{o.visible=false;});eyes.length=0;
    addDoraemonDetails({head,body,shirt,eyes,ball,add,stroke,profile});
  }
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
    const arm=bone(body,side*(doraemon?.40:tom?.285:.345)*width,doraemon?.65:tom?.76:.78,0),short=a.shirt==='short';
    const elbow=bone(arm,0,-.34,0),wrist=bone(elbow,0,-.29,0);
    limb(body,arm,elbow,wrist,doraemon?.16:tom?.125:.151,doraemon?.11:tom?.075:.1,c.shirt,cartoon?-.585:short?-.24:null);
    ball(wrist,0,-.065,.018,doraemon?.14:tom?.084:.092,doraemon?.14:tom?.105:.12,doraemon?.13:.072,c.skin);
    if(!doraemon)ball(wrist,-side*(tom?.061:.075),-.045,.05,tom?.033:.04,.055,.038,c.skin);
    arms.push(arm);elbows.push(elbow);wrists.push(wrist);
  }
  if(!cartoon)cyl(root,0,.72,0,.32,.33,.25,c.pants);
  const legs=[],knees=[],ankles=[],footMeshes=[];
  const foot=(...args)=>{const m=ball(...args);footMeshes.push(m);return m;};
  for(const side of [-1,1]){
    const leg=bone(root,side*(tom?.155:.19),.72,0),wide=a.pants==='wide',shorts=a.pants==='shorts';
    const knee=bone(leg,0,-.34,0),ankle=bone(knee,0,-.29,0);
    limb(root,leg,knee,ankle,doraemon?.17:tom?.143:wide?.19:.16,doraemon?.12:tom?.092:wide?.17:.125,c.pants,shorts?-.3:null);
    if(a.shoes==='sandals'){
      foot(ankle,0,.015,.075,.15,.09,.245,c.skin);foot(ankle,0,-.055,.075,.17,.045,.27,c.shoes);
      const strap=capsule(ankle,0,.03,.14,.033,.25,c.shoes);strap.rotation.z=Math.PI/2;
    }else{
      foot(ankle,0,.025,.07,doraemon?.18:tom?.137:.17,doraemon?.115:tom?.095:.105,doraemon?.255:tom?.215:.265,c.shoes);
      if(a.shoes==='sneakers'){foot(ankle,0,-.065,.07,.175,.025,.27,c.shoeTrim);for(let i=0;i<3;i++){const lace=capsule(ankle,0,.138-i*.004,.08+i*.045,.009,.13,c.shoeTrim);lace.rotation.z=Math.PI/2;}}
    }
    legs.push(leg);knees.push(knee);ankles.push(ankle);
  }
  const heldIncense=group(body,0,.65,.58);cyl(heldIncense,0,.24,0,.012,.012,.52,'#ab7852');ball(heldIncense,0,.505,0,.021,.025,.021,'#e8a062');heldIncense.visible=false;
  let tail=null;
  if(tom){
    tail=group(body,0,.05,-.18);
    const curve=new THREE.CatmullRomCurve3([[0,0,0],[.12,-.055,-.25],[.31,.015,-.46],[.43,.21,-.56],[.45,.35,-.55]].map(p=>new THREE.Vector3(...p)));
    const geo=new THREE.TubeGeometry(curve,40,.09,14,false),positions=geo.attributes.position,colors=[];
    for(let i=0;i<positions.count;i++){
      const t=Math.floor(i/15)/40,center=curve.getPointAt(t),radius=1-.75*THREE.MathUtils.smoothstep(t,.1,1);
      const p=new THREE.Vector3().fromBufferAttribute(positions,i).sub(center).multiplyScalar(radius).add(center);positions.setXYZ(i,p.x,p.y,p.z);
      const tint=new THREE.Color('#77858b').lerp(new THREE.Color('#f3f0df'),THREE.MathUtils.smoothstep(t,.77,.82));colors.push(tint.r,tint.g,tint.b);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8}));mesh.castShadow=true;tail.add(mesh);
    ball(tail,.45,.35,-.55,.024,.025,.024,'#f3f0df');
  }
  if(doraemon){
    tail=group(body,0,-.15,-.35);tail.name='doraemon-red-tail';
    const stem=cyl(tail,0,0,-.07,.025,.025,.14,'#e9383b');stem.rotation.x=Math.PI/2;
    ball(tail,0,0,-.16,.085,.085,.085,'#e9383b');
  }
  const shadowPixels=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const r=Math.hypot((x-15.5)/16,(y-15.5)/16),i=(y*32+x)*4;shadowPixels[i]=58;shadowPixels[i+1]=62;shadowPixels[i+2]=43;shadowPixels[i+3]=Math.round(Math.max(0,1-r)**2*140);}
  const shadowMap=new THREE.DataTexture(shadowPixels,32,32,THREE.RGBAFormat);shadowMap.needsUpdate=true;
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.12,.72),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;root.add(shadow);
  const seed=JSON.stringify(a).split('').reduce((s,char)=>(s*31+char.charCodeAt(0))%2147483647,19);
  const down=new THREE.Vector3(0,-1,0);
  const seatedLegs=[-1,1].map(side=>{
    const upper=new THREE.Quaternion().setFromUnitVectors(down,new THREE.Vector3(side*(doraemon?.65:.70),doraemon?-.70:-.12,doraemon?.65:.70).normalize());
    const lower=new THREE.Quaternion().setFromUnitVectors(down,new THREE.Vector3(-side*.98,doraemon?-.30:-.10,.15).normalize());
    const foot=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-side*1.3);
    return{upper,knee:upper.clone().invert().multiply(lower),ankle:lower.clone().invert().multiply(foot)};
  });
  const seatedArms=[-1,1].map(side=>{
    const upper=new THREE.Quaternion().setFromUnitVectors(down,new THREE.Vector3(side*.10,-.76,.64).normalize());
    const lower=new THREE.Quaternion().setFromUnitVectors(down,new THREE.Vector3(-side*.95,side*.16,.27).normalize());
    return{upper,elbow:upper.clone().invert().multiply(lower)};
  });
  const sofaLegs=[-1,1].map(side=>{const upper=new THREE.Quaternion().setFromUnitVectors(down,new THREE.Vector3(side*.08,-.1,.99).normalize());return{upper,knee:upper.clone().invert(),ankle:new THREE.Quaternion()};});
  const sofaArms=[-1,1].map(side=>({upper:new THREE.Quaternion().setFromEuler(new THREE.Euler(-.22,0,-side*.5)),elbow:new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.15,0,0))}));
  const result={root,body,head,shirt,hair,eyes,tail,arms,elbows,wrists,legs,knees,ankles,seatedLegs,seatedArms,sofaLegs,sofaArms,footMeshes,footMatrix:new THREE.Matrix4(),inverseRoot:new THREE.Matrix4(),heldIncense,shadow,motion:createAvatarMotion(seed),appearance,signature:JSON.stringify(appearance),heading:Math.PI,geometries,materials};
  poseAvatar(result,{action:'stand'},0,1);
  result.motion.nextBlink=null;
  return result;
}

export function poseAvatar(model,player,time,dt){
  const motion=advanceAvatarMotion(model.motion,player,time,dt);model.motionOutput=motion;
  const {sit,bow,prayer,incense,reach,moveBlend,phase,breath}=motion;
  model.seatedOnSofa=!!player.sofaSeatId||!!model.seatedOnSofa&&sit>0;
  const damp=(value,target)=>THREE.MathUtils.damp(value,target,22,Math.min(dt,.1));
  // A broom blow leans the torso for one frame only; take it out before damping.
  model.body.rotation.x-=model.strikeLean||0;model.strikeLean=0;
  model.body.position.y=(model.rig?.hipHeight??.72)+breath*.007*(1-bow);
  model.body.rotation.x=damp(model.body.rotation.x,bow*1.12-moveBlend*.035);
  model.body.rotation.z=Math.sin(phase)*moveBlend*.025*(1-sit);
  model.head.rotation.x=-sit*.05+bow*.08;
  model.head.rotation.z=Math.sin(phase)*moveBlend*-.015;
  model.eyes.forEach(eye=>eye.scale.y=Math.max(.045,motion.blink));
  model.shirt.rotation.z=Math.sin(phase+.4)*moveBlend*.018;
  model.garments?.forEach(piece=>{piece.morphTargetInfluences[0]=sit;});
  model.hair.rotation.x=Math.sin(phase)*moveBlend*.012;
  if(model.tail)model.tail.rotation.y=Math.sin(time*2)*.15+Math.sin(phase)*moveBlend*.18;
  const clasp=Math.max(sit,prayer);
  model.arms.forEach((arm,i)=>{
    const side=i===0?-1:1,swing=Math.sin(phase+i*Math.PI)*moveBlend;
    const relaxedArm=model.rig?side*.035:side*.12;
    arm.rotation.set(.04+swing*.4*(1-clasp),0,relaxedArm);
    const armPose=model.seatedOnSofa?model.sofaArms[i]:model.seatedArms[i];
    arm.quaternion.slerp(armPose.upper,sit);
    model.elbows[i].rotation.set(-.1,0,0);model.elbows[i].quaternion.slerp(armPose.elbow,sit);
    model.wrists[i].rotation.set(0,damp(model.wrists[i].rotation.y,side*clasp*.4),0);
    if(prayer>0){
      // Solve each arm toward its own side of the chest. The outward elbow
      // pole keeps the forearms folded neatly without crossing the centerline.
      const wrist=model.wrists[i],elbow=model.elbows[i],down=new THREE.Vector3(0,-1,0);
      const target=new THREE.Vector3(side*.105,.55+incense*.05-reach*.08,.35+reach*.14);
      const upperLength=model.rig?.armUpper??.34,lowerLength=model.rig?.armLower??.29;
      const delta=target.clone().sub(arm.position),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(upperLength-lowerLength)+.005,upperLength+lowerLength-.005),axis=delta.normalize();
      target.copy(arm.position).addScaledVector(axis,distance);
      const along=(upperLength**2-lowerLength**2+distance**2)/(2*distance);
      const pole=new THREE.Vector3(side*.8,-1,.1);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
      const joint=arm.position.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,upperLength**2-along**2)));
      const upper=new THREE.Quaternion().setFromUnitVectors(down,joint.clone().sub(arm.position).normalize());
      const lower=new THREE.Quaternion().setFromUnitVectors(down,target.sub(joint).normalize());
      arm.quaternion.slerp(upper,prayer);elbow.quaternion.slerp(upper.clone().invert().multiply(lower),prayer);
      const hand=new THREE.Quaternion().setFromEuler(new THREE.Euler(-2.3,side*.3,0));
      const localHand=arm.quaternion.clone().multiply(elbow.quaternion).invert().multiply(hand);
      wrist.quaternion.slerp(localHand,prayer);
    }
  });
  model.legs.forEach((leg,i)=>{
    const swing=Math.sin(phase+i*Math.PI)*moveBlend,seat=(model.seatedOnSofa?model.sofaLegs:model.seatedLegs)[i];
    leg.rotation.set(-swing*.48-bow*.3,0,0);leg.quaternion.slerp(seat.upper,sit);
    model.knees[i].rotation.set(.04+Math.max(0,swing)*.42+bow*.65,0,0);model.knees[i].quaternion.slerp(seat.knee,sit);
    model.ankles[i].quaternion.identity().slerp(seat.ankle,sit);
  });
  // Solve the lowest point of the ellipsoid shoes in model coordinates. The
  // planted foot stays on the floor instead of clipping when knees bend.
  model.root.updateMatrixWorld(true);model.inverseRoot.copy(model.root.matrixWorld).invert();let floor=Infinity;
  for(const foot of model.footMeshes){model.footMatrix.multiplyMatrices(model.inverseRoot,foot.matrixWorld);const e=model.footMatrix.elements;floor=Math.min(floor,e[13]-Math.hypot(e[1],e[5],e[9]));}
  model.postureOffset=model.seatedOnSofa?THREE.MathUtils.lerp(-floor,model.rig?-model.rig.seatOffset:model.appearance.special==='doraemon'?-(.72-.39*.83):-.595,sit):-floor;
  model.shadow.position.y=.012-model.postureOffset;model.shadow.scale.set(1+sit*.3,1+sit*.3,1);
  model.heldIncense.visible=incense>.03&&motion.progress<.84;
  model.heldIncense.position.set(0,.59+incense*.05-reach*.08,.41+reach*.14);
  model.heldIncense.rotation.x=-reach*.15;
}

export function disposeAvatar(model){
  model.root.removeFromParent();
  const textures=new Set(),geometries=new Set(),materials=new Set(),skeletons=new Set();
  model.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);if(o.material)for(const material of Array.isArray(o.material)?o.material:[o.material]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());
}

export function drawPortrait(canvas,a){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.save();c.scale(w/60,h/72);
  if(a.special==='doraemon'){drawDoraemonPortrait(c);c.restore();return;}
  if(a.special==='tom'){
    c.fillStyle='#77858b';c.beginPath();c.ellipse(30,64,20,23,0,0,Math.PI*2);c.fill();
    for(const side of [-1,1]){const x=30+side*15;c.beginPath();c.moveTo(x-side*11,27);c.lineTo(x+side*7,2);c.lineTo(x+side*10,34);c.fill();c.fillStyle='#dfaaa6';c.beginPath();c.moveTo(x-side*5,25);c.lineTo(x+side*6,8);c.lineTo(x+side*6,29);c.fill();c.fillStyle='#77858b';}
    c.beginPath();c.ellipse(30,33,21,22,0,0,Math.PI*2);c.fill();
    for(const x of [23,37]){c.fillStyle='#e4e89c';c.beginPath();c.ellipse(x,30,6,10,0,0,Math.PI*2);c.fill();c.fillStyle='#25342c';c.fillRect(x-1,25,2,12);c.fillStyle='#f3f0df';c.beginPath();c.ellipse(x,43,9,6,0,0,Math.PI*2);c.fill();}
    c.fillStyle='#27353c';c.beginPath();c.ellipse(30,39,4,3,0,0,Math.PI*2);c.fill();c.restore();return;
  }
  drawHumanPortrait(c,a);
  c.restore();
}
