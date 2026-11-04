import * as THREE from 'three';
import {makeTreeLayout,seededRandom} from './garden-layout.mjs';
import {RiverGarden,riverCenter} from './river-garden.mjs';

const channelCenter=z=>z>=-23?riverCenter(z):28.4+2.7*Math.sin(Math.min(1,Math.max(0,(z+48)/25))*Math.PI/2);

// One continuous surface, including the eroded channel under the water.
export function mountainHeight(x,z){
  const r=Math.hypot((x-28.4)/18,(z+48)/26);
  if(r>=1)return -.12;
  const envelope=Math.pow(1-r*r,1.65);
  const angle=Math.atan2((z+48)/26,(x-28.4)/18);
  const ridges=(Math.sin(angle*9+r*8)*1.3+Math.sin(x*.73+z*.31)*.7+Math.sin(z*.83-x*.26)*.45)*Math.min(1,r*5);
  const erosion=z>-49?1.15*Math.exp(-(((x-channelCenter(z))/2.1)**2))*Math.sin(Math.min(1,(z+49)/27)*Math.PI):0;
  return Math.max(-.12,28*envelope+ridges*envelope-erosion-.12);
}

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
      if(x>-20&&x<20&&z<-5)continue;
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
    const geometry=surfaceGeometry(180,130,(v,u)=>{const x=9+u*39,z=-75+v*54;return[x,mountainHeight(x,z),z];});
    // Trim the footprint to the mountain, avoiding a rectangular skirt in the sky.
    const terrainIndices=geometry.index.array,trimmed=[];
    for(let i=0;i<terrainIndices.length;i+=3){
      const triangle=[terrainIndices[i],terrainIndices[i+1],terrainIndices[i+2]];
      if(triangle.some(j=>geometry.attributes.position.getY(j)>0))trimmed.push(...triangle);
    }
    geometry.setIndex(trimmed);
    const colors=[],p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),wet=z>-49&&Math.abs(x-channelCenter(z))<3;
      const color=new THREE.Color(wet?'#596b60':y>19?'#a2a28b':'#7d8d70');
      color.multiplyScalar(.93+.1*Math.sin(x*1.8+z*.9));colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const stoneMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});
    stoneMaterial.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRockPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRockPosition=position;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRockPosition;').replace('#include <color_fragment>',`#include <color_fragment>
        float grain=sin(vRockPosition.x*17.0+sin(vRockPosition.z*19.0))*sin(vRockPosition.y*23.0+vRockPosition.z*11.0);
        float strata=sin(vRockPosition.y*5.0+sin(vRockPosition.x*.7)+sin(vRockPosition.z*.9));
        diffuseColor.rgb*=.96+grain*.035+strata*.045;
      `);
    };
    this.mountain=new THREE.Mesh(geometry,stoneMaterial);
    this.mountain.name='continuous-eroded-mountain';this.mountain.castShadow=true;this.mountain.receiveShadow=true;this.root.add(this.mountain);
    const random=seededRandom(417),rockGeo=new THREE.IcosahedronGeometry(1,1),rockMat=new THREE.MeshStandardMaterial({color:'#88917b',roughness:1});
    const rocks=new THREE.InstancedMesh(rockGeo,rockMat,65),dummy=new THREE.Object3D();
    for(let i=0;i<65;i++){
      const z=-47+random()*25,side=i%2?1:-1,x=channelCenter(z)+side*(3.2+random()*7),y=mountainHeight(x,z);
      dummy.position.set(x,y-.35,z);dummy.rotation.set(random(),random()*6,random());dummy.scale.set(.45+random()*.85,.35+random()*.55,.45+random()*.75);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
    }
    rocks.name='weathered-slope-rocks';rocks.castShadow=true;rocks.receiveShadow=true;rocks.computeBoundingSphere();this.root.add(rocks);
  }
  waterMaterial(fall=false){
    return new THREE.ShaderMaterial({uniforms:{uTime:this.time,uFall:{value:fall?1:0}},side:THREE.DoubleSide,
      vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float uTime;uniform float uFall;varying vec2 vUv;
        void main(){
          float edge=smoothstep(0.0,.10,vUv.x)*smoothstep(0.0,.10,1.0-vUv.x);
          float thread=sin(vUv.x*115.0+sin(vUv.y*23.0-uTime*2.0)*1.3)*.5+.5;
          float wave=sin(vUv.y*(190.0+uFall*95.0)-uTime*(4.0+uFall*9.0)+sin(vUv.x*43.0)*.35)* .5+.5;
          float foam=pow(wave,18.0)*(.045+uFall*.28)+pow(thread,9.0)*uFall*.26+(1.0-edge)*.12;
          vec3 base=mix(vec3(.25,.53,.52),vec3(.57,.77,.77),uFall*.7);
          gl_FragColor=vec4(mix(base,vec3(.90,.96,.91),clamp(foam,0.0,.85)),1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
  }
  buildWater(){
    // Water samples the mountain itself, so there are no detached sheets or gaps.
    const fallGeometry=surfaceGeometry(240,12,(v,u)=>{
      const z=-48+v*26,x=channelCenter(z)+(u-.5)*(.85+3.9*Math.pow(v,.7));
      const height=mountainHeight(x,z);
      return[x,Math.max(.065,height+.13+.1*Math.min(1,Math.max(0,height))),z];
    });
    this.fall=new THREE.Mesh(fallGeometry,this.waterMaterial(true));this.fall.name='summit-to-river-waterfall';this.root.add(this.fall);
    this.riverGarden=new RiverGarden(this.root,this.time);
    this.ripples=[];
    for(let i=0;i<5;i++){
      const ring=new THREE.Mesh(new THREE.RingGeometry(.88,1,48),new THREE.MeshBasicMaterial({color:'#d6ece2',transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}));
      ring.rotation.x=-Math.PI/2;ring.position.set(riverCenter(-22),.08+i*.002,-22);this.root.add(ring);this.ripples.push(ring);
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
    for(let i=0;i<p.count;i++){const t=(time*.45+i/48)%1,a=i*2.39996;p.setXYZ(i,riverCenter(-22)+Math.cos(a)*t*2.3,.12+Math.sin(t*Math.PI)*1.25,-22+Math.sin(a)*t*1.5);}
    p.needsUpdate=true;
  }
}
