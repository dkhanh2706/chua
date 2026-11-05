import * as THREE from 'three';
import {seededRandom} from './garden-layout.mjs';

const TAU=Math.PI*2;
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.65,...extra});

// All motion uses elapsed time, so swimming and ripples keep the same pace at 30/60 fps.
export class LotusPond{
  constructor(parent){
    this.root=new THREE.Group();this.root.name='living-lotus-pond';this.root.position.set(-29.6,0,10.1);parent.add(this.root);
    this.random=seededRandom(2841);this.time={value:0};this.pads=[];this.fish=[];this.ripples=[];
    this.sphere=new THREE.SphereGeometry(1,16,10);
    this.buildWater();this.buildLotuses();this.buildFish();this.buildRipples();this.update(0);
  }
  part(parent,geometry,mat,x,y,z,sx=1,sy=1,sz=1){
    const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
  }
  buildWater(){
    const bed=this.part(this.root,new THREE.CircleGeometry(1,96),material('#3bafbf'),0,.012,0,13.4,8.6,1);bed.rotation.x=-Math.PI/2;
    const water=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:this.time},side:THREE.DoubleSide,
      vertexShader:`uniform float uTime;varying vec3 vWorld;varying vec2 vLocal;
        void main(){vec3 p=position;vLocal=p.xy;p.z+=sin(p.x*1.8+uTime*.8)*sin(p.y*2.1-uTime*.65)*.012;
        vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
      fragmentShader:`uniform float uTime;varying vec3 vWorld;varying vec2 vLocal;
        void main(){vec2 p=vWorld.xz;float t=uTime;
          float a=sin(p.x*2.8+p.y*1.7-t*1.15+sin(p.y*1.3+t*.3));
          float b=sin(p.x*-1.6+p.y*3.5+t*.85+sin(p.x*.9-t*.2));
          vec3 n=normalize(vec3(a*.075,1.,b*.065));vec3 view=normalize(cameraPosition-vWorld);
          float fresnel=pow(1.-max(dot(n,view),0.),3.);
          float edge=smoothstep(.72,1.,length(vLocal));
          vec3 color=mix(vec3(.035,.46,.64),vec3(.25,.76,.83),edge);
          color=mix(color,vec3(.76,.94,1.),fresnel*.45);
          float caustic=pow(max(0.,1.-abs(a+b)*.5),22.);
          float sparkle=pow(max(dot(reflect(normalize(vec3(-.45,-1.,-.3)),n),view),0.),80.);
          color+=vec3(.64,.92,1.)*caustic*.085+vec3(.90,.97,1.)*sparkle*.48;
          gl_FragColor=vec4(color,.27+fresnel*.24+edge*.10);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    // Circle vertices stay in unit space; the mesh scale shapes the elliptical shoreline.
    this.water=this.part(this.root,new THREE.CircleGeometry(1,96),water,0,.235,0,13.4,8.6,1);this.water.rotation.x=-Math.PI/2;this.water.name='shimmering-pond-water';
    const rockGeo=new THREE.IcosahedronGeometry(1,1),rocks=new THREE.InstancedMesh(rockGeo,material('#a2ab8b'),64),dummy=new THREE.Object3D();
    for(let i=0;i<64;i++){
      const a=i/64*TAU;dummy.position.set(Math.cos(a)*13.65,.13,Math.sin(a)*8.85);dummy.rotation.set(this.random()*.3,a,this.random()*.4);dummy.scale.set(.45+this.random()*.4,.22+this.random()*.23,.4+this.random()*.3);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
    }
    rocks.castShadow=true;rocks.receiveShadow=true;rocks.name='pond-shore-stones';this.root.add(rocks);
    const stepGeo=new THREE.CylinderGeometry(1,1.08,.20,24),stepMat=material('#b6c2b9');
    for(const step of window.POND_STEPS){
      const stone=this.part(this.root,stepGeo,stepMat,(step.x-204)/10,.19,(step.y-451)/10,step.radius/10,1,step.radius/10);
      stone.name='pond-stepping-stone';stone.receiveShadow=true;
    }
  }
  padGeometry(){
    const shape=new THREE.Shape();shape.moveTo(.06,0);
    for(let i=0;i<=64;i++){const a=.15+i/64*(TAU-.3),r=1+Math.sin(a*7)*.025;shape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
    shape.lineTo(.06,0);shape.closePath();return new THREE.ShapeGeometry(shape,48);
  }
  buildLotuses(){
    const geometry=this.padGeometry(),greens=['#56865d','#639768','#729e69'];
    const makePad=(x,z,r,id=null)=>{
      const g=new THREE.Group();g.position.set(x,.34,z);this.root.add(g);
      const pad=this.part(g,geometry,material(greens[this.pads.length%3],{side:THREE.DoubleSide}),0,0,0,r,r,1);pad.rotation.x=-Math.PI/2;pad.rotation.z=id===null?this.random()*TAU:Math.PI/2;
      // Fine radial veins and a soft raised heart give the leaf its cupped shape.
      const points=[];for(let j=1;j<13;j++){const a=j/13*TAU;points.push(0,.012,0,Math.cos(a)*r*.9,.014,Math.sin(a)*r*.9);}
      const veins=new THREE.BufferGeometry();veins.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.add(new THREE.LineSegments(veins,new THREE.LineBasicMaterial({color:'#abc28a',transparent:true,opacity:.32})));
      this.part(g,this.sphere,material('#80a777'),0,.015,0,.12,.028,.12);
      g.name=id===null?'floating-lotus-leaf':`meditation-lotus-${id}`;this.pads.push({g,id,phase:this.random()*TAU});return g;
    };
    for(const seat of window.LOTUS_SEATS){
      const g=makePad((seat.x-204)/10,(seat.y-451)/10,seat.radius/10,seat.id);
      // Keep the centre free for meditation, with one blossom at the leaf's edge.
      const blossom=new THREE.Group();blossom.position.set(-1.35,0,-1.2);g.add(blossom);
      const stem=this.part(blossom,new THREE.CylinderGeometry(.025,.035,.48,8),material('#6e905a'),0,.23,0);
      for(let layer=0;layer<2;layer++)for(let j=0;j<8;j++){
        const a=j/8*TAU+layer*.4,petal=this.part(blossom,this.sphere,material(layer?'#f8dad4':'#df9fae'),Math.cos(a)*(.22-layer*.06),.49+layer*.11,Math.sin(a)*(.22-layer*.06),.14,.28,.09);
        petal.rotation.set(Math.sin(a)*.65,0,-Math.cos(a)*.65);
      }
      this.part(blossom,this.sphere,material('#eed185'),0,.65,0,.11,.09,.11);stem.castShadow=true;
    }
  }
  buildFish(){
    const colors=['#e99a48','#f1e4c8','#cf6946','#edc976','#e3d9c3','#dc7f51','#f4dab0','#a5b7ad'];
    const finShape=new THREE.Shape();finShape.moveTo(0,0);finShape.quadraticCurveTo(-.1,.25,-.48,.32);finShape.lineTo(-.34,0);finShape.lineTo(-.48,-.32);finShape.quadraticCurveTo(-.1,-.25,0,0);
    const finGeo=new THREE.ShapeGeometry(finShape);
    colors.forEach((color,i)=>{
      const g=new THREE.Group(),bodyMat=material(color,{roughness:.38});this.root.add(g);g.name=`pond-koi-${i}`;
      this.part(g,this.sphere,bodyMat,0,0,0,.65,.065,.22);
      this.part(g,this.sphere,material(i%2?'#c66b42':'#fff0d4'),-.14,.05,.015,.22,.02,.15);
      const tail=new THREE.Group();tail.position.x=-.53;g.add(tail);
      const fin=this.part(tail,finGeo,material(color,{side:THREE.DoubleSide,transparent:true,opacity:.8}),0,0,0);fin.rotation.x=-Math.PI/2;
      const fins=[];for(const side of [-1,1]){
        const f=this.part(g,this.sphere,bodyMat,.03,-.008,side*.2,.2,.015,.13);f.rotation.y=side*.55;fins.push(f);
        this.part(g,this.sphere,material('#28372e'),.43,.048,side*.11,.035,.012,.025);
      }
      const scale=.65+this.random()*.45;g.scale.setScalar(scale);
      this.fish.push({g,tail,fins,phase:i/8*TAU,rx:4+this.random()*6.5,rz:2.8+this.random()*3.8,speed:(i%2?1:-1)*(.065+this.random()*.035)});
    });
  }
  buildRipples(){
    const geo=new THREE.RingGeometry(.96,1,64);
    for(let i=0;i<12;i++){
      const a=this.random()*TAU,r=this.random()*.8;
      const ring=this.part(this.root,geo,new THREE.MeshBasicMaterial({color:'#d7f4ff',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),Math.cos(a)*12*r,.256,Math.sin(a)*7*r);ring.rotation.x=-Math.PI/2;
      this.ripples.push({ring,phase:i/12});
    }
  }
  update(time){
    this.time.value=time;
    this.pads.forEach(({g,id,phase})=>{
      g.position.y=id===null?.32+Math.sin(time*.8+phase)*.025:window.lotusHeight(id,time);
      if(id===null){g.rotation.x=Math.sin(time*.55+phase)*.018;g.rotation.z=Math.cos(time*.6+phase)*.018;}
    });
    this.fish.forEach((f,i)=>{
      const a=f.phase+time*f.speed,x=Math.cos(a)*f.rx,z=Math.sin(a)*f.rz;
      const dx=-Math.sin(a)*f.rx*f.speed,dz=Math.cos(a)*f.rz*f.speed;
      f.g.position.set(x,.12+Math.sin(time*.9+i)*.018,z);f.g.rotation.y=Math.atan2(-dz,dx);
      f.tail.rotation.y=Math.sin(time*3.8+i)*.36;f.fins.forEach((fin,j)=>fin.rotation.y=(j?1:-1)*(.55+Math.sin(time*2.4+i)*.15));
    });
    this.ripples.forEach(({ring,phase})=>{const age=(time*.14+phase)%1;ring.scale.setScalar(.15+age*1.7);ring.material.opacity=Math.sin(age*Math.PI)*.15;});
  }
}
