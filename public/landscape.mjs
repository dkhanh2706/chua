import * as THREE from 'three';
import {makeTreeLayout,seededRandom} from './garden-layout.mjs';
import {RiverGarden,riverCenter} from './river-garden.mjs';

import {cascadeCenter,cascadeHeight,cascadeHalfWidth,rockyHeight} from './waterfall-layout.mjs';

export const mountainHeight=rockyHeight;

function surfaceGeometry(rows,columns,point){
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
    positions.push(...point(i/rows,j/columns));uv.push(j/columns,i/rows);
    if(i<rows&&j<columns){const a=i*(columns+1)+j,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export class GardenLandscape{
  constructor(parent){
    this.root=new THREE.Group();this.root.name='garden-landscape';parent.add(this.root);
    this.time={value:0};this.buildPaving();this.buildMountain();this.buildWater();
  }
  buildPaving(){
    const trees=makeTreeLayout(),tiles=[],random=seededRandom(763),dummy=new THREE.Object3D();
    for(let z=-21;z<=29;z+=2)for(let x=-45;x<=45;x+=2){
      const hall=window.HALL,centerZ=(hall.y-350)/10;
      if(Math.hypot(x,z-centerZ)<hall.radius/10+1.2)continue;
      if(Math.abs(x)<8.3&&z>centerZ&&z<(window.HALL_ENTRY.y-350)/10+4.6)continue;
      if(((x+29.6)/15)**2+((z-10.1)/10.2)**2<1)continue;
      if(Math.abs(x-riverCenter(z))<5.2)continue;
      if(trees.some(t=>Math.hypot(x-t.x,z-t.z)<2.8))continue;
      tiles.push([x,z]);
    }
    const geo=new THREE.BoxGeometry(1.94,.12,1.94);
    const material=new THREE.MeshStandardMaterial({color:'#d2c8ae',roughness:.96});
    const paving=new THREE.InstancedMesh(geo,material,tiles.length);paving.name='even-square-paving';
    tiles.forEach(([x,z],i)=>{dummy.position.set(x,-.045,z);dummy.updateMatrix();paving.setMatrixAt(i,dummy.matrix);const shade=.94+random()*.1;paving.setColorAt(i,new THREE.Color().setRGB(shade,shade*.98,shade*.93));});
    paving.receiveShadow=true;paving.computeBoundingSphere();this.root.add(paving);this.paving=paving;
  }
  buildMountain(){
    const geometry=surfaceGeometry(140,100,(v,u)=>{const x=24+u*28,z=-65+v*40;return[x,mountainHeight(x,z),z];});
    const trimmed=[],positions=geometry.attributes.position;
    for(let i=0;i<geometry.index.count;i+=3){
      const ids=[geometry.index.getX(i),geometry.index.getX(i+1),geometry.index.getX(i+2)];
      if(ids.some(j=>positions.getY(j)>0)&&ids.every(j=>{
        const x=positions.getX(j),z=positions.getZ(j);
        return Math.abs(x-cascadeCenter(z))<cascadeHalfWidth(z)+.7;
      }))trimmed.push(...ids);
    }
    geometry.setIndex(trimmed);
    const colors=[];
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i),wet=Math.abs(x-cascadeCenter(z))<cascadeHalfWidth(z)+.7;
      const color=new THREE.Color(wet?'#415c57':'#667c79');color.multiplyScalar(.91+.09*Math.sin(x*1.7+z*.6));colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.mountain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
    this.mountain.name='terraced-rocky-mountain';this.mountain.castShadow=true;this.mountain.receiveShadow=true;this.root.add(this.mountain);
    const random=seededRandom(417),dummy=new THREE.Object3D(),rockGeo=new THREE.BoxGeometry(2,2,2,2,2,2),p=rockGeo.attributes.position;
    const v=new THREE.Vector3(),core=new THREE.Vector3();
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);core.copy(v).clampScalar(-.65,.65);v.sub(core).normalize().multiplyScalar(.35).add(core);
      const rough=1+.055*Math.sin(v.x*8+v.y*3)*Math.cos(v.z*7-v.y*5);v.multiplyScalar(rough);p.setXYZ(i,v.x,v.y,v.z);
    }
    rockGeo.computeVertexNormals();
    const stones=[],moss=[];
    // Interlocking stone columns cover the cliff faces all the way to the ground.
    for(let z=-60;z<=-29;z+=3.1)for(const side of [-1,1])for(let j=0;j<4;j++){
      const sx=1.4+random()*.45,sz=1.7+random()*.5;
      const x=cascadeCenter(z)+side*(cascadeHalfWidth(z)+sx+.35+j*2.5),rz=z+(random()-.5)*.6;
      const top=mountainHeight(x,rz)+.25;
      if(top<.8)continue;
      let upper=top+.3;
      while(upper>0){
        const sy=Math.min(upper/2+.2,1.6+random()*1.2);
        const stone={x:x+(random()-.5)*.25,y:upper-sy,z:rz,sx,sy,sz,angle:(random()-.5)*.3};stones.push(stone);
        if(upper>top-1&&random()>.35)moss.push({...stone,y:upper-.03,sx:sx*.88,sy:.12,sz:sz*.8});
        upper-=sy*1.7;
      }
    }
    // Low boulders frame the plunge pool, leaving its downstream outlet clear.
    for(let i=0;i<26;i++){
      const a=i/26*Math.PI*2,x=cascadeCenter(-29)+Math.cos(a)*6.1,z=-29+Math.sin(a)*4.4;
      if(z> -26&&Math.abs(x-riverCenter(z))<4.9)continue;
      stones.push({x,y:.2,z,sx:.65+random()*.65,sy:.45+random()*.6,sz:.65+random()*.65,angle:random()*6});
    }
    const rocks=new THREE.InstancedMesh(rockGeo,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,flatShading:true}),stones.length);
    const caps=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial({color:'#667b43',roughness:1}),moss.length);
    for(const [mesh,parts] of [[rocks,stones],[caps,moss]]){
      parts.forEach((r,i)=>{dummy.position.set(r.x,r.y,r.z);dummy.rotation.set(.03,r.angle,.025);dummy.scale.set(r.sx,r.sy,r.sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(mesh===rocks)mesh.setColorAt(i,new THREE.Color().setHSL(.46+random()*.04,.07+random()*.06,.43+random()*.14));});
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.root.add(mesh);
    }
    rocks.name='layered-cliff-boulders';caps.name='moss-on-rock-ledges';this.cliffRocks=rocks;
    const tufts=new THREE.InstancedMesh(new THREE.ConeGeometry(.18,.7,5),new THREE.MeshStandardMaterial({color:'#668144',roughness:1}),moss.length*4);
    moss.forEach((r,i)=>{for(let j=0;j<4;j++){dummy.position.set(r.x+(random()-.5)*r.sx,r.y+.27,r.z+(random()-.5)*r.sz);dummy.rotation.set((random()-.5)*.3,random()*6,(random()-.5)*.3);dummy.scale.setScalar(.55+random()*.65);dummy.updateMatrix();tufts.setMatrixAt(i*4+j,dummy.matrix);}});
    tufts.name='cliff-ferns-and-grasses';tufts.computeBoundingSphere();this.root.add(tufts);
  }
  waterMaterial(){
    return new THREE.ShaderMaterial({uniforms:{uTime:this.time},side:THREE.DoubleSide,
      vertexShader:`attribute float aCascade;varying vec2 vUv;varying vec3 vWorld;varying float vCascade;
        void main(){vUv=uv;vCascade=aCascade;vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}`,
      fragmentShader:`uniform float uTime;varying vec2 vUv;varying vec3 vWorld;varying float vCascade;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){
          float depth=pow(max(0.0,sin(vUv.x*3.14159)),.65);
          vec2 flow=vec2(vUv.x*9.0,vWorld.z*.75-uTime*(.65+vCascade*1.7));
          float n=noise(flow+noise(flow*.55));
          float threads=pow(noise(vec2(vUv.x*23.0,(vWorld.y+vWorld.z*.35)*2.5-uTime*3.8)),2.0);
          float ripples=sin(vWorld.z*5.6-uTime*3.0+sin(vWorld.x*2.4+uTime*.3)*1.3);
          float impact=exp(-pow((vWorld.z+32.6)/1.0,2.0))+exp(-pow((vWorld.z+44.2)/.8,2.0))+exp(-pow((vWorld.z+52.2)/.8,2.0));
          float shore=(1.0-smoothstep(0.0,.08,min(vUv.x,1.0-vUv.x)))*(.10+.13*n);
          float foam=clamp(vCascade*(.36+threads*.65)+impact*(.22+.5*n)+shore,0.0,.94);
          vec3 water=mix(vec3(.36,.55,.40),vec3(.12,.36,.34),depth);
          water+=vec3(.035,.055,.045)*(n-.5);
          float glimmer=pow(max(0.0,ripples),18.0)*smoothstep(.52,.85,n)*.16;
          water+=vec3(.68,.81,.72)*glimmer;
          gl_FragColor=vec4(mix(water,vec3(.88,.96,.92),foam),1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
  }
  buildWater(){
    const fallGeometry=surfaceGeometry(420,16,(v,u)=>{
      const z=-60+v*37.2,x=cascadeCenter(z)+(u-.5)*cascadeHalfWidth(z)*2;
      return[x,cascadeHeight(z),z];
    });
    const slopes=[];
    const pos=fallGeometry.attributes.position;
    for(let i=0;i<pos.count;i++){const z=pos.getZ(i);slopes.push(Math.min(1,Math.abs(cascadeHeight(z+.05)-cascadeHeight(z-.05))/.1));}
    fallGeometry.setAttribute('aCascade',new THREE.Float32BufferAttribute(slopes,1));
    this.fall=new THREE.Mesh(fallGeometry,this.waterMaterial());this.fall.name='summit-to-river-waterfall';this.root.add(this.fall);
    this.riverGarden=new RiverGarden(this.root,this.time);
    this.ripples=[];
    for(let i=0;i<5;i++){
      const ring=new THREE.Mesh(new THREE.RingGeometry(.88,1,48),new THREE.MeshBasicMaterial({color:'#d6ece2',transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}));
      ring.rotation.x=-Math.PI/2;ring.position.set(cascadeCenter(-30),.08+i*.002,-30);this.root.add(ring);this.ripples.push(ring);
    }
    // Soft circular droplets, instead of square sprites.
    const positions=new Float32Array(48*3);this.spray=new THREE.Points(new THREE.BufferGeometry(),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},
      vertexShader:'void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(14.0,55.0/max(1.0,-p.z));gl_Position=projectionMatrix*p;}',
      fragmentShader:'void main(){float a=1.0-smoothstep(.08,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.88,.97,.95,a*.32);}'
    }));this.spray.geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));this.spray.frustumCulled=false;this.root.add(this.spray);
  }
  update(time){
    this.time.value=time;this.riverGarden.update(time);
    this.ripples.forEach((ring,i)=>{const t=(time*.32+i/5)%1;ring.scale.set(1+t*2.8,.65+t*1.4,1);ring.material.opacity=(1-t)*.24;});
    const p=this.spray.geometry.attributes.position;
    for(let i=0;i<p.count;i++){const t=(time*.45+i/48)%1,a=i*2.39996;p.setXYZ(i,cascadeCenter(-32.8)+Math.cos(a)*t*1.6,.12+Math.sin(t*Math.PI)*1.25,-32.8+Math.sin(a)*t*1.4);}
    p.needsUpdate=true;
  }
}
