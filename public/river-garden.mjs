import * as THREE from 'three';
import {seededRandom} from './garden-layout.mjs';
import {GARDEN_BOUNDS} from './garden-boundary.mjs';
import {streamCenter,riverHalfWidth as halfWidth,RIVER_START_Z} from './waterfall-layout.mjs';
import {addNightLight} from './night-lights.mjs';
import {flowingWaterMaterial} from './flowing-water.mjs';

export const riverCenter=streamCenter;
const BRIDGE_Z=15.5,SPAN=6.6,RIVER_LENGTH=GARDEN_BOUNDS.front+.4-RIVER_START_Z;

function strip(rows,columns,point){
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
    positions.push(...point(i/rows,j/columns));uv.push(j/columns,i/rows);
    if(i<rows&&j<columns){const a=i*(columns+1)+j,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aCascade',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3),1));g.setIndex(indices);g.computeVertexNormals();return g;
}

export class RiverGarden{
  constructor(parent,time,night={value:0}){
    this.root=new THREE.Group();this.root.name='river-and-arched-bridge';parent.add(this.root);this.time=time;this.night=night;
    this.random=seededRandom(5842);this.dummy=new THREE.Object3D();this.buildTerrain();this.buildRiver();this.buildBanks();this.buildBridge();this.buildFish();
  }
  buildTerrain(){
    const {left,right,rear,front}=GARDEN_BOUNDS;
    const grass=new THREE.MeshStandardMaterial({color:'#83ac76',roughness:1});
    const upper=new THREE.Mesh(new THREE.PlaneGeometry(right-left+1.2,19),grass);upper.rotation.x=-Math.PI/2;upper.position.set(0,-.025,-33.5);upper.receiveShadow=true;this.root.add(upper);
    for(const side of [-1,1]){
      const shape=new THREE.Shape(),edge=side<0?left-.6:right+.6;
      shape.moveTo(edge,-24);shape.lineTo(riverCenter(-24)+side*halfWidth(-24),-24);
      for(let z=-24;z<=front+.61;z+=.25)shape.lineTo(riverCenter(z)+side*halfWidth(z),z);
      shape.lineTo(edge,front+.6);shape.closePath();
      const land=new THREE.Mesh(new THREE.ShapeGeometry(shape),grass);land.rotation.x=Math.PI/2;land.position.y=-.025;land.material.side=THREE.DoubleSide;land.receiveShadow=true;land.name='recessed-river-terrain';this.root.add(land);
    }
    // Extend beneath the opaque plunge pool so oblique views cannot expose the
    // submerged bed's upstream edge at the surface junction.
    const bed=new THREE.Mesh(strip(180,12,(v,u)=>{const z=-24+v*(GARDEN_BOUNDS.front+.8+24);return[riverCenter(z)+(u-.5)*halfWidth(z)*2,-.34,z];}),flowingWaterMaterial(this.time,this.night));
    bed.name='blue-riverbed';this.root.add(bed);
  }
  buildRiver(){
    const geometry=strip(180,12,(v,u)=>{const z=RIVER_START_Z+v*RIVER_LENGTH;return[riverCenter(z)+(u-.5)*halfWidth(z)*2,.055,z];});
    const material=flowingWaterMaterial(this.time,this.night,{opacity:.64,waves:true});
    this.water=new THREE.Mesh(geometry,material);this.water.name='connected-river';this.root.add(this.water);
    this.drift=[];const count=38;
    this.glints=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:'#d8e9d4',transparent:true,opacity:.19,depthWrite:false,side:THREE.DoubleSide}),count);
    this.glints.name='downstream-flow-glints';this.glints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.glints.frustumCulled=false;this.root.add(this.glints);
    for(let i=0;i<count;i++)this.drift.push({offset:this.random()*RIVER_LENGTH,side:(this.random()-.5)*5.4,length:.24+this.random()*.6,speed:.65+this.random()*.35});
  }
  buildBanks(){
    const random=seededRandom(1864),dummy=this.dummy,stones=[],leaves=[],moss=[];
    this.banks=new THREE.Group();this.banks.name='natural-riverbanks';this.root.add(this.banks);
    for(const side of [-1,1]){
      // A low, continuous shore fits inside the existing paving clearance.
      const bankGeo=strip(200,12,(v,u)=>{
        const z=-24+v*(GARDEN_BOUNDS.front+.4+24),inset=.24+.035*Math.sin(z*.81+side),spread=inset+.88;
        const rise=THREE.MathUtils.smoothstep(u,0,inset/spread*1.34),settle=THREE.MathUtils.smoothstep(u,.48,1);
        const contour=.007*Math.sin(z*.63+side)*Math.sin(u*Math.PI);
        return[riverCenter(z)+side*(halfWidth(z)-inset+u*spread),-.1+.185*rise-.063*settle+contour,z];
      });
      const colors=[],wet=new THREE.Color('#667d77'),sand=new THREE.Color('#bbbaa0'),green=new THREE.Color('#83ac76');
      const uv=bankGeo.attributes.uv,positions=bankGeo.attributes.position;
      for(let i=0;i<uv.count;i++){
        const u=uv.getX(i),z=positions.getZ(i),t=THREE.MathUtils.smoothstep(u,.35,.95);
        const color=wet.clone().lerp(sand,THREE.MathUtils.smoothstep(u,.12,.4)).lerp(green,t);
        color.multiplyScalar(1+.025*Math.sin(z*2.3+u*21));colors.push(color.r,color.g,color.b);
      }
      bankGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      const bank=new THREE.Mesh(bankGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
      bank.name='soft-graded-shore';bank.receiveShadow=true;this.banks.add(bank);
      // Small, separated pockets of river pebbles leave stretches of open bank.
      for(let z=-23.4+(side+1)*.8;z<GARDEN_BOUNDS.front-1;z+=2.4+random()*2.1){
        if(Math.abs(z-BRIDGE_Z)<3.7)continue;
        const pocketZ=z+(random()-.5)*.5,count=4+Math.floor(random()*5);
        for(let j=0;j<count;j++){
          const pz=pocketZ+(random()-.5)*1.25,size=.07+random()*.15;
          const offset=-.06+random()*.55;
          stones.push({x:riverCenter(pz)+side*(halfWidth(pz)+offset),y:.055+random()*.01,z:pz,sx:size*(1+random()*.5),sy:size*.48,sz:size*(.8+random()*.5)});
        }
        if(random()>.55){
          const pz=pocketZ-.25;
          stones.push({x:riverCenter(pz)+side*(halfWidth(pz)+.39),y:.035,z:pz,sx:.32+random()*.1,sy:.15+random()*.035,sz:.27+random()*.13});
        }
        const plantZ=pocketZ+.55,plantX=riverCenter(plantZ)+side*(halfWidth(plantZ)+.65);
        const leafCount=5+Math.floor(random()*4),plantSize=.8+random()*.4,turn=random()*Math.PI*2;
        for(let j=0;j<leafCount;j++){
          const angle=turn+j*Math.PI*2/leafCount+random()*.4;
          leaves.push({x:plantX+(random()-.5)*.13,z:plantZ+(random()-.5)*.16,angle,width:(.075+random()*.035)*plantSize,height:(.7+random()*.45)*plantSize,length:(.26+random()*.16)*plantSize});
        }
        for(let j=0;j<3;j++){
          const pz=pocketZ+(random()-.5)*1.3;
          moss.push({x:riverCenter(pz)+side*(halfWidth(pz)+.65+random()*.1),z:pz,size:.12+random()*.13});
        }
      }
    }
    const geo=new THREE.SphereGeometry(1,12,8),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+.07*Math.sin(x*5+z*3)*Math.cos(y*4-z*2);
      p.setXYZ(i,x*r,y*r,z*r);
    }
    geo.computeVertexNormals();
    this.rocks=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.96}),stones.length);this.rocks.name='smooth-river-pebble-pockets';
    const pebbleColors=['#a5aaa2','#b8b6a6','#8b9b98','#c6c3b1','#94a39f'];
    stones.forEach((stone,i)=>{dummy.position.set(stone.x,stone.y,stone.z);dummy.rotation.set(random()*.15,random()*Math.PI*2,random()*.12);dummy.scale.set(stone.sx,stone.sy,stone.sz);dummy.updateMatrix();this.rocks.setMatrixAt(i,dummy.matrix);this.rocks.setColorAt(i,new THREE.Color(pebbleColors[i%pebbleColors.length]));});
    this.rocks.castShadow=true;this.rocks.receiveShadow=true;this.rocks.computeBoundingSphere();this.banks.add(this.rocks);
    // Rounded, cupped leaves form low rosettes rather than tall angular blades.
    const leafGeo=strip(10,4,(v,u)=>[(u*2-1)*Math.sin(Math.PI*v),Math.sin(Math.PI*v)*.17+(1-Math.cos(v*Math.PI))*.035-Math.abs(u*2-1)*.025,v]);
    const plants=new THREE.InstancedMesh(leafGeo,new THREE.MeshStandardMaterial({color:'#ffffff',side:THREE.DoubleSide,roughness:.88}),leaves.length);
    const leafColors=['#668c68','#7c9e72','#91ac80'];
    leaves.forEach((leaf,i)=>{dummy.position.set(leaf.x,.065,leaf.z);dummy.rotation.set(-.18,leaf.angle,0);dummy.scale.set(leaf.width,leaf.height,leaf.length);dummy.updateMatrix();plants.setMatrixAt(i,dummy.matrix);plants.setColorAt(i,new THREE.Color(leafColors[i%3]));});
    plants.name='low-riverside-leaf-rosettes';plants.castShadow=true;plants.receiveShadow=true;plants.computeBoundingSphere();this.banks.add(plants);
    const groundcover=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:'#729169',roughness:1}),moss.length);
    moss.forEach((patch,i)=>{dummy.position.set(patch.x,.065,patch.z);dummy.rotation.set(0,random()*Math.PI,0);dummy.scale.set(patch.size,.045,patch.size*.75);dummy.updateMatrix();groundcover.setMatrixAt(i,dummy.matrix);});
    groundcover.name='riverside-moss-cushions';groundcover.receiveShadow=true;groundcover.computeBoundingSphere();this.banks.add(groundcover);
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
      const z=RIVER_START_Z+(d.offset+time*d.speed)%RIVER_LENGTH,x=riverCenter(z)+d.side+Math.sin(z*.5+i)*.08;
      this.dummy.position.set(x,.082,z);this.dummy.rotation.set(-Math.PI/2,0,Math.sin(z*.3)*.12);this.dummy.scale.set(.018,d.length,1);this.dummy.updateMatrix();this.glints.setMatrixAt(i,this.dummy.matrix);
    });this.glints.instanceMatrix.needsUpdate=true;
  }
}
