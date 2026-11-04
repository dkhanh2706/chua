import * as THREE from 'three';
import { createAvatar,poseAvatar,disposeAvatar } from './avatar-model.mjs';

export class AvatarStudio{
  constructor(renderer){
    this.renderer=renderer;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e9edde');this.yaw=0;this.dirty=true;this.action='idle';this.virtualX=0;this.gesture=null;
    this.camera=new THREE.PerspectiveCamera(34,1,.1,30);this.camera.position.set(0,1.5,5.2);this.camera.lookAt(0,1.26,0);
    this.scene.add(new THREE.HemisphereLight('#fff9ec','#a1ac86',2.7));const key=new THREE.DirectionalLight('#fff0d7',2.3);key.position.set(-3,5,4);this.scene.add(key);
    const rim=new THREE.DirectionalLight('#e6f2e1',1.4);rim.position.set(3,3,-3);this.scene.add(rim);
    const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.95,1,.08,64),new THREE.MeshStandardMaterial({color:'#d6ddc6',roughness:.9}));pedestal.position.y=-.065;this.scene.add(pedestal);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.92,.008,6,64),new THREE.MeshBasicMaterial({color:'#b8c4a0'}));ring.rotation.x=Math.PI/2;ring.position.y=-.017;this.scene.add(ring);
  }
  setAppearance(appearance){const signature=JSON.stringify(appearance);if(this.model?.signature===signature)return;if(this.model)disposeAvatar(this.model);this.model=createAvatar(appearance);this.scene.add(this.model.root);this.model.root.rotation.y=this.yaw;this.dirty=true;}
  setAction(action){if(!['idle','walk','sit','bow','incense'].includes(action))return;const now=performance.now();if(this.gesture&&now-this.gesture.start<1500)return;const fromSit=this.action==='sit';this.action=action;this.gesture=['bow','incense'].includes(action)?{kind:action,start:now,fromSit}:null;this.dirty=true;this.onActionChange?.(action);}
  rotate(radians){this.yaw=radians;if(this.model)this.model.root.rotation.y=this.yaw;this.dirty=true;}
  render(canvas){
    const rect=canvas.getBoundingClientRect(),width=Math.round(rect.width),height=Math.round(rect.height);if(!width||!height||document.hidden)return;
    if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.dirty=true;}
    const now=performance.now()/1000;if(!this.dirty&&now-(this.lastRender||0)<1/24)return;const dt=Math.min(.05,now-(this.lastRender||now-.016));this.lastRender=now;
    if(this.gesture&&now*1000-this.gesture.start>=1500){this.gesture=null;this.action='idle';this.onActionChange?.('idle');}
    if(this.action==='walk')this.virtualX+=75*dt;
    if(this.model){poseAvatar(this.model,{action:this.action==='sit'?'sit':this.gesture?'bow':'stand',ritual:this.gesture,x:this.virtualX,y:0},now,dt);this.model.root.position.y=this.model.postureOffset;}
    this.renderer.render(this.scene,this.camera);this.dirty=false;
  }
}
