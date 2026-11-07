import * as THREE from 'three';
import {createGardenMoon} from './moon.mjs';

// Two three-seat timber benches facing the pond and the entrance gate.
export class MoonGarden{
  constructor(parent,benches){
    this.root=new THREE.Group();this.root.name='moon-garden';parent.add(this.root);
    this.seats=new THREE.Group();this.seats.name='moon-garden-benches';this.root.add(this.seats);
    const wood=new THREE.MeshStandardMaterial({color:'#825b3d',roughness:.78}),metal=new THREE.MeshStandardMaterial({color:'#344a43',roughness:.65});
    const cube=new THREE.BoxGeometry(1,1,1);
    const box=(parent,material,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(cube,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
    for(const bench of benches){
      const g=new THREE.Group();g.position.set((bench.x-500)/10,0,(bench.y-350)/10);g.name=bench.id;this.seats.add(g);
      for(let i=0;i<4;i++)box(g,wood,0,.87,-.48+i*.30,7,.16,.26);
      for(const x of [-2.8,2.8]){
        for(const z of [-.43,.43])box(g,metal,x,.43,z,.13,.86,.13);
        box(g,metal,x,1.28,-.57,.13,1.45,.13);
        box(g,metal,x,1.13,.55,.16,.15,1.18);
      }
      for(const y of [1.18,1.52,1.86])box(g,wood,0,y,-.59,7,.24,.13);
      for(const x of [-1.2,1.2])box(g,wood,x,1.27,.02,.11,.09,1.12);
      const light=new THREE.PointLight('#ffdbad',0,11,2);light.position.set(0,2,.5);light.userData.nightLight=12.8;g.add(light);
    }
    const lunar=createGardenMoon();this.moon=lunar.moon;this.moonHalo=lunar.halo;this.moonOpacity=lunar.opacity;
    this.moon.position.set(-8,48,150);this.moon.scale.setScalar(6.5);this.moonHalo.position.copy(this.moon.position);this.moonHalo.scale.set(28,28,1);this.root.add(this.moon,this.moonHalo);
    const positions=[],origins=[],velocities=[],colorsArray=[],groups=[],kinds=[];
    const palette=['#ffd675','#f395b9','#86dfff','#bda1ff'];
    for(let group=0;group<4;group++)for(let i=0;i<128;i++){
      const rocket=i<20,t=(i-20)/108,angle=i*2.399963,vertical=1-2*Math.max(0,t),radial=Math.sqrt(Math.max(0,1-vertical*vertical));
      positions.push(0,0,0);origins.push(-36+group*14,30+group%3*5,78+group%2*8);
      const speed=5.3+(i%7)*.42;velocities.push(Math.cos(angle)*radial*speed,vertical*speed,Math.sin(angle)*radial*speed);
      const c=new THREE.Color(palette[group]);colorsArray.push(c.r,c.g,c.b);groups.push(group);kinds.push(rocket?i/20:-1);
    }
    const particles=new THREE.BufferGeometry();
    for(const [name,data,count] of [['position',positions,3],['aOrigin',origins,3],['aVelocity',velocities,3],['aColor',colorsArray,3],['aGroup',groups,1],['aTrail',kinds,1]])particles.setAttribute(name,new THREE.Float32BufferAttribute(data,count));
    this.time={value:0};this.opacity={value:0};
    this.fireworks=new THREE.Points(particles,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:this.time,uOpacity:this.opacity},
      vertexShader:`attribute vec3 aOrigin;attribute vec3 aVelocity;attribute vec3 aColor;attribute float aGroup;attribute float aTrail;uniform float uTime;uniform float uOpacity;varying vec3 vColor;varying float vAlpha;
        void main(){float phase=mod(uTime+aGroup*1.43,6.2);float age=phase-1.65;vec3 p;float alpha;
          if(aTrail>=0.){float flight=phase-aTrail*.18;p=vec3(aOrigin.x,aOrigin.y*clamp(flight/1.65,0.,1.),aOrigin.z);alpha=step(0.,flight)*(1.-step(1.65,phase))*(1.-aTrail);}
          else{float t=max(0.,age);p=aOrigin+aVelocity*t/(1.+t*.35);p.y-=1.65*t*t;alpha=step(0.,age)*(1.-smoothstep(1.1,3.7,age));}
          vColor=aColor;vAlpha=alpha*uOpacity;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(340./max(1.,-mv.z),2.,6.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying vec3 vColor;varying float vAlpha;
        void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.||vAlpha<.005)discard;
          gl_FragColor=vec4(vColor,vAlpha*(1.-r*r));
          #include <colorspace_fragment>
        }`
    }));
    this.fireworks.name='entrance-wall-fireworks';this.fireworks.frustumCulled=false;this.fireworks.visible=false;this.root.add(this.fireworks);
  }
  update(time,enabled,night){
    this.time.value=time%124;this.opacity.value=enabled?night:0;
    this.fireworks.visible=enabled&&night>.01;this.moon.visible=enabled&&night>.05;
    this.moonHalo.visible=this.moon.visible;this.moonOpacity.value=enabled?night:0;this.moonHalo.material.opacity=enabled?night*.65:0;
  }
}
