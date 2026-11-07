import * as THREE from 'three';

let glowMap;
export function addLightPool(parent,x,y,z,radius=5,stretch=1){
  if(!glowMap){
    const size=64,data=new Uint8Array(size*size*4);
    for(let row=0;row<size;row++)for(let col=0;col<size;col++){
      const r=Math.hypot((col+.5)/size*2-1,(row+.5)/size*2-1),i=(row*size+col)*4;
      data[i]=255;data[i+1]=204;data[i+2]=117;data[i+3]=Math.round(Math.max(0,1-r)**2*150);
    }
    glowMap=new THREE.DataTexture(data,size,size);glowMap.needsUpdate=true;
  }
  const material=new THREE.MeshBasicMaterial({map:glowMap,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(radius*2,radius*2),material);pool.rotation.x=-Math.PI/2;pool.position.set(x,y,z);pool.scale.y=stretch;pool.userData.nightGlow=.64;pool.name='warm-lamp-pool';parent.add(pool);return pool;
}

export function addNightLight(parent,x,y,z,intensity=100,distance=22){
  const light=new THREE.PointLight('#ffd697',0,distance,2);light.position.set(x,y,z);light.userData.nightLight=intensity;light.name='warm-night-light';parent.add(light);return light;
}

export class DayNightCycle{
  constructor(view){
    this.view=view;this.amount=0;this.mode='day';this.uniform={value:0};this.emitters=[];this.lights=[];this.glows=[];
    this.daySky=new THREE.Color('#a8c9cd');this.nightSky=new THREE.Color('#111e38');
    this.daySun=new THREE.Color('#ffd29b');this.nightSun=new THREE.Color('#94b7ed');
    this.dayAmbient=new THREE.Color('#e0f1ff');this.nightAmbient=new THREE.Color('#8baee8');this.dayGround=new THREE.Color('#718563');this.nightGround=new THREE.Color('#263b48');this.moonColor=new THREE.Color('#e2edff');
  }
  collect(){
    this.view.worldRoot.traverse(o=>{
      if(o.userData.nightLight)this.lights.push(o);
      if(o.userData.nightGlow)this.glows.push(o);
      if(o.material?.userData.nightEmission&&!this.emitters.includes(o.material))this.emitters.push(o.material);
    });
  }
  setMode(mode){if(!['day','night'].includes(mode))return;this.mode=mode;this.view.canvas.dataset.timeOfDay=mode;}
  update(dt,inside){
    const v=this.view;this.amount=THREE.MathUtils.damp(this.amount,this.mode==='night'||this.forcedNight?1:0,3,dt);const n=this.amount;this.uniform.value=n;
    v.scene.background.copy(this.daySky).lerp(this.nightSky,n);v.scene.fog.color.copy(v.scene.background);
    v.daylight.color.copy(this.dayAmbient).lerp(this.nightAmbient,n);v.daylight.groundColor.copy(this.dayGround).lerp(this.nightGround,n);
    v.daylight.intensity=THREE.MathUtils.damp(v.daylight.intensity,inside?THREE.MathUtils.lerp(.48,.36,n):THREE.MathUtils.lerp(1.8,.62,n),3,dt);
    v.sunlight.color.copy(this.daySun).lerp(this.nightSun,n);v.sunlight.intensity=THREE.MathUtils.damp(v.sunlight.intensity,inside?THREE.MathUtils.lerp(.55,.18,n):THREE.MathUtils.lerp(2.2,.38,n),3,dt);
    v.renderer.toneMappingExposure=THREE.MathUtils.damp(v.renderer.toneMappingExposure,inside?.92:THREE.MathUtils.lerp(1.02,1.14,n),3,dt);
    for(const light of this.lights){light.visible=n>.005;light.intensity=light.userData.nightLight*n;}
    for(const glow of this.glows){glow.visible=n>.005;glow.material.opacity=glow.userData.nightGlow*n;}
    for(const material of this.emitters)material.emissiveIntensity=material.userData.nightEmission*n;
    if(v.skyDisc){v.skyDisc.material.color.copy(this.daySun).lerp(this.moonColor,n);v.skyDisc.scale.set(7-3*n,7-3*n,3-1.5*n);}
    if(v.stars)v.stars.material.opacity=n*.85;
  }
}
