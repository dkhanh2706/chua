import * as THREE from 'three';
import {addNightLight,addLightPool} from './night-lights.mjs';

export class IncenseCart{
  constructor(parent,layout){
    this.root=new THREE.Group();this.root.name='jerry-incense-cart';
    this.root.position.set((layout.x-500)/10,0,(layout.y-350)/10);this.root.rotation.y=layout.heading??0;this.root.scale.setScalar(.86);parent.add(this.root);
    this.materials=new Map();this.cube=new THREE.BoxGeometry(1,1,1);this.sphere=new THREE.SphereGeometry(1,24,16);
    this.buildCart();this.buildJerry();
    addNightLight(this.root,0,3.3,1.5,8,10);addLightPool(this.root,0,.035,1.6,3.8);
  }
  material(color){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.75}));return this.materials.get(color);}
  part(parent,geometry,color,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,this.material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  box(p,x,y,z,w,h,d,c){return this.part(p,this.cube,c,x,y,z,w,h,d);}
  ball(p,x,y,z,w,h,d,c){return this.part(p,this.sphere,c,x,y,z,w,h,d);}
  tube(p,points,radius,color){return this.part(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),24,radius,6,false),color,0,0,0);}
  sign(text,width,height,color,background){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
    const c=canvas.getContext('2d');c.fillStyle=background;c.fillRect(0,0,1024,256);
    c.strokeStyle='#d3b273';c.lineWidth=7;c.strokeRect(15,15,994,226);
    c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font='600 103px Arial';c.fillText(text,512,136,950);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map:texture,roughness:.8}));sign.name='incense-cart-sign';return sign;
  }
  buildCart(){
    const r=this.root,wood='#96704a',dark='#634933',cream='#eee0bc',green='#65775a',gold='#bc9451';
    this.box(r,0,.72,0,4.65,.2,2.05,dark);
    this.box(r,0,1.22,.1,4.45,.88,1.8,wood);
    for(const x of [-1.75,-.88,0,.88,1.75])this.box(r,x,1.23,1.015,.025,.72,.025,dark);
    this.box(r,0,1.78,.1,4.9,.18,2.35,cream);
    this.box(r,0,.83,1.04,4.5,.12,.12,dark);
    for(const x of [-2.35,2.35])for(const z of [-.62,.62]){
      const wheel=this.part(r,new THREE.CylinderGeometry(.38,.38,.16,24),'#3e463a',x,.39,z);wheel.rotation.z=Math.PI/2;
      const hub=this.part(r,new THREE.CylinderGeometry(.15,.15,.18,16),gold,x,.39,z);hub.rotation.z=Math.PI/2;
    }
    for(const x of [-2.16,2.16])for(const z of [-.82,.82])this.box(r,x,2.62,z,.095,1.76,.095,dark);
    // A gently pitched striped awning leaves Jerry's face visible from the path.
    const awning=new THREE.Group();awning.name='striped-incense-cart-awning';awning.position.y=3.55;r.add(awning);
    for(let i=0;i<10;i++){
      const x=-2.25+i*.5,c=i%2?cream:green;
      const front=this.box(awning,x,.06,.62,.5,.08,1.4,c);front.rotation.x=.14;
      const rear=this.box(awning,x,.06,-.62,.5,.08,1.4,c);rear.rotation.x=-.14;
      this.box(awning,x,-.18,1.29,.5,.3,.06,c);
    }
    this.box(r,0,3.82,0,3.9,.64,.16,dark);
    for(const side of [-1,1]){const sign=this.sign('BÁN NHANG',3.72,.58,'#f8e7b4','#425a43');sign.position.set(0,3.82,side*.09);sign.rotation.y=side===1?0:Math.PI;r.add(sign);}
    const name=this.sign('JERRY',1.13,.33,'#f6e5b8','#765537');name.position.set(0,1.25,1.025);r.add(name);
    // Display bundles in little pots, with their unlit tips facing upwards.
    for(const x of [-1.68,1.62]){
      this.part(r,new THREE.CylinderGeometry(.25,.21,.35,16),green,x,2.02,.45);
      for(let i=0;i<9;i++){
        const a=i*2.4,px=x+Math.cos(a)*.14,pz=.45+Math.sin(a)*.14;
        this.part(r,new THREE.CylinderGeometry(.014,.014,.74,6),'#bd7955',px,2.43,pz);
        this.part(r,new THREE.CylinderGeometry(.015,.015,.11,6),'#594638',px,2.84,pz);
      }
    }
    this.box(r,-1.05,1.92,.76,.72,.1,.48,gold);
    for(let i=0;i<6;i++){
      const stick=this.part(r,new THREE.CylinderGeometry(.016,.016,.63,6),'#b97b54',-1.05,1.99+i*.016,.63+i*.045);stick.rotation.z=Math.PI/2;
    }
    const lamp=this.ball(r,0,3.24,.7,.1,.13,.1,'#f4d392');lamp.material=lamp.material.clone();lamp.material.emissive=new THREE.Color('#ffce83');lamp.material.userData.nightEmission=1.4;
    // Wrapped bundles ready to sell, and a paper lantern at each front corner.
    for(let i=0;i<3;i++){
      const bundle=this.part(r,new THREE.CylinderGeometry(.075,.075,.7,10),'#a9503a',1.02+(i%2)*.05,1.95+(i===2?.13:0),.62+(i===2?.07:i*.16));bundle.rotation.z=Math.PI/2;
      const band=this.part(r,new THREE.CylinderGeometry(.08,.08,.13,10),gold,bundle.position.x,bundle.position.y,bundle.position.z);band.rotation.z=Math.PI/2;
    }
    const paper=this.material('#c9483a').clone();paper.emissive=new THREE.Color('#ff7a45');paper.emissiveIntensity=0;paper.userData.nightEmission=1.1;
    for(const x of [-2.05,2.05]){
      this.box(r,x,3.2,1.22,.018,.3,.018,dark);
      const lantern=this.ball(r,x,2.9,1.22,.17,.2,.17,'#c9483a');lantern.material=paper;lantern.name='incense-cart-lantern';
      for(const y of [3.08,2.72])this.part(r,new THREE.CylinderGeometry(.09,.09,.05,12),gold,x,y,1.22);
      this.box(r,x,2.6,1.22,.03,.2,.03,gold);
    }
  }
  buildJerry(){
    const j=new THREE.Group();j.name='jerry-incense-seller';j.position.set(0,.32,-.22);j.scale.setScalar(.85);this.root.add(j);this.jerry=j;
    const fur='#c88c2c',belly='#f1cc85',pink='#df9e8d',ink='#38251c',white='#fff4d8';
    this.tube(j,[[.3,1.28,-.12],[.85,1.16,-.45],[1.28,1.3,-.35],[1.56,1.18,-.26]],.055,fur);
    for(const side of [-1,1]){
      this.ball(j,side*.24,1.16,.12,.28,.13,.36,fur);
      this.ball(j,side*.2,1.43,0,.17,.35,.19,fur);
    }
    this.ball(j,0,1.97,0,.42,.66,.33,fur);this.ball(j,0,1.96,.285,.28,.48,.075,belly);
    this.head=new THREE.Group();this.head.name='jerry-face';this.head.position.set(0,2.92,0);j.add(this.head);
    for(const side of [-1,1]){
      const ear=this.ball(this.head,side*.5,.45,-.07,.33,.37,.13,fur);ear.rotation.z=-side*.22;
      const inner=this.ball(this.head,side*.505,.45,.045,.24,.27,.04,pink);inner.rotation.z=-side*.22;
    }
    this.ball(this.head,0,0,.06,.55,.62,.43,fur);
    this.ball(this.head,0,-.29,.4,.29,.23,.105,ink);
    this.ball(this.head,0,-.39,.49,.13,.07,.025,'#e69c8b');
    for(const side of [-1,1]){
      const eye=this.ball(this.head,side*.19,.13,.43,.15,.32,.085,white);eye.rotation.z=-side*.12;
      this.ball(this.head,side*.19-.025,.1,.505,.064,.16,.037,ink);
      this.ball(this.head,side*.19-.042,.17,.535,.023,.045,.015,'#ffffff');
      this.ball(this.head,side*.17,-.22,.49,.25,.17,.18,belly);
      this.box(this.head,side*.047,-.32,.516,.087,.12,.04,white);
      this.tube(this.head,[[side*.09,.51,.25],[side*.22,.56,.25],[side*.34,.49,.23]],.016,ink);
      for(let i=0;i<3;i++)this.tube(this.head,[[side*.27,-.19,.61],[side*.5,-.17+i*.06,.62],[side*.7,-.22+i*.1,.57]],.009,ink);
    }
    this.ball(this.head,0,-.16,.66,.14,.085,.09,ink);
    this.tube(this.head,[[-.13,.49,-.02],[-.23,.72,-.04],[-.13,.8,-.05]],.036,fur);
    // A red neckerchief keeps the little shopkeeper neat.
    const scarf=this.part(j,new THREE.TorusGeometry(.3,.075,10,28),'#b8443a',0,2.5,.02);scarf.rotation.x=Math.PI/2;
    this.ball(j,.05,2.42,.33,.1,.09,.06,'#b8443a');this.ball(j,.12,2.3,.34,.06,.12,.04,'#b8443a');
    this.arms=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.32,2.28,.03);j.add(arm);
      this.tube(arm,[[0,0,0],[side*.26,-.22,.17],[side*.38,-.37,.55]],.105,fur);
      this.ball(arm,side*.4,-.37,.58,.18,.1,.15,fur);
      for(let i=0;i<3;i++)this.ball(arm,side*(.29+i*.08),-.36,.69,.055,.055,.1,fur);
      this.arms.push(arm);
    }
  }
  update(time){
    this.head.rotation.y=Math.sin(time*.45)*.08;this.head.rotation.z=Math.sin(time*.6)*.022;
    this.arms[1].rotation.z=Math.sin(time*.8)*.035;
  }
}
