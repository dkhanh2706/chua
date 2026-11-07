import * as THREE from 'three';
import {seededRandom} from './garden-layout.mjs';
import {buildPondStonework} from './pond-stonework.mjs';

const TAU=Math.PI*2;
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.65,...extra});

// All motion uses elapsed time, so swimming and ripples keep the same pace at 30/60 fps.
export class LotusPond{
  constructor(parent,night={value:0}){
    this.root=new THREE.Group();this.root.name='living-lotus-pond';this.root.position.set(-29.6,0,10.1);parent.add(this.root);
    this.random=seededRandom(2841);this.time={value:0};this.night=night;this.pads=[];this.fish=[];this.ripples=[];
    this.sphere=new THREE.SphereGeometry(1,16,10);
    this.buildWater();this.buildLotuses();this.buildFish();this.buildRipples();this.update(0);
  }
  part(parent,geometry,mat,x,y,z,sx=1,sy=1,sz=1){
    const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
  }
  buildWater(){
    const size=128,pixels=new Uint8Array(size*size*4),deep=new THREE.Color('#247b9d'),shore=new THREE.Color('#80c9d5');
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const px=x/(size-1)*2-1,py=y/(size-1)*2-1,r=Math.min(1,Math.hypot(px,py));
      const c=deep.clone().lerp(shore,Math.pow(r,4)),grain=(Math.sin(x*.079+y*.053)+Math.sin(x*.033-y*.067))*.008;
      const i=(y*size+x)*4;pixels[i]=Math.round(THREE.MathUtils.clamp(c.r+grain,0,1)*255);pixels[i+1]=Math.round(THREE.MathUtils.clamp(c.g+grain,0,1)*255);pixels[i+2]=Math.round(THREE.MathUtils.clamp(c.b+grain,0,1)*255);pixels[i+3]=255;
    }
    const bedMap=new THREE.DataTexture(pixels,size,size);bedMap.colorSpace=THREE.LinearSRGBColorSpace;bedMap.magFilter=THREE.LinearFilter;bedMap.needsUpdate=true;
    const bed=this.part(this.root,new THREE.CircleGeometry(1,96),material('#ffffff',{map:bedMap,emissive:'#247b87',emissiveIntensity:0}),0,.012,0,13.4,8.6,1);bed.rotation.x=-Math.PI/2;bed.receiveShadow=true;this.bed=bed;
    const water=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:this.time,uNight:this.night},side:THREE.DoubleSide,
      vertexShader:`uniform float uTime;varying vec3 vWorld;varying vec2 vLocal;
        void main(){vec3 p=position;vLocal=p.xy;p.z+=sin(p.x*1.8+uTime*.8)*sin(p.y*2.1-uTime*.65)*.012;
        vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
      fragmentShader:`uniform float uTime;uniform float uNight;varying vec3 vWorld;varying vec2 vLocal;
        void main(){vec2 p=vWorld.xz;float t=uTime;
          float a=sin(p.x*1.35+p.y*.73-t*.66)+sin(p.x*3.1-p.y*1.2+t*.43)*.25;
          float b=sin(p.y*1.7-p.x*.56+t*.48)+sin(p.y*3.6+p.x*.9-t*.62)*.22;
          vec3 n=normalize(vec3(a*.038,1.,b*.033));vec3 view=normalize(cameraPosition-vWorld);
          float fresnel=pow(1.-max(dot(n,view),0.),3.);
          float edge=smoothstep(.72,1.,length(vLocal));
          vec3 color=mix(vec3(.025,.29,.46),vec3(.15,.59,.69),edge);
          vec3 reflected=reflect(-view,n);float cloud=sin(reflected.x*5.+sin(reflected.z*4.+t*.025))*.5+.5;
          vec3 sky=mix(vec3(.37,.64,.61),vec3(.74,.88,.94),smoothstep(.0,.8,reflected.y));sky+=cloud*.035;
          color=mix(color,sky,fresnel*.65);
          float glint=pow(max(0.,sin(p.x*2.1+p.y*.6-t*.8+sin(p.y*1.8)*.7)),28.);
          float sparkle=pow(max(dot(reflect(normalize(vec3(-.45,-1.,-.3)),n),view),0.),120.);
          color+=vec3(.73,.91,.90)*glint*.025+vec3(.97,.98,.90)*sparkle*.3;
          color*=mix(vec3(1.),vec3(.32,.46,.66),uNight);
          float underwaterGlow=exp(-dot(vLocal,vLocal)*1.8);
          color+=vec3(.035,.20,.22)*underwaterGlow*uNight;
          gl_FragColor=vec4(color,.20+fresnel*.30+edge*.07);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    // Circle vertices stay in unit space; the mesh scale shapes the elliptical shoreline.
    this.water=this.part(this.root,new THREE.CircleGeometry(1,96),water,0,.235,0,13.4,8.6,1);this.water.rotation.x=-Math.PI/2;this.water.name='shimmering-pond-water';
    buildPondStonework(this.root,window.POND_STEPS);
    const dummy=new THREE.Object3D();
    const pebbles=new THREE.InstancedMesh(this.sphere,material('#729b8f'),24);
    for(let i=0;i<24;i++){const a=this.random()*TAU,r=.82+this.random()*.12;dummy.position.set(Math.cos(a)*12.8*r,.025,Math.sin(a)*8*r);dummy.rotation.set(0,a,0);dummy.scale.set(.06+this.random()*.08,.012,.05+this.random()*.06);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);}pebbles.name='submerged-pond-pebbles';pebbles.computeBoundingSphere();this.root.add(pebbles);
  }
  padGeometry(){
    const shape=new THREE.Shape();shape.moveTo(.06,0);
    for(let i=0;i<=64;i++){const a=.15+i/64*(TAU-.3),r=1+Math.sin(a*7)*.025;shape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
    shape.lineTo(.06,0);shape.closePath();return new THREE.ShapeGeometry(shape,48);
  }
  buildLotuses(){
    const geometry=this.padGeometry(),greens=['#42875d','#539b64','#67aa6d'];
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
    const colors=['#e87b36','#f4efe1','#cf4e3c','#efba48','#f3e6ce','#ec9851','#edebe1','#c1ad6a'];
    const finShape=new THREE.Shape();finShape.moveTo(0,0);finShape.bezierCurveTo(-.16,.08,-.30,.30,-.57,.28);finShape.quadraticCurveTo(-.44,.08,-.43,0);finShape.quadraticCurveTo(-.44,-.08,-.57,-.28);finShape.bezierCurveTo(-.30,-.30,-.16,-.08,0,0);
    const finGeo=new THREE.ShapeGeometry(finShape);
    const rays=new THREE.BufferGeometry(),rayPoints=[];for(let j=0;j<7;j++)rayPoints.push(0,0,0,-.51,(j/6-.5)*.48,0);rays.setAttribute('position',new THREE.Float32BufferAttribute(rayPoints,3));
    const finMat=material('#f4d7b6',{side:THREE.DoubleSide,transparent:true,opacity:.83,depthWrite:false}),eyeMat=material('#263830',{roughness:.18}),bodyMat=material('#ffffff',{vertexColors:true,roughness:.37});
    colors.forEach((color,i)=>{
      const g=new THREE.Group();this.root.add(g);g.name=`pond-koi-${i}`;
      const geometry=new THREE.SphereGeometry(1,24,12),p=geometry.attributes.position,colors=[],base=new THREE.Color(color),cream=new THREE.Color('#fff3dc'),red=new THREE.Color(i%3?'#d55337':'#d18b38');
      for(let j=0;j<p.count;j++){
        const x=p.getX(j),z=p.getZ(j),patch=Math.sin(x*6.4+z*3.2+i*1.7)+.55*Math.sin(z*8.2-x*2.5+i);
        const c=patch>.4?(i%2?red:cream):base;colors.push(c.r,c.g,c.b);
      }
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));this.part(g,geometry,bodyMat,0,0,0,.73,.073,.23);
      const tail=new THREE.Group();tail.position.x=-.61;g.add(tail);
      const fin=this.part(tail,finGeo,finMat,0,0,0);fin.rotation.x=-Math.PI/2;
      const lines=new THREE.LineSegments(rays,new THREE.LineBasicMaterial({color:'#a68165',transparent:true,opacity:.33}));lines.rotation.x=-Math.PI/2;tail.add(lines);
      const fins=[];for(const side of [-1,1]){
        const f=this.part(g,this.sphere,finMat,.06,-.008,side*.22,.22,.014,.15);f.rotation.y=side*.55;fins.push(f);
        this.part(g,this.sphere,material('#f5ebd9'),.51,.047,side*.12,.043,.018,.038);
        this.part(g,this.sphere,eyeMat,.52,.06,side*.125,.025,.012,.022);
      }
      const dorsal=this.part(g,this.sphere,finMat,-.05,.067,0,.29,.016,.038);dorsal.rotation.x=.18;
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
    this.bed.material.emissiveIntensity=this.night.value*.55;
    this.time.value=time;
    this.pads.forEach(({g,id,phase})=>{
      g.position.y=id===null?.32+Math.sin(time*.8+phase)*.025:window.lotusHeight(id,time);
      if(id===null){g.rotation.x=Math.sin(time*.55+phase)*.018;g.rotation.z=Math.cos(time*.6+phase)*.018;}
    });
    this.fish.forEach((f,i)=>{
      const a=f.phase+time*f.speed,x=Math.cos(a)*f.rx,z=Math.sin(a)*f.rz;
      const dx=-Math.sin(a)*f.rx*f.speed,dz=Math.cos(a)*f.rz*f.speed;
      f.g.position.set(x,.12+Math.sin(time*.9+i)*.018,z);f.g.rotation.y=Math.atan2(-dz,dx);
      f.tail.rotation.y=Math.sin(time*3.1+i)*.32;f.g.rotation.z=Math.sin(time*1.2+i)*.008;f.fins.forEach((fin,j)=>fin.rotation.y=(j?1:-1)*(.55+Math.sin(time*2.1+i)*.17));
    });
    this.ripples.forEach(({ring,phase})=>{const age=(time*.14+phase)%1;ring.scale.setScalar(.15+age*1.7);ring.material.opacity=Math.sin(age*Math.PI)*.15;});
  }
}
