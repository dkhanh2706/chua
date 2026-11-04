import * as THREE from 'three';
import { eyePose } from './embodiment.mjs';
import { createAvatar,poseAvatar,disposeAvatar } from './avatar-model.mjs';
import { AvatarStudio } from './avatar-studio.mjs';
import { TempleGarden } from './garden.mjs';
import { GardenLandscape } from './landscape.mjs';
import { buildTempleInterior } from './temple-interior.mjs';
import { YardCare,createBroom } from './yard-care.mjs';

const { WORLD, URN, riverX, groundHeight } = window;
const TAU=Math.PI*2;
const position=(x,y)=>new THREE.Vector3((x-500)/10,groundHeight(x,y),(y-350)/10);
const materials=new Map();
function mat(color,extra={}){const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.87,...extra}));return materials.get(key);}
const boxGeo=new THREE.BoxGeometry(1,1,1),sphereGeo=new THREE.SphereGeometry(1,16,12),leafGeo=new THREE.IcosahedronGeometry(1,1);
function mesh(parent,geometry,material,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(p,x,y,z,w,h,d,color){return mesh(p,boxGeo,mat(color),x,y,z,w,h,d);}
function ball(p,x,y,z,rx,ry,rz,color){return mesh(p,sphereGeo,mat(color),x,y,z,rx,ry,rz);}
function cylinder(p,x,y,z,r1,r2,h,color,segments=16){return mesh(p,new THREE.CylinderGeometry(r1,r2,h,segments),mat(color),x,y,z);}
function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function beam(p,a,b,r,color){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),m=cylinder(p,...va.clone().add(vb).multiplyScalar(.5).toArray(),r,r,va.distanceTo(vb),color,8);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());return m;}
function instances(parent,geo,material,transforms){const m=new THREE.InstancedMesh(geo,material,transforms.length);const dummy=new THREE.Object3D();transforms.forEach((t,i)=>{dummy.position.set(...t.p);dummy.scale.set(...(t.s||[1,1,1]));dummy.rotation.set(...(t.r||[0,0,0]));dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function textSprite(text,color='#fcf5dc',background='#354638dd',scale=1){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.font='500 36px Arial';const width=Math.min(500,c.measureText(text).width+40);c.fillStyle=background;c.beginPath();c.roundRect((512-width)/2,6,width,72,25);c.fill();c.fillStyle=color;c.textAlign='center';c.fillText(text,256,55);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});const sprite=new THREE.Sprite(material);sprite.scale.set(6.1*scale,1.15*scale,1);sprite.renderOrder=10;return sprite;
}

// Curved hip roofs: ring surfaces flare slightly upward along the eaves.
function roof(parent,x,z,width,depth,base,height,color){
  const g=group(parent,x,0,z),vertices=[],indices=[],lines=[];
  function point(t,side,u){
    // Thêm độ cong hiên (eave flare) mạnh hơn ở mép dưới
    const w=width*(1-.50*t)/2,d=depth*(1-t)/2+.02;
    const y=base+height*Math.pow(t,.78)+.75*Math.pow(1-t,8);
    const corners=[[-w,-d],[w,-d],[w,d],[-w,d]];
    const a=corners[side],b=corners[(side+1)%4];
    return [a[0]+(b[0]-a[0])*u,y,a[1]+(b[1]-a[1])*u];
  }
  const layers=16,segments=24;
  for(let side=0;side<4;side++){
    const start=vertices.length/3;
    for(let i=0;i<=layers;i++)for(let j=0;j<=segments;j++)vertices.push(...point(i/layers,side,j/segments));
    for(let i=0;i<layers;i++)for(let j=0;j<segments;j++){const a=start+i*(segments+1)+j,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
    for(let j=0;j<=segments;j++)for(let i=0;i<layers;i++){const a=point(i/layers,side,j/segments),b=point((i+1)/layers,side,j/segments);a[1]+=.03;b[1]+=.03;lines.push(...a,...b);}
    for(let i=0;i<layers;i+=2)for(let j=0;j<segments;j++){const a=point(i/layers,side,j/segments),b=point(i/layers,side,(j+1)/segments);a[1]+=.04;b[1]+=.04;lines.push(...a,...b);}
    // Thanh hiên (eave fascia) ở mép dưới mái – nối liền mạch không bị đứt
    for(let j=0;j<segments;j++){
      const a=point(0,side,j/segments),b=point(0,side,(j+1)/segments);
      beam(g,a,b,.14,'#c5a55b');
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  mesh(g,geometry,mat(color,{side:THREE.DoubleSide}));
  const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));g.add(new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:'#b5c4a3',transparent:true,opacity:.22})));
  // Thanh nóc mái dày hơn, nổi bật hơn
  box(g,0,base+height+.22,0,width*.52,.28,.52,'#b89645');
  beam(g,[-width*.26,base+height+.15,0],[width*.26,base+height+.15,0],.22,'#c3a45e');
  // Đầu đao góc mái (finial ornament)
  for(const side of [-1,1]){
    const xx=side*width*.27;
    ball(g,xx,base+height+.38,0,.32,.44,.32,'#c8a75c');
    beam(g,[xx,base+height+.24,0],[xx+side*1.0,base+height+1.05,0],.11,'#c3a05a');
    ball(g,xx+side*1.0,base+height+1.1,0,.18,.22,.18,'#d4b55e');
  }
  return g;
}
function createGameAvatar(parent,p){
  const appearance=window.AvatarConfig.normalize(p.avatar,p.character,p.color);
  const model=createAvatar(appearance);parent.add(model.root);
  const label=textSprite(p.name||'',p.isMe?'#fff4c7':'#f6f4e6',p.isMe?'#607343ed':'#354638cf',.7);
  label.position.y=3.1;label.visible=!!p.name;model.root.add(label);model.label=label;
  return model;
}
export class TempleView {
  constructor(canvas){
    this.canvas=canvas;this.mode='panorama';this.yaw=0;this.pitch=.76;this.zoom=1;this.active=false;this.models=new Map();this.incense=new Map();this.smoke=[];this.roofs=[];this.leaves=[];this.look=new THREE.Vector3(0,0,5);this.ray=new THREE.Raycaster();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.lastTime=0;this.ready=false;
    this.mobile=window.matchMedia('(pointer: coarse)').matches||window.innerWidth<800;
    this.batterySaver=this.mobile;try{const saved=localStorage.getItem('temple-battery-saver');if(saved!==null)this.batterySaver=saved==='true';}catch{}
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'default'});this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,this.batterySaver?1.2:1.6));this.renderer.shadowMap.enabled=!this.batterySaver;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.studio=new AvatarStudio(this.renderer);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#d7e2d1');this.scene.fog=new THREE.Fog('#d7e2d1',95,210);
    this.camera=new THREE.PerspectiveCamera(47,1,.2,350);this.camera.position.set(0,66,68);this.camera.lookAt(this.look);
    this.eyePitch=-.035;this.eyeHeight=2.02;this.eyeNeedsSnap=true;
    this.gentleMotion=true;try{this.gentleMotion=localStorage.getItem('temple-gentle-motion')!=='false';}catch{}
    this.scene.add(this.camera);this.buildHands();
    this.daylight=new THREE.HemisphereLight('#fff5df','#778762',2.5);this.scene.add(this.daylight);const sun=new THREE.DirectionalLight('#ffdfac',3.1);sun.position.set(-35,65,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.normalBias=.06;sun.shadow.bias=-.0003;sun.shadow.camera.far=150;this.sunlight=sun;this.scene.add(sun);this.scene.add(sun.target);
    this.worldRoot=group(this.scene);this.worldBuilt=false;this.canvas.dataset.renderer='webgl';this.canvas.dataset.cameraMode=this.mode;
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.ready=false;canvas.dispatchEvent(new CustomEvent('render-error'));});
    canvas.addEventListener('webglcontextrestored',()=>{this.ready=true;this.studio.dirty=true;this.width=0;});
    this.ready=true;
  }
  buildWorld(){
    const s=this.worldRoot;let seed=917;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
    box(s,0,-.7,0,114,1.4,88,'#95a778');
    const grass=[];for(let i=0;i<700;i++){const x=random()*106-53,z=random()*78-39;if(Math.abs(x)<46&&z>-22&&z<30)continue;grass.push({p:[x,.012,z],s:[.12+random()*.22,.03,.14+random()*.35],r:[0,random()*TAU,0]});}instances(s,boxGeo,mat('#acb78b'),grass);
    // Forested mountain silhouettes and a warm sun beyond the garden.
    for(let i=0;i<14;i++){const mountain=mesh(s,new THREE.ConeGeometry(13+random()*14,20+random()*25,6),mat(i%2?'#9fb29b':'#afbfaa'),(i-7)*17,-1,-75-random()*35);mountain.rotation.y=random();mountain.castShadow=false;}
    const sun=ball(s,-46,48,-105,7,7,3,'#fff1c9');sun.material=new THREE.MeshBasicMaterial({color:'#fff1c9'});

    this.landscape=new GardenLandscape(s);
    // Lotus pond, petals and lily pads.
    const pond=mesh(s,new THREE.CylinderGeometry(1,1,.12,64),mat('#80afa0',{roughness:.25,metalness:.1}),-29.6,0,10.1,13.4,1,8.6);
    for(let i=0;i<42;i++){const a=i/42*TAU;mesh(s,leafGeo,mat('#9eaa8a'),-29.6+Math.cos(a)*13.6,.25,10.1+Math.sin(a)*8.8,.65,.4,.65);}
    for(let i=0;i<19;i++){const a=random()*TAU,r=Math.sqrt(random())*.83,x=-29.6+Math.cos(a)*12.8*r,z=10.1+Math.sin(a)*8*r;const pad=cylinder(s,x,.12,z,1,1,.045,'#688f6e',16);pad.scale.z=.7;if(i%2===0){beam(s,[x,.12,z],[x,.65,z],.035,'#6b9164');for(let j=0;j<7;j++){const a=j/7*TAU,petal=ball(s,x+Math.cos(a)*.19,.68,z+Math.sin(a)*.19,.17,.36,.12,j%2?'#e1b3b1':'#f4d0c5');petal.rotation.z=Math.sin(a)*.5;petal.rotation.x=Math.cos(a)*.5;}ball(s,x,.72,z,.13,.15,.13,'#e4c56f');}}
    this.buildTemple();this.buildUrn();
    // Boundary walls are broken at the entrance and the stream.
    for(const [x,width] of [[-29,37],[15,9],[39,17]]){box(s,x,1,31.5,width,2,1,'#cfcaad');box(s,x,2.15,31.5,width+.5,.28,1.4,'#6e816a');}
    for(const x of [-48,48]){box(s,x,1,0,1,2,62,'#c9c8ab');box(s,x,2.12,0,1.4,.25,62,'#788a6e');}
    // Keep the waterfall outlet open through the rear boundary.
    for(const [x,width] of [[-33,27],[22.5,6],[41.5,10]]){box(s,x,1,-24,width,2,1,'#c5c4a4');box(s,x,2.15,-24,width,.3,1.4,'#76886b');}
    // The entrance gate frames the first steps into the courtyard.
    for(const x of [-8,8]){
      // Chân cột cổng: đế vuông rồi đế tròn
      box(s,x,.28,30.7,1.5,.56,1.5,'#c7c1a0');
      cylinder(s,x,.60,30.7,.58,.58,.12,'#b8b298',16);
      // Thân cột liên tục
      cylinder(s,x,3.5,30.7,.38,.44,7,'#865b3d');
      // Mũ cột: đệm tròn + đệm vuông
      cylinder(s,x,7.12,30.7,.52,.52,.18,'#9a6838',16);
      box(s,x,7.24,30.7,.92,.12,.92,'#9a7850');
    }
    // Xà ngang nối đầu hai cột cổng
    beam(s,[-8,7.3,30.7],[8,7.3,30.7],.2,'#7a4a28');
    // Mảng tường cổng bên trên xà
    box(s,0,7.3,30.7,16.4,.06,1.2,'#c8bfa5');
    this.gateRoof=roof(s,0,30.7,21,7,7.3,2.9,'#526d58');this.gateRoof.traverse(o=>{if(o.material)o.material=o.material.clone();});
    this.garden=new TempleGarden(s,{batterySaver:this.batterySaver,groundHeight});
    this.yardCare=new YardCare(s,this.garden,groundHeight);
    // Incense target ring appears when the player chooses a destination.
    this.destination=mesh(s,new THREE.RingGeometry(.45,.55,40),new THREE.MeshBasicMaterial({color:'#fff1bc',transparent:true,opacity:.8,side:THREE.DoubleSide}),0,.2,0);this.destination.rotation.x=-Math.PI/2;this.destination.visible=false;
  }
  buildTemple(){
    const s=this.worldRoot;
    this.interior=buildTempleInterior(s);
    const upper=group(s);
    box(upper,0,13.2,-17.5,23,5,12,'#a88b65');
    for(const x of [-10,-6,6,10])for(const z of [-11.4,-23.6])box(upper,x,13.2,z,.3,4.7,.35,'#67432d');
    this.roofs.push(roof(s,0,-17.5,45,28,10.4,5,'#506e5e'),upper,roof(s,0,-17.5,29,18,15.9,4,'#52745f'),this.interior.ceiling);
    this.roofs.forEach(g=>g.traverse(o=>{if(o.material){o.material=o.material.clone();o.userData.roof=true;}}));
  }
  buildUrn(){
    const p=position(URN.x,URN.y),g=group(this.worldRoot,p.x,p.y,p.z);this.urn=g;
    g.name='indoor-incense-burner';
    box(g,0,.12,0,4,.24,3.4,'#65503a');
    const profile=[[.72,.34],[1.1,.43],[1.5,.8],[1.66,1.32],[1.62,1.46],[1.47,1.46],[1.42,1.25],[1.25,1.03]].map(([r,y])=>new THREE.Vector2(r,y));
    mesh(g,new THREE.LatheGeometry(profile,64),mat('#987343',{metalness:.55,roughness:.43,side:THREE.DoubleSide}));
    cylinder(g,0,1.435,0,1.47,1.47,.035,'#aa987a',48);
    const rim=mesh(g,new THREE.TorusGeometry(1.58,.08,12,64),mat('#c09a57',{metalness:.55,roughness:.4}),0,1.47,0);rim.rotation.x=Math.PI/2;
    for(let i=0;i<3;i++){const a=i/3*TAU;beam(g,[Math.cos(a)*.9,.6,Math.sin(a)*.9],[Math.cos(a)*1.15,.26,Math.sin(a)*1.15],.13,'#84633c');}
    for(const x of [-1,1]){const handle=mesh(g,new THREE.TorusGeometry(.4,.09,10,32),mat('#b59051'),x*1.78,1.18,0);handle.rotation.y=.3;}
    this.smokeGeo=new THREE.SphereGeometry(1,7,5);
  }
  buildHands(){
    this.hands=group(this.camera);this.hands.visible=false;this.handArms=[];
    this.sleeveMaterial=new THREE.MeshStandardMaterial({color:'#a46e46',roughness:.9});
    this.handSkinMaterial=new THREE.MeshStandardMaterial({color:'#e7bb8e',roughness:.82});
    for(const side of [-1,1]){
      const arm=group(this.hands,side*.24,-.77,-.9);arm.scale.setScalar(.55);
      mesh(arm,new THREE.CylinderGeometry(.095,.14,.36,12),this.sleeveMaterial,0,-.1,0);
      ball(arm,0,.14,0,.085,.12,.055,'#e7bb8e');
      for(let i=0;i<4;i++)ball(arm,(i-1.5)*.036,.24+(i===0||i===3?-.02:.01),0,.02,.085,.025,'#e7bb8e');
      const thumb=ball(arm,-side*.09,.12,.015,.032,.085,.035,'#d9a87c');thumb.rotation.z=-side*.5;
      arm.traverse(o=>{o.castShadow=false;if(o.isMesh&&o.material!==this.sleeveMaterial)o.material=this.handSkinMaterial;});this.handArms.push(arm);
    }
    this.heldIncense=group(this.hands,0,-.51,-.88);
    cylinder(this.heldIncense,0,.17,0,.007,.007,.42,'#a96545',8);
    const ember=ball(this.heldIncense,0,.38,0,.012,.014,.012,'#f8a35e');ember.material=new THREE.MeshBasicMaterial({color:'#ffb171'});
    this.handSmoke=[];for(let i=0;i<3;i++){const puff=mesh(this.heldIncense,new THREE.SphereGeometry(1,7,5),new THREE.MeshBasicMaterial({color:'#f4ebda',transparent:true,opacity:.15,depthWrite:false}),0,.55,0,.015,.025,.015);this.handSmoke.push(puff);}
    this.heldIncense.traverse(o=>{o.castShadow=false;});this.heldIncense.visible=false;
    this.handBroom=createBroom();this.handBroom.scale.setScalar(.7);this.handBroom.visible=false;this.hands.add(this.handBroom);
  }
  updateHands(p,pose,time,dt){
    this.hands.visible=this.active&&this.mode==='first';if(!this.hands.visible)return;
    const appearance=window.AvatarConfig.normalize(p.avatar,p.character,p.color);
    this.sleeveMaterial.color.set(appearance.shirt==='short'?appearance.colors.skin:appearance.colors.shirt);this.handSkinMaterial.color.set(appearance.colors.skin);this.hands.scale.x=Math.min(1,this.camera.aspect/.8);
    const prayer=Math.max(pose.prayer,pose.lift),sitting=pose.seated;
    this.handArms.forEach((arm,i)=>{const side=i===0?-1:1;
      const x=side*(.24-prayer*.2-(sitting?.07:0)),y=-.77+prayer*.4+(sitting?.1:0),z=-.9+prayer*.04;
      arm.position.lerp(new THREE.Vector3(x,y,z),1-Math.exp(-dt*16));
      arm.rotation.z=side*(prayer*.2+(sitting?.4:0));arm.rotation.x=sitting?-.8:0;arm.rotation.y=side*prayer*-.7;
    });
    this.heldIncense.visible=(pose.stickVisible??pose.incense)&&pose.lift>.015;this.heldIncense.position.y=-.51+pose.lift*.3;
    this.handBroom.visible=!!p.hasBroom&&p.action==='stand'&&prayer<.05;
    if(this.handBroom.visible){
      const progress=THREE.MathUtils.clamp((time-(p.sweepStart??-100))/.9,0,1),swing=Math.sin(progress*Math.PI);
      this.handBroom.position.set(.4-swing*.4,-1.6+swing*.55,-1.15-swing*.55);this.handBroom.rotation.set(-.13,0,-.18+swing*.7);
      this.handArms[1].position.set(.25-swing*.14,-.67,-.92);this.handArms[1].rotation.x=-.2;this.handArms[1].rotation.z=-.15+swing*.4;
    }
    this.handSmoke.forEach((p,i)=>{const a=(time*.35+i/3)%1;p.position.set(Math.sin(time+i)*a*.035,.4+a*.15,0);p.scale.setScalar(.01+a*.02);p.material.opacity=(1-a)*.17;});
  }
  setActive(active){this.active=active;this.width=0;this.studio.width=0;this.studio.dirty=true;this.look.set(0,0,active?8:0);this.setMode(active?'first':'panorama');if(active){if(!this.worldBuilt){this.buildWorld();this.worldBuilt=true;}this.resetCamera();}}
  setBatterySaver(enabled){this.batterySaver=enabled;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,enabled?1.2:1.6));this.renderer.shadowMap.enabled=!enabled;this.renderer.shadowMap.needsUpdate=true;this.studio.dirty=true;this.garden?.setQuality(enabled);this.canvas.dataset.batterySaver=String(enabled);}
  renderCreator(appearance){if(!this.ready)return;this.studio.setAppearance(appearance);this.studio.render(this.canvas);}
  setMode(mode){if(!['first','panorama','follow'].includes(mode))return;this.mode=mode;this.zoom=1;this.pitch=mode==='follow'?.61:.76;this.eyeNeedsSnap=true;this.canvas.dataset.cameraMode=mode;}
  resetCamera(){this.yaw=0;this.zoom=1;this.pitch=this.mode==='follow'?.61:.76;this.eyePitch=-.035;}
  orbit(dx,dy){this.yaw-=dx*.006;if(this.mode==='first')this.eyePitch=THREE.MathUtils.clamp(this.eyePitch+dy*.004,-1.25,1.3);else this.pitch=THREE.MathUtils.clamp(this.pitch+dy*.004,.28,1.28);}
  zoomBy(factor){this.zoom=THREE.MathUtils.clamp(this.zoom*factor,.55,1.6);}
  movement(dx,dy){return {x:dx*Math.cos(this.yaw)+dy*Math.sin(this.yaw),y:-dx*Math.sin(this.yaw)+dy*Math.cos(this.yaw)};}
  pick(clientX,clientY){const rect=this.canvas.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);const hit=new THREE.Vector3();if(!this.ray.ray.intersectPlane(this.plane,hit))return null;let x=hit.x*10+500,y=hit.z*10+350;const height=groundHeight(x,y);if(height){this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-height),hit);x=hit.x*10+500;y=hit.z*10+350;}return{x,y};}
  project(x,y){const v=position(x,y).add(new THREE.Vector3(0,.1,0)).project(this.camera),rect=this.canvas.getBoundingClientRect();return{x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};}
  syncPlayers(players,myId,t,dt){
    const ids=new Set(players.map(p=>p.id));for(const[id,m]of this.models)if(!ids.has(id)){disposeAvatar(m);this.models.delete(id);}
    for(const p of players){
      const appearance=window.AvatarConfig.normalize(p.avatar,p.character,p.color),signature=JSON.stringify(appearance);
      let model=this.models.get(p.id);
      if(!model||model.signature!==signature){if(model)disposeAvatar(model);model=createGameAvatar(this.worldRoot,{...p,avatar:appearance,isMe:p.id===myId});this.models.set(p.id,model);}
      const pos=position(p.x,p.y),dx=pos.x-model.root.position.x,dz=pos.z-model.root.position.z;
      poseAvatar(model,p,t,dt);
      if(p.hasBroom&&p.action==='stand'){
        const progress=THREE.MathUtils.clamp((t-(p.sweepStart??-100))/.9,0,1),swing=Math.sin(progress*Math.PI);
        model.arms[1].rotation.x=-.45-swing*.45;model.arms[1].rotation.z=-.2+swing*.4;model.elbows[1].rotation.x=-.65;
      }
      model.heading=p.action==='bow'||p.action==='sit'?Math.PI:model.motionOutput.heading;
      const delta=THREE.MathUtils.euclideanModulo(model.heading-model.root.rotation.y+Math.PI,TAU)-Math.PI;
      model.root.rotation.y+=delta*Math.min(1,dt*12);
      model.root.position.set(pos.x,pos.y+model.postureOffset,pos.z);
      if(p.id===myId&&model.motionOutput.stepCount>(model.playedSteps||0)){
        const bridge=p.y>475&&p.y<535&&Math.abs(p.x-riverX(p.y))<62;
        const stone=p.x>350&&p.x<650||p.y<293&&p.x>330&&p.x<670;
        this.canvas.dispatchEvent(new CustomEvent('avatar-step',{detail:{surface:bridge?'wood':stone?'stone':'grass'}}));
      }
      model.playedSteps=model.motionOutput.stepCount;
      model.label.position.y=p.action==='sit'?2.75:p.action==='bow'?2.3:3.1;
      model.root.visible=!(this.active&&this.mode==='first'&&p.id===myId);model.label.material.depthTest=this.mode==='first';
    }
  }
  syncIncense(items,t){
    const ids=new Set(items.map(i=>i.id));for(const[id,g]of this.incense)if(!ids.has(id)){this.urn.remove(g);g.traverse(o=>{if(o.userData.smoke===true&&o.material)o.material.dispose();});this.incense.delete(id);}
    for(const item of items){let g=this.incense.get(item.id);if(!g){g=group(this.urn,-1.2+(item.slot%6)*.46,1.46,(Math.floor(item.slot/6)-.5)*.6);g.userData.stick=cylinder(g,0,.8,0,.025,.025,1.6,'#ab6d4e',6);g.userData.ember=ball(g,0,1.6,0,.055,.06,.055,'#e79557');g.userData.ember.material=mat('#e79a5a',{emissive:'#ff7d35',emissiveIntensity:2});g.userData.smoke=[];for(let i=0;i<5;i++){const puff=mesh(g,this.smokeGeo,new THREE.MeshBasicMaterial({color:'#eee7d6',transparent:true,opacity:.12,depthWrite:false}),0,2+i*.4,0,.12,.2,.12);puff.castShadow=false;puff.userData.smoke=true;g.userData.smoke.push(puff);}this.incense.set(item.id,g);}
      const length=.25+Math.max(0,(item.end-performance.now())/300000)*.85;g.userData.stick.scale.y=length/1.6;g.userData.stick.position.y=length/2;g.userData.ember.position.y=length;g.userData.smoke.forEach((p,i)=>{const a=(t*.18+i*.2+item.slot*.07)%1;p.position.set(Math.sin(t+i)*a*.3,length+a*2.8,Math.cos(t*.7+i)*a*.2);p.scale.setScalar(.09+a*.26);p.material.opacity=(1-a)*.15;});
    }
  }
  render(time,players,items,myId,target){
    if(!this.ready||!this.active||document.hidden)return;if(this.batterySaver&&time-(this.lastRendered||0)<1/30)return;this.lastRendered=time;const dt=Math.min(.05,Math.max(.001,time-this.lastTime));this.lastTime=time;
    const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const width=Math.round(rect.width),height=Math.round(rect.height);if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
    this.syncPlayers(players,myId,time,dt);this.syncIncense(items,time);
    const me=players.find(p=>p.id===myId),pos=me?position(me.x,me.y):new THREE.Vector3();
    const first=this.active&&this.mode==='first'&&!!me;
    const fov=first?THREE.MathUtils.clamp(72*this.zoom,50,85):47;
    if(Math.abs(this.camera.fov-fov)>.01||this.camera.near!==(first?.055:.2)){this.camera.fov=fov;this.camera.near=first?.055:.2;this.camera.updateProjectionMatrix();}
    this.hands.visible=first;
    if(first){
      const pose=eyePose({...me,visualMotion:this.models.get(myId)?.motionOutput},time*1000,this.gentleMotion);
      this.eyeHeight=this.eyeNeedsSnap?pose.height:THREE.MathUtils.damp(this.eyeHeight,pose.height,14,dt);this.eyeNeedsSnap=false;
      // x/z match the player's feet exactly; only posture height eases. No walking bob.
      this.camera.position.set(pos.x,pos.y+this.eyeHeight,pos.z);
      const pitch=THREE.MathUtils.clamp(this.eyePitch+pose.pitch,-1.3,1.42);
      this.camera.rotation.set(-pitch,this.yaw,0,'YXZ');this.updateHands(me,pose,time,dt);
    }else{
    const wide=this.mode==='panorama'||!this.active;const desired=wide?new THREE.Vector3(pos.x*.28,0,pos.z*.25-2):new THREE.Vector3(pos.x,1.1,pos.z-6);
    const distance=(wide?87:40)*this.zoom;const mobile=this.camera.aspect<.8?1.24:1;
    this.look.lerp(desired,1-Math.exp(-dt*3));const r=distance*mobile,offset=new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch)*r,Math.sin(this.pitch)*r,Math.cos(this.yaw)*Math.cos(this.pitch)*r);
    this.camera.position.lerp(this.look.clone().add(offset),1-Math.exp(-dt*4));this.camera.lookAt(this.look);
    }
    const inside=!!me&&me.y<265&&me.x>312&&me.x<688,fadeRoof=inside&&!first;const opacity=fadeRoof?.025:1;
    this.roofs.forEach(g=>g.traverse(o=>{if(o.material){const transparent=o.isSprite||fadeRoof||o.material.opacity<.99;if(o.material.transparent!==transparent){o.material.transparent=transparent;o.material.needsUpdate=true;}o.material.opacity=THREE.MathUtils.damp(o.material.opacity,opacity,9,dt);o.material.depthWrite=!fadeRoof;o.castShadow=!fadeRoof;if(o.isSprite)o.visible=!fadeRoof;}}));
    // Keep the local player visible when the gate falls between them and camera.
    const gateOccludes=!first&&!!me&&me.y>535&&Math.cos(this.yaw)>.15;
    this.gateRoof.traverse(o=>{if(o.material){o.material.opacity=THREE.MathUtils.damp(o.material.opacity,gateOccludes?.1:1,10,dt);const transparent=gateOccludes||o.material.opacity<.99;if(o.material.transparent!==transparent){o.material.transparent=transparent;o.material.needsUpdate=true;}o.material.depthWrite=!gateOccludes;o.castShadow=!gateOccludes;}});
    this.canvas.dataset.location=inside?'hall':'garden';
    // ── Animate thác nước ────────────────────────────────────────────────
    this.interior.update(time);
    const sheltered=inside&&first;
    this.daylight.intensity=THREE.MathUtils.damp(this.daylight.intensity,sheltered?.48:2.5,3,dt);
    this.sunlight.intensity=THREE.MathUtils.damp(this.sunlight.intensity,sheltered?.55:3.1,3,dt);
    this.renderer.toneMappingExposure=THREE.MathUtils.damp(this.renderer.toneMappingExposure,sheltered?.92:1.12,3,dt);
    this.landscape.update(time);
    this.garden.update(time);
    this.yardCare.update(time,players,this.models,myId,first);
    this.destination.visible=!!target;if(target){const pos=position(target.x,target.y);this.destination.position.copy(pos).add(new THREE.Vector3(0,.18,0));this.destination.scale.setScalar(1+Math.sin(time*4)*.12);}
    this.renderer.render(this.scene,this.camera);
  }
}
