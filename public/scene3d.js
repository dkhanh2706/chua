import * as THREE from 'three';
import { createAvatar,poseAvatar,disposeAvatar } from './avatar-model.mjs';
import { AvatarStudio } from './avatar-studio.mjs';
import { TempleGarden } from './garden.mjs';
import { GardenLandscape } from './landscape.mjs';
import { buildTempleInterior,HALL_CEILING } from './temple-interior.mjs';
import { YardCare } from './yard-care.mjs';
import { LotusPond } from './lotus-pond.mjs';
import {broomStrike,applyBroomPose} from './broom-motion.mjs';
import {DayNightCycle} from './night-lights.mjs';
import {IncenseSmoke} from './incense-smoke.mjs';
import {GardenBoundary} from './garden-boundary.mjs';
import {buildEntranceGate} from './entrance-gate.mjs';
import {buildCircularRoofs} from './circular-temple.mjs';
import {constrainHallCamera} from './hall-camera.mjs';
import {CameraObstacles} from './camera-obstacles.mjs';
import {MoonGarden} from './moon-garden.mjs';
import {Seaside} from './seaside.mjs';

const { WORLD, URN, riverX, groundHeight } = window;
const TAU=Math.PI*2;
const position=(x,y,time=0)=>new THREE.Vector3((x-500)/10,groundHeight(x,y,time),(y-350)/10);
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
    this.targetFPS=60;
    this.quality='high';
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(this.pixelRatioForViewport());this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.autoUpdate=!this.mobile;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    if(typeof ResizeObserver!=='undefined'){this.resizeObserver=new ResizeObserver(([entry])=>{this.canvasSize=entry.contentRect;});this.resizeObserver.observe(canvas);}
    this.studio=new AvatarStudio(this.renderer);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#a4afa1');this.scene.fog=new THREE.Fog('#a4afa1',250,1100);
    this.camera=new THREE.PerspectiveCamera(47,1,.2,2800);this.camera.position.set(0,66,68);this.camera.lookAt(this.look);
    this.scene.add(this.camera);
    this.daylight=new THREE.HemisphereLight('#ffe8c7','#65745c',1.8);this.scene.add(this.daylight);const sun=new THREE.DirectionalLight('#ffd29b',2.2);sun.position.set(-35,65,25);sun.castShadow=true;sun.shadow.mapSize.set(this.mobile?1024:2048,this.mobile?1024:2048);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.normalBias=.06;sun.shadow.bias=-.0003;sun.shadow.camera.far=150;this.sunlight=sun;this.scene.add(sun);this.scene.add(sun.target);
    this.worldRoot=group(this.scene);this.cycle=new DayNightCycle(this);this.worldBuilt=false;this.canvas.dataset.renderer='webgl';this.canvas.dataset.cameraMode=this.mode;this.canvas.dataset.qualityMode=this.quality;
    let timeOfDay='day';try{timeOfDay=localStorage.getItem('temple-time-of-day')||'day';}catch{}this.setTimeOfDay(timeOfDay);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.ready=false;canvas.dispatchEvent(new CustomEvent('render-error'));});
    canvas.addEventListener('webglcontextrestored',()=>{this.ready=true;this.studio.dirty=true;this.width=0;});
    this.ready=true;
  }
  buildWorld(){
    const s=this.worldRoot;let seed=917;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
    box(s,0,-1.1,.8,113.2,1.4,87.6,'#83ac76');
    const grass=[];for(let i=0;i<700;i++){const x=random()*106-53,z=random()*78-39;if(Math.abs(x)<46&&z>-22&&z<30)continue;grass.push({p:[x,.012,z],s:[.12+random()*.22,.03,.14+random()*.35],r:[0,random()*TAU,0]});}instances(s,boxGeo,mat('#acb78b'),grass);
    // Keep the distant sea horizon clear; the waterfall cliff frames its east side.
    const sun=ball(s,-460,480,-1050,70,70,30,'#fff1c9');sun.material=new THREE.MeshBasicMaterial({color:'#fff1c9',fog:false});sun.castShadow=false;sun.userData.distanceScale=10;this.skyDisc=sun;
    const starPositions=[];for(let i=0;i<160;i++){const angle=random()*TAU,radius=1100+random()*250;starPositions.push(Math.sin(angle)*radius,450+random()*650,Math.cos(angle)*radius);}
    const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));this.stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#dceaff',size:2.3,transparent:true,opacity:0,depthWrite:false,fog:false}));s.add(this.stars);

    this.landscape=new GardenLandscape(s,this.cycle.uniform);
    this.coast=new Seaside(s,this.cycle.uniform);
    this.pond=new LotusPond(s,this.cycle.uniform);
    this.buildTemple();this.buildUrn();
    this.boundary=new GardenBoundary(s,{wallSegments:window.gardenWallSegments()});
    this.moonGarden=new MoonGarden(s,window.WATCH_BENCHES);
    const entryTiles=[];for(let row=0;row<10;row++)for(let column=0;column<11;column++)entryTiles.push({p:[-10+column*2,-.045,25+row*2],s:[1.94,.12,1.94]});
    instances(s,boxGeo,mat('#d2c8ae'),entryTiles).name='finished-entrance-path';
    this.entrance=buildEntranceGate(s,{roof});this.gateRoof=this.entrance.roofs;
    this.garden=new TempleGarden(s,{batterySaver:this.mobile&&this.quality==='balanced',groundHeight});
    this.yardCare=new YardCare(s,this.garden,groundHeight);
    this.cycle.collect();
    // Incense target ring appears when the player chooses a destination.
    this.destination=mesh(s,new THREE.RingGeometry(.45,.55,40),new THREE.MeshBasicMaterial({color:'#fff1bc',transparent:true,opacity:.8,side:THREE.DoubleSide}),0,.2,0);this.destination.rotation.x=-Math.PI/2;this.destination.visible=false;
  }
  buildTemple(){
    const s=this.worldRoot;
    this.interior=buildTempleInterior(s);
    this.roofs.push(...buildCircularRoofs(s),this.interior.ceiling);
    this.roofs.forEach(g=>g.traverse(o=>{if(o.material){o.material=o.material.clone();o.userData.roof=true;o.userData.roofOpacity=o.material.opacity;}}));
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
    this.incenseSmoke=new IncenseSmoke(g);
  }
  setActive(active){this.active=active;this.width=0;this.studio.width=0;this.studio.dirty=true;this.look.set(0,0,active?8:0);this.setMode(active?'overhead':'panorama');if(active){if(!this.worldBuilt){this.buildWorld();this.worldBuilt=true;}this.resetCamera();}}
  pixelRatioForViewport(){
    const size=this.canvasSize||{width:window.innerWidth,height:window.innerHeight};
    return Math.min(window.devicePixelRatio,this.quality==='high'?1.8:1.5,Math.sqrt((this.mobile?2000000:4000000)/Math.max(1,size.width*size.height)));
  }
  setQuality(quality){
    if(!['balanced','high'].includes(quality))return;
    this.quality=quality;this.renderer.setPixelRatio(this.pixelRatioForViewport());this.renderer.shadowMap.needsUpdate=true;this.lastShadowUpdate=-Infinity;this.studio.dirty=true;this.garden?.setQuality(this.mobile&&quality==='balanced');this.canvas.dataset.qualityMode=quality;
  }
  setTimeOfDay(mode){this.cycle.setMode(mode);}
  updateShadows(pos,time,players){
    if(!this.mobile)return;
    const animated=players.some(p=>p.moving||p.action==='bow'||['sit_down','sit_up'].includes(this.models.get(p.id)?.motionOutput.name)||time-(p.hitStart??-100)<.65||time-(p.struckStart??-100)<.65||time-(p.sweepStart??-100)<.9);
    const interval=animated?0:1/12;
    if(time-(this.lastShadowUpdate??-Infinity)<interval)return;
    this.lastShadowUpdate=time;
    const wide=this.mode==='panorama',extent=wide?65:this.mode==='follow'?36:24,x=wide?0:pos.x,z=wide?0:pos.z;
    this.sunlight.position.set(x-35,65,z+25);this.sunlight.target.position.set(x,0,z);
    const camera=this.sunlight.shadow.camera;
    if(camera.right!==extent){camera.left=-extent;camera.right=extent;camera.top=extent;camera.bottom=-extent;camera.updateProjectionMatrix();}
    this.renderer.shadowMap.needsUpdate=true;
  }
  renderCreator(appearance){if(!this.ready)return;this.studio.setAppearance(appearance);this.studio.render(this.canvas,this.canvasSize);}
  setMode(mode){if(!['overhead','panorama','follow'].includes(mode))return;this.mode=mode;this.zoom=1;this.pitch=mode==='overhead'?.42:mode==='follow'?.51:.76;this.cameraNeedsSnap=true;this.canvas.dataset.cameraMode=mode;}
  resetCamera(){this.yaw=0;this.watchYaw=0;this.zoom=1;this.pitch=this.mode==='overhead'?.42:this.mode==='follow'?.51:.76;this.cameraNeedsSnap=true;}
  orbit(dx,dy){
    if(this.watchingSeat){this.watchYaw=THREE.MathUtils.clamp((this.watchYaw||0)-dx*.004,-1.2,1.2);return;}
    this.yaw-=dx*.006;this.pitch=THREE.MathUtils.clamp(this.pitch+dy*.004,this.mode==='overhead'?-.4:.28,1.15);
  }
  zoomBy(factor){this.zoom=THREE.MathUtils.clamp(this.zoom*factor,this.mode==='overhead'?.8:.55,1.6);}
  movement(dx,dy){return {x:dx*Math.cos(this.yaw)+dy*Math.sin(this.yaw),y:-dx*Math.sin(this.yaw)+dy*Math.cos(this.yaw)};}
  pick(clientX,clientY){
    const rect=this.canvas.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);
    let floorDistance=Infinity;
    for(const height of [0,window.HALL.floor]){
      const floor=this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-height),new THREE.Vector3());
      if(floor&&Math.abs(groundHeight(floor.x*10+500,floor.z*10+350)-height)<.05)floorDistance=Math.min(floorDistance,this.ray.ray.origin.distanceTo(floor));
    }
    const indoor=this.interior&&this.ray.intersectObject(this.interior.seats,true)[0];
    const outdoor=this.moonGarden&&this.ray.intersectObject(this.moonGarden.seats,true).find(hit=>hit.distance<=floorDistance+.05);
    const sofa=outdoor&&(!indoor||outdoor.distance<indoor.distance)?outdoor:indoor;
    if(sofa){const x=sofa.point.x*10+500,y=sofa.point.z*10+350,seat=window.sofaSeatAt(x,y);if(seat)return{x:seat.x,y:seat.y,sofaSeatId:seat.id};}
    const beach=this.coast&&this.ray.intersectObject(this.coast.sand,false)[0];
    if(beach&&beach.distance<=floorDistance+.05&&window.onCoast(beach.point.x*10+500,beach.point.z*10+350))return{x:beach.point.x*10+500,y:beach.point.z*10+350};
    const hit=new THREE.Vector3();if(!this.ray.ray.intersectPlane(this.plane,hit))return null;let x=hit.x*10+500,y=hit.z*10+350;const height=groundHeight(x,y);if(height){this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-height),hit);x=hit.x*10+500;y=hit.z*10+350;}return{x,y};
  }
  project(x,y){const v=position(x,y).add(new THREE.Vector3(0,.1,0)).project(this.camera),rect=this.canvas.getBoundingClientRect();return{x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};}
  syncPlayers(players,myId,t,dt){
    const ids=new Set(players.map(p=>p.id));for(const[id,m]of this.models)if(!ids.has(id)){disposeAvatar(m);this.models.delete(id);}
    for(const p of players){
      const appearance=window.AvatarConfig.normalize(p.avatar,p.character,p.color),signature=JSON.stringify(appearance);
      let model=this.models.get(p.id);
      if(!model||model.signature!==signature){if(model)disposeAvatar(model);model=createGameAvatar(this.worldRoot,{...p,avatar:appearance,isMe:p.id===myId});model.root.position.copy(position(p.x,p.y,t));this.models.set(p.id,model);}
      const pos=position(p.x,p.y,t),dx=pos.x-model.root.position.x,dz=pos.z-model.root.position.z;
      if(p.sofaSeatId)pos.y=window.SOFA_SEATS.find(s=>s.id===p.sofaSeatId)?.height??window.SOFA_SEAT_HEIGHT;
      // Preserve the visible facing, including a turn still easing to its destination.
      if((p.action==='sit'||p.action==='bow')&&p.action!==model.lastPoseAction)model.motion.heading=model.root.rotation.y;
      model.lastPoseAction=p.action;
      poseAvatar(model,p,t,dt);
      model.body.rotation.y=0;
      if(p.hasBroom&&p.action==='stand'){
        applyBroomPose(model,p,t);
      }
      const strike=broomStrike(t,p.hitStart),striking=!!strike;
      const struckAge=t-(p.struckStart??-100);if(struckAge>=0&&struckAge<.65)model.body.rotation.z+=Math.sin(struckAge/.65*Math.PI)*.16;
      model.heading=model.motionOutput.heading;
      if(p.sofaSeatId)model.heading=window.SOFA_SEATS.find(s=>s.id===p.sofaSeatId)?.heading??model.heading;
      if(striking)model.heading=p.hitHeading??model.heading;
      const delta=THREE.MathUtils.euclideanModulo(model.heading-model.root.rotation.y+Math.PI,TAU)-Math.PI;
      model.root.rotation.y+=delta*Math.min(1,dt*12);
      if(model.seatedOnSofa)model.root.position.lerp(pos.clone().add(new THREE.Vector3(0,model.postureOffset,0)),1-Math.exp(-dt*14));else model.root.position.set(pos.x,pos.y+model.postureOffset,pos.z);
      if(p.id===myId&&model.motionOutput.stepCount>(model.playedSteps||0)){
        const bridge=p.y>475&&p.y<535&&Math.abs(p.x-riverX(p.y))<62;
        const stone=p.x>350&&p.x<650||p.y<293&&p.x>330&&p.x<670;
        this.canvas.dispatchEvent(new CustomEvent('avatar-step',{detail:{surface:window.onCoast(p.x,p.y)?'sand':bridge?'wood':stone?'stone':'grass'}}));
      }
      model.playedSteps=model.motionOutput.stepCount;
      model.label.position.y=p.action==='sit'?2.75:p.action==='bow'?2.3:3.1;
      model.root.visible=true;model.label.material.depthTest=true;
    }
  }
  syncIncense(items,t){
    const ids=new Set(items.map(i=>i.id));for(const[id,g]of this.incense)if(!ids.has(id)){this.urn.remove(g);this.incense.delete(id);}
    const now=performance.now();
    for(const item of items){let g=this.incense.get(item.id);if(!g){g=group(this.urn,-1.2+(item.slot%6)*.46,1.46,(Math.floor(item.slot/6)-.5)*.6);g.userData.stick=cylinder(g,0,.8,0,.025,.025,1.6,'#ab6d4e',6);g.userData.ember=ball(g,0,1.6,0,.055,.06,.055,'#e79557');g.userData.ember.material=mat('#e79a5a',{emissive:'#ff7d35',emissiveIntensity:2});this.incense.set(item.id,g);}
      const length=.25+Math.max(0,(item.end-now)/300000)*.85;g.userData.stick.scale.y=length/1.6;g.userData.stick.position.y=length/2;g.userData.ember.position.y=length;
    }
    this.incenseSmoke.update(items,t,now);
  }
  render(time,players,items,myId,target){
    if(!this.ready||!this.active||document.hidden)return;this.lastRendered=time;const dt=Math.min(.05,Math.max(.001,time-this.lastTime));this.lastTime=time;
    const rect=this.canvasSize||this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const width=Math.round(rect.width),height=Math.round(rect.height);if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setPixelRatio(this.pixelRatioForViewport());this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
    this.syncPlayers(players,myId,time,dt);this.syncIncense(items,time);
    const me=players.find(p=>p.id===myId),pos=me?position(me.x,me.y,time):new THREE.Vector3();
    const watching=!!window.WATCH_SEATS.find(s=>s.id===me?.sofaSeatId);
    const watchingSeat=watching?me.sofaSeatId:null;
    if(this.watchingSeat!==watchingSeat){this.watchingSeat=watchingSeat;this.watchYaw=0;}
    const showActive=players.some(p=>window.WATCH_SEATS.some(s=>s.id===p.sofaSeatId));
    this.cycle.forcedNight=showActive;this.canvas.dataset.timeOfDay=showActive?'night':this.cycle.mode;
    this.canvas.dataset.watchingFireworks=String(watching);
    const viewingFov=watching?(this.mobile?76:60):47;if(this.camera.fov!==viewingFov){this.camera.fov=viewingFov;this.camera.updateProjectionMatrix();}
    const close=this.mode==='overhead',wide=this.mode==='panorama'||!this.active;
    const desired=wide?new THREE.Vector3(pos.x*.28,0,pos.z*.25-2):new THREE.Vector3(pos.x,pos.y+(close?.9:1.1),pos.z-(close?0:6));
    const r=(wide?87:close?8.5:40)*this.zoom*(this.camera.aspect<.8?1.15:1);
    const orbitPitch=close?Math.max(.35,this.pitch):this.pitch;
    const offset=new THREE.Vector3(Math.sin(this.yaw)*Math.cos(orbitPitch)*r,Math.sin(orbitPitch)*r,Math.cos(this.yaw)*Math.cos(orbitPitch)*r);
    const cameraTarget=desired.clone().add(offset);
    if(watching){
      desired.set(this.mobile?-26:-19,this.mobile?4:5,20);
      cameraTarget.set(-35,this.mobile?22:14,this.mobile?-40:-24);
      desired.sub(cameraTarget).applyAxisAngle(new THREE.Vector3(0,1,0),this.watchYaw).add(cameraTarget);
    }
    if(close)desired.y+=Math.max(0,.35-this.pitch)*8;
    if(this.cameraNeedsSnap){this.look.copy(desired);this.camera.position.copy(cameraTarget);this.cameraNeedsSnap=false;}
    else{this.look.lerp(desired,1-Math.exp(-dt*8));this.camera.position.lerp(cameraTarget,1-Math.exp(-dt*8));}
    const inside=!!me&&window.insideHall(me.x,me.y);
    if(inside&&close)constrainHallCamera(this.look,this.camera.position,window.HALL,window.HALL_ENTRY);
    if(!wide&&!watching){
      if(!this.cameraObstacles){
        const names=['curved-hall-walls','round-hall-columns','open-temple-doorway','complete-garden-enclosure','timber-ceiling'];
        const roofSurfaces=this.roofs.map(roof=>roof.getObjectByName('curved-circular-tile-roof'));
        this.cameraObstacles=new CameraObstacles([...names.map(name=>this.worldRoot.getObjectByName(name)),...roofSurfaces,this.gateRoof].filter(Boolean));
        this.worldRoot.updateWorldMatrix(true,true);
      }
      this.cameraObstacles.constrain(this.look,this.camera.position);
    }
    this.camera.lookAt(this.look);
    // Cut away the roof only when viewing the hall from above its ceiling.
    const fadeRoof=inside&&this.camera.position.y>HALL_CEILING+.25;
    this.roofs.forEach(g=>g.traverse(o=>{if(o.material){const baseOpacity=o.userData.roofOpacity,transparent=o.isSprite||fadeRoof||baseOpacity<.99||o.material.opacity<.99;if(o.material.transparent!==transparent){o.material.transparent=transparent;o.material.needsUpdate=true;}o.material.opacity=THREE.MathUtils.damp(o.material.opacity,baseOpacity*(fadeRoof?.025:1),9,dt);o.material.depthWrite=!fadeRoof;o.castShadow=!fadeRoof;if(o.isSprite)o.visible=!fadeRoof;}}));
    // Keep the local player visible when the gate falls between them and camera.
    const gateOccludes=!!me&&pos.z>this.entrance.root.position.z-12&&Math.cos(this.yaw)>.15;
    this.gateRoof.traverse(o=>{if(o.material){o.material.opacity=THREE.MathUtils.damp(o.material.opacity,gateOccludes?.1:1,10,dt);const transparent=gateOccludes||o.material.opacity<.99;if(o.material.transparent!==transparent){o.material.transparent=transparent;o.material.needsUpdate=true;}o.material.depthWrite=!gateOccludes;o.castShadow=!gateOccludes;}});
    this.canvas.dataset.location=inside?'hall':'garden';
    // ── Animate thác nước ────────────────────────────────────────────────
    this.interior.update(time);
    this.cycle.update(dt,inside);
    this.moonGarden.update(Date.now()/1000,showActive,this.cycle.amount);
    this.skyDisc.visible=!showActive;
    this.landscape.update(time);
    this.pond.update(time);
    this.garden.update(time);this.coast.update(time);
    this.yardCare.update(time,players,this.models,myId,false);
    this.destination.visible=!!target;if(target){const pos=position(target.x,target.y);this.destination.position.copy(pos).add(new THREE.Vector3(0,.18,0));this.destination.scale.setScalar(1+Math.sin(time*4)*.12);}
    this.updateShadows(pos,time,players);
    this.renderer.render(this.scene,this.camera);
  }
}
