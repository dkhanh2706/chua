import * as THREE from 'three';
import {seededRandom} from './garden-layout.mjs';
import {addNightLight} from './night-lights.mjs';
import {waterWaveGLSL,sampleWaterWaves} from './water-waves.mjs';

// Use the same shoreline for displacement, breaking waves and the waterline.
const shorelineGLSL=`
  float shore(float x){x=clamp(x,-56.6,56.6);float bay=-72.+4.*sin((x+39.)*.055)+1.5*sin(x*.15)+25.*(1.-smoothstep(-55.,-40.,x));return mix(bay,-88.,smoothstep(16.,30.,x));}
  float coastDistance(vec2 p){
    float start=-43.-27.*smoothstep(18.,28.,p.x);
    float sideWidth=20.+2.*sin(p.y*.05)+1.5*sin(p.y*.13);
    float side=max(0.,(abs(p.x)-56.6)/sideWidth);
    float rear=max(0.,(start-p.y)/(start-shore(p.x)));
    float frontShore=66.+2.8*sin(p.x*.055)+1.2*sin(p.x*.13);
    float front=max(0.,(p.y-44.6)/(frontShore-44.6));
    return (length(vec2(side,max(rear,front)))-1.)*20.;
  }
`;

function grid(rows,columns,point){
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
    positions.push(...point(i/rows,j/columns));uv.push(j/columns,i/rows);
    if(i<rows&&j<columns){const a=i*(columns+1)+j,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export class Seaside{
  constructor(parent,night={value:0}){
    this.layout=window.COAST;this.shore=window.coastShoreZ;this.height=window.coastHeight;this.progress=window.coastProgress;
    this.root=new THREE.Group();this.root.name='open-sea-and-sloping-beach';parent.add(this.root);
    this.time={value:0};this.night=night;this.boats=[];this.buildBeach();this.buildSea();this.buildBoats();this.buildLighthouse();
  }
  buildBeach(){
    const c=this.layout,geometry=grid(260,240,(v,u)=>{
      const x=THREE.MathUtils.lerp(-92,92,u),z=THREE.MathUtils.lerp(-108,88,v);
      return[x,this.height(x,z)-.025,z];
    });
    const colors=[],p=geometry.attributes.position;
    const triangles=[];
    for(let i=0;i<geometry.index.count;i+=3){
      const ids=[geometry.index.getX(i),geometry.index.getX(i+1),geometry.index.getX(i+2)];
      const inner=ids.every(j=>p.getX(j)>=c.left&&p.getX(j)<=c.right&&p.getZ(j)>=c.sandStart&&p.getZ(j)<=c.front);
      if(!inner&&ids.some(j=>this.progress(p.getX(j),p.getZ(j))<1.5))triangles.push(...ids);
    }
    geometry.setIndex(triangles);
    const grass=new THREE.Color('#83ac76'),dry=new THREE.Color('#e9d6a7'),wet=new THREE.Color('#b4b397');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i),t=this.progress(x,z);
      const color=dry.clone().lerp(wet,THREE.MathUtils.smoothstep(t,.73,1));
      color.lerp(grass,1-THREE.MathUtils.smoothstep(t,0,.16));
      color.multiplyScalar(1+.018*Math.sin(x*2.3+z*1.7));colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSandPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSandPosition=position;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSandPosition;').replace('#include <color_fragment>',`#include <color_fragment>
        float grain=fract(sin(dot(floor(vSandPosition.xz*145.0),vec2(127.1,311.7)))*43758.5453);
        float dune=sin(vSandPosition.x*4.0+sin(vSandPosition.z*.6)*1.4);
        diffuseColor.rgb*=.975+grain*.05+dune*.012;`);
    };
    material.customProgramCacheKey=()=> 'coastal-sand-grain-v1';
    this.sand=new THREE.Mesh(geometry,material);this.sand.name='walkable-sloping-sand';this.sand.receiveShadow=true;this.root.add(this.sand);
    // A few tiny shells give the near sand scale without cluttering the open beach.
    const random=seededRandom(7183),shells=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,5),new THREE.MeshStandardMaterial({color:'#f1e6cc',roughness:.9}),100),dummy=new THREE.Object3D();
    for(let i=0;i<shells.count;i++){
      let x,z,t;
      do{x=-84+random()*168;z=-100+random()*178;t=this.progress(x,z);}while(t<.62||t>.94);
      const size=.045+random()*.045;
      dummy.position.set(x,this.height(x,z)+.015,z);dummy.rotation.set(0,random()*Math.PI,0);dummy.scale.set(size,.022,size*.8);dummy.updateMatrix();shells.setMatrixAt(i,dummy.matrix);
    }
    shells.name='scattered-beach-shells';shells.computeBoundingSphere();shells.receiveShadow=true;this.root.add(shells);
  }
  buildSea(){
    const c=this.layout;
    // Dense near the island, broad enough to merge with the sky in every direction.
    const geometry=grid(200,200,(v,u)=>{
      const a=u*2-1,b=v*2-1;
      return[Math.sign(a)*Math.pow(Math.abs(a),2.2)*2400,c.waterY,-17+Math.sign(b)*Math.pow(Math.abs(b),2.2)*2400];
    });
    const material=new THREE.ShaderMaterial({
      side:THREE.DoubleSide,uniforms:{uTime:this.time,uNight:this.night,
        uDayHorizon:{value:new THREE.Color('#a8c9cd').convertLinearToSRGB()},uNightHorizon:{value:new THREE.Color('#111e38').convertLinearToSRGB()}},
      vertexShader:`uniform float uTime;varying vec3 vWorld;
        ${waterWaveGLSL}
        ${shorelineGLSL}
        void main(){vec3 p=position;
          p.y+=waterWaves(p.xz,uTime).x*smoothstep(-1.,8.,coastDistance(p.xz));
          vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
      fragmentShader:`uniform float uTime;uniform float uNight;uniform vec3 uDayHorizon;uniform vec3 uNightHorizon;varying vec3 vWorld;
        ${waterWaveGLSL}
        ${shorelineGLSL}
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){
          vec2 p=vWorld.xz;float distance=coastDistance(p);
          float swash=sin(uTime*.72+p.x*.035+p.y*.027)*.42+sin(uTime*1.13+p.x*.07)*.13;
          float edge=distance+swash;
          if(edge<0.)discard;
          float nearShore=smoothstep(-1.,8.,distance);
          vec3 waves=waterWaves(p,uTime);
          // Small wind ripples fade with pixel footprint to avoid distant shimmer.
          float detailFade=1.-smoothstep(.2,1.1,max(length(dFdx(p)),length(dFdy(p))));
          vec3 detail=waterWave(p,uTime,vec2(.8,-.6),6.8,.006,2.4)*detailFade;
          vec2 slope=(waves.yz+detail.yz)*nearShore;
          vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
          vec3 view=normalize(cameraPosition-vWorld),reflected=reflect(-view,normal);
          float fresnel=.025+.975*pow(1.-max(dot(normal,view),0.),5.);
          float depth=1.-exp(-max(0.,distance)*.055);
          vec3 water=mix(vec3(.13,.48,.43),vec3(.018,.16,.25),depth);
          water+=vec3(.025,.065,.052)*waves.x;
          water*=mix(vec3(1.),vec3(.17,.27,.43),uNight);
          float skyHeight=smoothstep(0.,.8,reflected.y);
          vec3 sky=mix(vec3(.48,.69,.71),vec3(.17,.40,.62),skyHeight);
          float cloud=noise(reflected.xz*5.+vec2(uTime*.008,0.));
          sky+=vec3(.08)*smoothstep(.5,.8,cloud)*(1.-skyHeight*.6);
          sky=mix(sky,mix(vec3(.055,.09,.16),vec3(.012,.025,.065),skyHeight),uNight);
          water=mix(water,sky,fresnel*.82);
          vec3 sun=normalize(vec3(-.45,.82,.35)),moon=normalize(vec3(-.24,.72,-.65));
          float sunGlint=pow(max(dot(normal,normalize(sun+view)),0.),240.);
          float moonGlint=pow(max(dot(normal,normalize(moon+view)),0.),170.);
          water+=vec3(1.,.87,.62)*sunGlint*.48*(1.-uNight)+vec3(.45,.61,.85)*moonGlint*.32*uNight;
          // Broken crests travel towards the entire island, then dissolve in the wash.
          vec2 drift=p*.48+vec2(uTime*.11,-uTime*.17);
          float lace=noise(drift)*.65+noise(drift*2.7)*.35;
          float phase=distance*.86+uTime*1.45+noise(p*.09)*2.4;
          float breaker=smoothstep(.74,.98,sin(phase))*(1.-smoothstep(1.5,13.,distance));
          float patches=smoothstep(.24,.72,lace);
          float wash=(1.-smoothstep(.08,1.25,edge))*(.3+.7*patches);
          float pores=.55+.45*smoothstep(.2,.75,noise(drift*6.3));
          float foam=clamp((breaker*patches*.6+wash*.75)*pores,0.,.85);
          vec3 foamColor=mix(vec3(.79,.88,.81),vec3(.16,.23,.32),uNight);
          water=mix(water,foamColor,foam);
          gl_FragColor=vec4(water,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          float haze=smoothstep(140.,1050.,length(cameraPosition.xz-vWorld.xz));
          gl_FragColor.rgb=mix(gl_FragColor.rgb,mix(uDayHorizon,uNightHorizon,uNight),haze);
        }`
    });
    this.water=new THREE.Mesh(geometry,material);this.water.name='ocean-to-the-horizon';this.root.add(this.water);
  }
  part(parent,geometry,material,x,y,z,sx=1,sy=1,sz=1){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  buildBoats(){
    const wood=new THREE.MeshStandardMaterial({color:'#85664c',roughness:.9}),deck=new THREE.MeshStandardMaterial({color:'#d9c396',roughness:.9});
    const sail=new THREE.MeshStandardMaterial({color:'#f7efd9',side:THREE.DoubleSide,roughness:.9});
    const hull=new THREE.Shape();hull.moveTo(0,-1.8);hull.bezierCurveTo(-.7,-.7,-.7,.8,-.38,1.3);hull.quadraticCurveTo(0,1.55,.38,1.3);hull.bezierCurveTo(.7,.8,.7,-.7,0,-1.8);
    const hullGeo=new THREE.ExtrudeGeometry(hull,{depth:.42,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:2,steps:1});
    const deckGeo=new THREE.ShapeGeometry(hull),sailGeo=new THREE.BufferGeometry();
    sailGeo.setAttribute('position',new THREE.Float32BufferAttribute([.05,.8,0,.05,3.05,0,1.35,.9,0],3));sailGeo.computeVertexNormals();
    for(const [i,[x,z,scale,angle]] of [[-34,-110,1.05,.4],[108,-15,.82,-.5],[-112,8,.9,.7],[25,102,.7,-.3],[-13,-220,.7,.2]].entries()){
      const boat=new THREE.Group();boat.name=`small-offshore-boat-${i}`;boat.position.set(x,this.layout.waterY+.18,z);boat.rotation.y=angle;boat.scale.setScalar(scale);this.root.add(boat);
      const body=this.part(boat,hullGeo,wood,0,.3,0);body.rotation.x=Math.PI/2;
      const floor=this.part(boat,deckGeo,deck,0,.31,0,.92,.92,.92);floor.rotation.x=Math.PI/2;
      if(i%2===0){
        this.part(boat,new THREE.CylinderGeometry(.035,.045,3.1,8),wood,0,1.8,0);
        this.part(boat,sailGeo,sail,0,.1,0);
        this.part(boat,new THREE.BoxGeometry(.95,.12,.28),wood,0,.55,.55);
      }else{
        this.part(boat,new THREE.BoxGeometry(.85,.45,.8),new THREE.MeshStandardMaterial({color:i===1?'#a7bfba':'#c0a58b',roughness:.9}),0,.56,.1);
        this.part(boat,new THREE.BoxGeometry(1.05,.1,1.1),deck,0,.84,.1);
      }
      this.boats.push({root:boat,x,z,angle,phase:i*1.7});
    }
  }
  buildLighthouse(){
    const root=new THREE.Group(),x=-50,z=-113;root.name='offshore-lighthouse';root.position.set(x,this.layout.waterY,z);this.root.add(root);this.lighthouse=root;
    const stone=new THREE.MeshStandardMaterial({color:'#788c88',roughness:1}),ivory=new THREE.MeshStandardMaterial({color:'#efe6cf',roughness:.85});
    const red=new THREE.MeshStandardMaterial({color:'#a86751',roughness:.8}),metal=new THREE.MeshStandardMaterial({color:'#465c59',metalness:.35,roughness:.6});
    const random=seededRandom(948);
    for(let i=0;i<9;i++){
      const a=i/9*Math.PI*2,r=1.2+random()*1.1;
      this.part(root,new THREE.IcosahedronGeometry(1,1),stone,Math.cos(a)*r,.35+random()*.25,Math.sin(a)*r,1.4+random()*.6,1.0+random()*.4,1.4+random()*.5);
    }
    this.part(root,new THREE.CylinderGeometry(2.35,2.65,.45,24),ivory,0,1.15,0);
    this.part(root,new THREE.CylinderGeometry(.85,1.22,10.2,24),ivory,0,6.3,0);
    const radiusAt=y=>1.22-(y-1.2)/10.2*.37;
    for(const y of [4.15,7.85])this.part(root,new THREE.CylinderGeometry(radiusAt(y+.525)+.018,radiusAt(y-.525)+.018,1.05,24),red,0,y,0);
    this.part(root,new THREE.BoxGeometry(.55,1.1,.08),metal,0,1.95,1.19);
    for(const y of [5.5,9.3])this.part(root,new THREE.BoxGeometry(.24,.44,.05),metal,0,y,1.08-(y-1.2)*.035);
    this.part(root,new THREE.CylinderGeometry(1.4,1.4,.22,24),metal,0,11.45,0);
    const lamp=new THREE.MeshStandardMaterial({color:'#f6df9e',emissive:'#ffdda0',emissiveIntensity:0,roughness:.3});lamp.userData.nightEmission=2.3;
    this.part(root,new THREE.CylinderGeometry(.66,.66,1.25,20),lamp,0,12.2,0);
    for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2;
      this.part(root,new THREE.CylinderGeometry(.025,.025,.63,6),metal,Math.cos(a)*1.21,11.85,Math.sin(a)*1.21);
      if(i%2===0)this.part(root,new THREE.CylinderGeometry(.035,.035,1.45,6),metal,Math.cos(a)*.74,12.2,Math.sin(a)*.74);
    }
    const railing=this.part(root,new THREE.TorusGeometry(1.21,.035,6,32),metal,0,12.16,0);railing.rotation.x=Math.PI/2;
    this.part(root,new THREE.ConeGeometry(1.12,.9,24),red,0,13.25,0);
    this.part(root,new THREE.CylinderGeometry(.025,.035,.6,8),metal,0,14,0);
    addNightLight(root,0,12.2,0,48,18);
    this.beacon=new THREE.Group();this.beacon.position.y=12.2;root.add(this.beacon);
    const beamGeo=new THREE.ConeGeometry(9,65,32,1,true);beamGeo.translate(0,-32.5,0);beamGeo.rotateZ(Math.PI/2);
    const beamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uNight:this.night},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform float uNight;varying vec2 vUv;void main(){gl_FragColor=vec4(.98,.88,.62,uNight*.035*pow(vUv.y,1.4));}'});
    const beam=new THREE.Mesh(beamGeo,beamMaterial);beam.name='turning-lighthouse-beam';this.beacon.add(beam);
  }
  update(time){
    this.time.value=time;
    for(const b of this.boats){
      const x=b.x+Math.sin(time*.035+b.phase)*.35,wave=sampleWaterWaves(x,b.z,time);
      const fade=THREE.MathUtils.smoothstep((this.progress(x,b.z)-1)*20,-1,8),c=Math.cos(b.angle),s=Math.sin(b.angle);
      b.root.position.set(x,this.layout.waterY+.18+wave.height*fade,b.z);
      b.root.rotation.set(-Math.atan((wave.dx*s+wave.dz*c)*fade),b.angle,Math.atan((wave.dx*c-wave.dz*s)*fade),'YXZ');
    }
    this.beacon.rotation.y=time*.12;
  }
}
