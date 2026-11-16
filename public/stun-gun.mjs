import * as THREE from 'three';
import {RIGHT_HAND,reachable,solveRightArm} from './broom-motion.mjs';

const UP=new THREE.Vector3(0,1,0);
const JAB=.3;
export const STUN_SCALE=1.5;

const standard=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.15,...extra});
function add(parent,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}

// Blue shell, grey grip, two steel prongs and a yellow bolt. The grip sits on
// the origin and the prongs point along +Y, like the handle of the broom.
export function createStunGun(){
  const root=new THREE.Group();root.name='stun-gun';
  const shell=standard('#1f5f8f'),dark=standard('#1d2a38'),steel=standard('#c9d3da',{metalness:.7,roughness:.3}),bolt=new THREE.MeshBasicMaterial({color:'#ffd23d'});
  add(root,new THREE.BoxGeometry(.075,.24,.06),dark,0,0,0);
  add(root,new THREE.BoxGeometry(.115,.3,.085),shell,0,.26,0);
  add(root,new THREE.BoxGeometry(.13,.05,.095),dark,0,.43,0);
  const prong=new THREE.CylinderGeometry(.014,.014,.11,8);
  for(const x of [-.036,.036])add(root,prong,steel,x,.51,0);
  const light=add(root,new THREE.SphereGeometry(.02,8,6),new THREE.MeshBasicMaterial({color:'#7bf4ff'}),0,.4,.045);light.castShadow=false;
  // Lightning emblem on both faces.
  const shape=new THREE.Shape();shape.moveTo(.012,.04);shape.lineTo(-.03,-.015);shape.lineTo(-.004,-.015);shape.lineTo(-.014,-.06);shape.lineTo(.032,.0);shape.lineTo(.006,.0);shape.closePath();
  const emblem=new THREE.ShapeGeometry(shape);
  for(const side of [-1,1]){const m=new THREE.Mesh(emblem,bolt);m.position.set(0,.27,side*.0435);if(side<0)m.rotation.y=Math.PI;root.add(m);}
  // Arc that flickers between the prongs while the trigger is pulled.
  const arc=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(5*3),3)),new THREE.LineBasicMaterial({color:'#aef6ff'}));
  arc.name='prong-arc';arc.visible=false;arc.frustumCulled=false;root.add(arc);
  root.userData.arc=arc;
  return root;
}

// Hold the gun out in front of the right shoulder, prongs forward; jab it on a zap.
export function applyStunGunPose(model,player,time){
  const age=time-(player.zapStart??-100),jab=age>=0&&age<JAB?Math.sin(age/JAB*Math.PI):0;
  const hipDrop=(model.rig?.hipHeight??.72)-.72;
  const hand=new THREE.Vector3(-.3,.62-hipDrop,.3+.2*jab);
  const body=model.body,inverse=body.quaternion.clone().invert(),wrist=model.wrists[RIGHT_HAND];
  solveRightArm(model,reachable(model,hand.applyQuaternion(inverse)));
  const dir=new THREE.Vector3(.04,.18+.1*jab,1).normalize();
  const quaternion=inverse.multiply(new THREE.Quaternion().setFromUnitVectors(UP,dir));
  const arm=model.arms[RIGHT_HAND],elbow=model.elbows[RIGHT_HAND];
  wrist.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(quaternion);
  model.stunQuaternion=quaternion;
}

function bolt(target,from,to,seed,amount){
  // `amount` jitter, deterministic per call so a frame is a stable shape.
  const n=target.length/3;
  for(let i=0;i<n;i++){
    const t=i/(n-1),edge=i===0||i===n-1?0:1;
    target[i*3]=THREE.MathUtils.lerp(from.x,to.x,t)+(Math.sin(seed*12.9898+i*78.233)*.5)*amount*edge;
    target[i*3+1]=THREE.MathUtils.lerp(from.y,to.y,t)+(Math.sin(seed*37.719+i*11.135)*.5)*amount*edge;
    target[i*3+2]=THREE.MathUtils.lerp(from.z,to.z,t)+(Math.sin(seed*4.581+i*53.51)*.5)*amount*edge;
  }
}

export class StunGuns{
  constructor(parent){this.root=new THREE.Group();this.root.name='stun-guns';parent.add(this.root);this.carried=new Map();}
  update(time,players,models,myId){
    const ids=new Set(players.map(p=>p.id));
    for(const [id,gun] of this.carried)if(!ids.has(id)){this.dispose(gun);this.carried.delete(id);}
    for(const p of players){
      let gun=this.carried.get(p.id);
      if(!p.hasStunGun){if(gun)gun.visible=false;continue;}
      if(!gun){gun=createStunGun();gun.scale.setScalar(STUN_SCALE);this.root.add(gun);this.carried.set(p.id,gun);}
      const model=models.get(p.id);
      gun.visible=!!model&&p.action==='stand';if(!gun.visible)continue;
      model.root.updateMatrixWorld(true);
      gun.position.set(0,-.08,.018);model.wrists[RIGHT_HAND].localToWorld(gun.position);
      model.body.getWorldQuaternion(gun.quaternion);gun.quaternion.multiply(model.stunQuaternion||new THREE.Quaternion());
      // Sparks between the prongs while firing.
      const arc=gun.userData.arc,age=time-(p.zapStart??-100);
      arc.visible=age>=0&&age<.45;
      if(arc.visible){
        const attr=arc.geometry.attributes.position,frame=Math.floor(time*40);
        bolt(attr.array,new THREE.Vector3(-.036,.56,0),new THREE.Vector3(.036,.56,0),frame+p.zapStart,.05);attr.needsUpdate=true;
      }
    }
  }
  dispose(gun){gun.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});gun.removeFromParent();}
}

const arcMaterial=new THREE.LineBasicMaterial({color:'#a9f3ff',transparent:true,opacity:.95,depthTest:false});
const coreMaterial=new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.95,depthTest:false});
const ARCS=7,POINTS=7;
// Crackling electricity wrapped round a shocked visitor, redrawn many times a second.
export function createShockAura(parent){
  const group=new THREE.Group();group.name='shock-aura';group.visible=false;
  const lines=[];
  for(let i=0;i<ARCS;i++){
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(POINTS*3),3));
    const line=new THREE.Line(geometry,i%2?coreMaterial:arcMaterial);line.frustumCulled=false;line.renderOrder=20;group.add(line);lines.push(line);
  }
  parent.add(group);group.userData.lines=lines;return group;
}
// The arcs run along the body from feet to head, so they follow it as it tips over and rises.
const axis=new THREE.Vector3(),side=new THREE.Vector3(),other=new THREE.Vector3(),point=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3();
export function updateShockAura(aura,feet,head,time){
  aura.position.set(0,0,0);aura.visible=true;
  axis.copy(head).sub(feet);axis.y+=.35;
  side.set(0,0,1).cross(axis);if(side.lengthSq()<1e-4)side.set(1,0,0);side.normalize();other.copy(axis).cross(side).normalize();
  const place=(out,s,a,r)=>out.copy(feet).addScaledVector(axis,s).addScaledVector(side,Math.cos(a)*r).addScaledVector(other,Math.sin(a)*r);
  const frame=Math.floor(time*28);
  aura.userData.lines.forEach((line,i)=>{
    const seed=frame*1.7+i*9.31,a=seed*2.399,b=a+1.2+Math.sin(seed)*.8;
    place(from,.08+((i*.27)%1)*.3+Math.abs(Math.sin(seed*3.1))*.12,a,.42);
    place(to,.5+Math.abs(Math.sin(seed*1.3))*.5,b,.46);
    bolt(line.geometry.attributes.position.array,from,to,seed,.2);line.geometry.attributes.position.needsUpdate=true;
  });
}

// Switch the crying face on or off and make it quiver: the mouth wobbles and
// two tears per eye keep rolling down the cheeks.
export function setShockFace(face,on,time){
  if(!face)return;
  if(face.on!==on){face.on=on;face.group.visible=on;face.hide.forEach(o=>{o.visible=!on;});}
  if(!on)return;
  face.mouth.scale.set(1+Math.sin(time*38)*.12,1+Math.sin(time*31+1)*.35,1);
  face.mouth.position.y=-.16+Math.sin(time*45)*.0025;
  for(const tear of face.tears){
    tear.userData.base??=tear.scale.clone();
    const {side,k}=tear.userData,phase=(time*1.7+k*.5+(side>0?.25:0))%1;
    tear.position.set(side*(.012+k*.012)*phase,-.022-phase*.075,.004);tear.scale.copy(tear.userData.base).multiplyScalar(Math.max(.15,1-phase*.7));
  }
}
