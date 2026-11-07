import * as THREE from 'three';
import {seededRandom} from './garden-layout.mjs';
import {GARDEN_BOUNDS} from './garden-boundary.mjs';
import {streamCenter} from './waterfall-layout.mjs';
import {addNightLight} from './night-lights.mjs';

export const riverCenter=streamCenter;
const halfWidth=z=>3.6+Math.exp(-(((z+22)/3.6)**2));
const BRIDGE_Z=15.5,SPAN=6.6,RIVER_LENGTH=GARDEN_BOUNDS.front+.4+24;

function strip(rows,columns,point){
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
    positions.push(...point(i/rows,j/columns));uv.push(j/columns,i/rows);
    if(i<rows&&j<columns){const a=i*(columns+1)+j,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export class RiverGarden{
  constructor(parent,time,night={value:0}){
    this.root=new THREE.Group();this.root.name='river-and-arched-bridge';parent.add(this.root);this.time=time;this.night=night;
    this.random=seededRandom(5842);this.dummy=new THREE.Object3D();this.buildTerrain();this.buildRiver();this.buildBanks();this.buildBridge();this.buildFish();
  }
  buildTerrain(){
    const {left,right,rear,front}=GARDEN_BOUNDS;
    const grass=new THREE.MeshStandardMaterial({color:'#83ac76',roughness:1});
    const upper=new THREE.Mesh(new THREE.PlaneGeometry(right-left+1.2,-24-rear+.6),grass);upper.rotation.x=-Math.PI/2;upper.position.set(0,-.025,(rear-.6-24)/2);upper.receiveShadow=true;this.root.add(upper);
    for(const side of [-1,1]){
      const shape=new THREE.Shape(),edge=side<0?left-.6:right+.6;
      shape.moveTo(edge,-24);shape.lineTo(riverCenter(-24)+side*halfWidth(-24),-24);
      for(let z=-24;z<=front+.61;z+=.25)shape.lineTo(riverCenter(z)+side*halfWidth(z),z);
      shape.lineTo(edge,front+.6);shape.closePath();
      const land=new THREE.Mesh(new THREE.ShapeGeometry(shape),grass);land.rotation.x=Math.PI/2;land.position.y=-.025;land.material.side=THREE.DoubleSide;land.receiveShadow=true;land.name='recessed-river-terrain';this.root.add(land);
    }
    const bed=new THREE.Mesh(strip(180,8,(v,u)=>{const z=-24+v*RIVER_LENGTH;return[riverCenter(z)+(u-.5)*halfWidth(z)*2,-.34,z];}),new THREE.MeshStandardMaterial({color:'#3488a2',roughness:.95,side:THREE.DoubleSide}));
    bed.name='blue-riverbed';bed.receiveShadow=true;this.root.add(bed);
  }
  buildRiver(){
    const geometry=strip(180,12,(v,u)=>{const z=-24+v*RIVER_LENGTH;return[riverCenter(z)+(u-.5)*halfWidth(z)*2,.055,z];});
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:this.time,uNight:this.night},side:THREE.DoubleSide,
      vertexShader:`uniform float uTime;varying vec2 vUv;varying vec3 vWorld;
        void main(){vUv=uv;vec3 p=position;float bank=sin(uv.x*3.14159);p.y+=sin(p.z*2.1+p.x*1.4-uTime*1.7)*.009*bank;vWorld=(modelMatrix*vec4(p,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}`,
      fragmentShader:`uniform float uTime;uniform float uNight;varying vec2 vUv;varying vec3 vWorld;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){
          float depth=pow(max(0.,sin(vUv.x*3.14159)),.65);
          vec2 flow=vec2(vUv.x*7.0,vWorld.z*.48-uTime*.42);
          float n=noise(flow+vec2(noise(flow*.55),0.0));
          float ripple=sin(vWorld.z*5.6-uTime*3.0+sin(vWorld.x*2.4+uTime*.3)*1.3);
          float fine=sin(vWorld.z*12.0-uTime*5.0+vWorld.x*7.0);
          vec3 normal=normalize(vec3(.035*cos(vWorld.x*2.4),1.0,.055*ripple+.016*fine));
          vec3 viewDirection=normalize(cameraPosition-vWorld);
          float fresnel=pow(1.0-max(0.0,dot(normal,viewDirection)),3.0);
          vec3 water=mix(vec3(.15,.59,.69),vec3(.025,.29,.46),depth);
          water+=vec3(.035,.055,.045)*(n-.5);
          water=mix(water,vec3(.55,.78,.94),fresnel*.4);
          float glimmer=pow(max(0.0,ripple),18.0)*smoothstep(.52,.85,n)*.16;
          float streak=pow(max(0.0,sin(vUv.x*105.0+noise(flow*.8)*4.0)),24.0)*smoothstep(.5,.85,n)*.065;
          float shore=(1.0-smoothstep(.0,.14,min(vUv.x,1.0-vUv.x)))*(.025+.035*n);
          water+=vec3(.68,.81,.72)*(glimmer+streak+shore);
          water*=mix(vec3(1.),vec3(.32,.46,.66),uNight);
          gl_FragColor=vec4(water,.28+fresnel*.32+(1.-depth)*.1);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    this.water=new THREE.Mesh(geometry,material);this.water.name='connected-river';this.root.add(this.water);
    this.drift=[];const count=38;
    this.glints=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:'#d8e9d4',transparent:true,opacity:.19,depthWrite:false,side:THREE.DoubleSide}),count);
    this.glints.name='downstream-flow-glints';this.glints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.glints.frustumCulled=false;this.root.add(this.glints);
    for(let i=0;i<count;i++)this.drift.push({offset:this.random()*RIVER_LENGTH,side:(this.random()-.5)*5.4,length:.24+this.random()*.6,speed:.65+this.random()*.35});
  }
  buildBanks(){
    const random=this.random,dummy=this.dummy,stones=[];
    this.banks=new THREE.Group();this.banks.name='natural-riverbanks';this.root.add(this.banks);
    for(const side of [-1,1]){
      const bankGeo=strip(160,5,(v,u)=>{
        const z=-24+v*68,edge=halfWidth(z)-.07,spread=1.45+.15*Math.sin(z*1.2);
        return[riverCenter(z)+side*(edge+u*spread),.025+Math.sin(u*Math.PI)*(.12+.05*Math.sin(z*1.7)),z];
      });
      const bank=new THREE.Mesh(bankGeo,new THREE.MeshStandardMaterial({color:'#7f8c68',roughness:1,side:THREE.DoubleSide}));bank.receiveShadow=true;this.banks.add(bank);
      for(let z=-23.7;z<43;z+=.58+random()*.47){
        if(Math.abs(z-BRIDGE_Z)<3.2)continue;
        const width=halfWidth(z),offset=random()*.7;
        stones.push({x:riverCenter(z)+side*(width+.1+offset),z:z+(random()-.5)*.35,sx:.28+random()*.53,sy:.14+random()*.3,sz:.28+random()*.5});
        if(random()>.55)stones.push({x:riverCenter(z)+side*(width-.12),z:z+.25,sx:.14+random()*.18,sy:.09+random()*.12,sz:.16+random()*.18});
      }
    }
    const geo=new THREE.IcosahedronGeometry(1,1),rockMaterial=new THREE.MeshStandardMaterial({color:'#a4a58e',roughness:1});
    this.rocks=new THREE.InstancedMesh(geo,rockMaterial,stones.length);this.rocks.name='irregular-bank-stones';
    stones.forEach((stone,i)=>{dummy.position.set(stone.x,.06,stone.z);dummy.rotation.set(random()*.4,random()*Math.PI*2,random()*.25);dummy.scale.set(stone.sx,stone.sy,stone.sz);dummy.updateMatrix();this.rocks.setMatrixAt(i,dummy.matrix);this.rocks.setColorAt(i,new THREE.Color().setHSL(.13+random()*.05,.10+random()*.1,.7+random()*.19));});
    this.rocks.castShadow=true;this.rocks.receiveShadow=true;this.rocks.computeBoundingSphere();this.banks.add(this.rocks);
    const reedGeometry=new THREE.BufferGeometry();reedGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.05,0,0,.05,0,0,-.045,.55,.025,.045,.55,.025,.13,1.05,.09],3));reedGeometry.setIndex([0,1,2,1,3,2,2,3,4]);reedGeometry.computeVertexNormals();
    const reeds=new THREE.InstancedMesh(reedGeometry,new THREE.MeshStandardMaterial({color:'#788657',side:THREE.DoubleSide,roughness:1}),168);
    let index=0;
    for(let i=0;i<28;i++){
      const z=-20+i*2.3;if(Math.abs(z-BRIDGE_Z)<4)continue;
      const side=i%2?1:-1,x=riverCenter(z)+side*(halfWidth(z)+.85);
      for(let j=0;j<6;j++){
        dummy.position.set(x+(random()-.5)*.38,.04,z+(random()-.5)*.4);dummy.rotation.set(0,j*Math.PI/3+random(),(random()-.5)*.2);dummy.scale.set(1,.45+random()*.55,1);dummy.updateMatrix();reeds.setMatrixAt(index++,dummy.matrix);
      }
    }
    reeds.count=index;reeds.name='riverside-reeds';reeds.computeBoundingSphere();this.banks.add(reeds);
  }
  buildBridge(){
    const center=riverCenter(BRIDGE_Z),root=new THREE.Group();root.name='arched-garden-bridge';root.position.set(center,0,BRIDGE_Z);this.root.add(root);this.bridge=root;
    const deckHeight=x=>window.bridgeHeight((center+x)*10+500,505);
    const stone=new THREE.MeshStandardMaterial({color:'#aaa68d',roughness:.93}),wood=new THREE.MeshStandardMaterial({color:'#8c6240',roughness:.85}),rail=new THREE.MeshStandardMaterial({color:'#694b33',roughness:.8});
    const boxGeo=new THREE.BoxGeometry(1,1,1),dummy=this.dummy;
    const part=(geo,material,x,y,z,sx=1,sy=1,sz=1)=>{const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
    const planks=new THREE.InstancedMesh(boxGeo,wood,36);planks.name='curved-timber-deck';
    for(let i=0;i<36;i++){
      const x=-SPAN+(i+.5)*SPAN*2/36,slope=(deckHeight(x+.01)-deckHeight(x-.01))/.02;
      dummy.position.set(x,deckHeight(x)-.08,0);dummy.rotation.set(0,0,Math.atan(slope));dummy.scale.set(SPAN*2/36-.014,.16,6);dummy.updateMatrix();planks.setMatrixAt(i,dummy.matrix);const c=.9+(i%7)*.025;planks.setColorAt(i,new THREE.Color(c,c*.96,c*.88));
    }
    planks.castShadow=true;planks.receiveShadow=true;planks.computeBoundingSphere();root.add(planks);
    for(const side of [-1,1]){
      // The arch soffit is open over the water; curved stringers carry the deck.
      const fascia=strip(64,1,(v,u)=>{const x=-SPAN+v*SPAN*2;return[x,deckHeight(x)-.12-u*.32,side*2.9];});
      part(fascia,new THREE.MeshStandardMaterial({color:'#aaa68d',roughness:1,side:THREE.DoubleSide}),0,0,0);
      for(const height of [.58,1.25]){
        const points=Array.from({length:49},(_,i)=>{const x=-SPAN+i*SPAN*2/48;return new THREE.Vector3(x,deckHeight(x)+height,side*2.78);});
        part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,height>1?.09:.055,8,false),rail,0,0,0);
      }
      for(let i=0;i<7;i++){
        const x=-6.3+i*2.1,y=deckHeight(x);
        part(boxGeo,stone,x,y+.13,side*2.78,.54,.26,.54);
        part(new THREE.CylinderGeometry(.13,.17,1.15,12),stone,x,y+.71,side*2.78);
        part(new THREE.SphereGeometry(1,16,10),stone,x,y+1.38,side*2.78,.23,.18,.23);
        if(i%3===0){
          const glow=new THREE.MeshStandardMaterial({color:'#fce3ab',emissive:'#ffd18a',emissiveIntensity:0,roughness:.35});glow.userData.nightEmission=2.8;
          part(boxGeo,rail,x,y+1.48,side*2.78,.45,.09,.45);
          const lantern=part(boxGeo,glow,x,y+1.72,side*2.78,.32,.4,.32);lantern.name='bridge-lantern';
          for(const dx of [-.18,.18])for(const dz of [-.18,.18])part(boxGeo,rail,x+dx,y+1.72,side*2.78+dz,.035,.44,.035);
          part(new THREE.ConeGeometry(.36,.22,4),rail,x,y+2.03,side*2.78,1,1,1).rotation.y=Math.PI/4;
          if(i===3)addNightLight(root,x,y+1.9,side*2.78,22,10);
        }
      }
      for(let i=0;i<6;i++){
        const x=-5.25+i*2.1,y=deckHeight(x)+.85;
        const diamond=new THREE.Shape();diamond.moveTo(0,.25);diamond.lineTo(.31,0);diamond.lineTo(0,-.25);diamond.lineTo(-.31,0);diamond.closePath();
        const hole=new THREE.Path();hole.moveTo(0,.17);hole.lineTo(-.22,0);hole.lineTo(0,-.17);hole.lineTo(.22,0);hole.closePath();diamond.holes.push(hole);
        part(new THREE.ExtrudeGeometry(diamond,{depth:.045,bevelEnabled:false}),rail,x,y,side*2.78);
      }
    }
    for(const side of [-1,1]){
      part(boxGeo,stone,side*6.25,-.14,0,.8,.28,6.3);
      for(let i=0;i<3;i++)part(boxGeo,stone,side*(7.05+i*.8),-.035,0,.77,.1,5.5);
    }
    const trim=new THREE.MeshStandardMaterial({color:'#d9ba7c',emissive:'#ffc77c',emissiveIntensity:0,roughness:.45});trim.userData.nightEmission=1.8;
    for(const side of [-1,1]){
      const points=Array.from({length:65},(_,i)=>{const x=-SPAN+i*SPAN*2/64;return new THREE.Vector3(x,deckHeight(x)-.16,side*2.97);});
      part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,.035,6,false),trim,0,0,0).name='bridge-arch-light-strip';
    }
  }
  buildFish(){
    this.fish=[];
    const bodyGeo=new THREE.SphereGeometry(1,16,8),tailShape=new THREE.Shape();tailShape.moveTo(0,0);tailShape.lineTo(-.4,.24);tailShape.quadraticCurveTo(-.3,0,-.4,-.24);tailShape.closePath();
    const tailGeo=new THREE.ShapeGeometry(tailShape),fin=new THREE.MeshStandardMaterial({color:'#f6d9ad',side:THREE.DoubleSide,roughness:.5});
    for(let i=0;i<16;i++){
      const g=new THREE.Group();g.name=`river-fish-${i}`;this.root.add(g);
      const material=new THREE.MeshStandardMaterial({color:['#ed8c40','#f3dfb4','#e8b957','#d75b47'][i%4],roughness:.45});
      const body=new THREE.Mesh(bodyGeo,material);body.scale.set(.51,.045,.14);g.add(body);
      const tail=new THREE.Mesh(tailGeo,fin);tail.position.x=-.43;tail.rotation.x=-Math.PI/2;g.add(tail);
      for(const side of [-1,1]){const f=new THREE.Mesh(bodyGeo,fin);f.position.set(.03,0,side*.13);f.scale.set(.14,.01,.12);g.add(f);}
      const stripe=new THREE.Mesh(bodyGeo,new THREE.MeshStandardMaterial({color:i%2?'#fff1d3':'#ae4c2f',roughness:.5}));stripe.position.set(-.07,.034,0);stripe.scale.set(.19,.015,.09);g.add(stripe);
      const eyeMat=new THREE.MeshBasicMaterial({color:'#182d39'});
      for(const side of [-1,1]){const eye=new THREE.Mesh(bodyGeo,eyeMat);eye.position.set(.33,.032,side*.075);eye.scale.set(.02,.009,.018);g.add(eye);}
      const scale=.7+this.random()*.35;g.scale.setScalar(scale);
      this.fish.push({g,tail,phase:this.random()*Math.PI*2,station:-17+i*3.5,side:(this.random()-.5)*3.4,speed:.17+this.random()*.1});
    }
  }
  update(time){
    this.fish.forEach((f,i)=>{
      const phase=time*f.speed+f.phase,z=f.station+Math.sin(phase)*2.5,x=riverCenter(z)+f.side+Math.sin(phase*.7)*.32;
      const dz=Math.cos(phase)*2.5*f.speed,dx=(riverCenter(z+.01)-riverCenter(z-.01))/.02*dz+Math.cos(phase*.7)*.224*f.speed;
      f.g.position.set(x,-.14+Math.sin(time*.8+i)*.018,z);f.g.rotation.y=Math.atan2(-dz,dx);f.tail.rotation.z=Math.sin(time*4+i)*.35;
    });
    this.drift.forEach((d,i)=>{
      const z=-24+(d.offset+time*d.speed)%RIVER_LENGTH,x=riverCenter(z)+d.side+Math.sin(z*.5+i)*.08;
      this.dummy.position.set(x,.082,z);this.dummy.rotation.set(-Math.PI/2,0,Math.sin(z*.3)*.12);this.dummy.scale.set(.018,d.length,1);this.dummy.updateMatrix();this.glints.setMatrixAt(i,this.dummy.matrix);
    });this.glints.instanceMatrix.needsUpdate=true;
  }
}
