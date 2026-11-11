import * as THREE from 'three';

const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const FALL=.36,BOUNCE=.24,RISE=.6;

// Timeline of a broom knockdown: topple under gravity, bounce once on the
// paving, lie dazed, then push back up just before control returns.
export function knockdown(age,duration){
  if(!(duration>0)||!(age>=0)||age>=duration)return null;
  const fall=Math.min(1,age/FALL)**2;
  const bounce=age>FALL&&age<FALL+BOUNCE?Math.sin((age-FALL)/BOUNCE*Math.PI)*.07:0;
  const down=(fall-bounce)*(1-smooth((age-(duration-RISE))/RISE));
  return{down,tilt:down*1.48,dazed:age>FALL&&age<duration-RISE*.5};
}

// Tip the whole avatar over its feet, away from the blow, with limbs flung out.
// `direction` is the world heading the blow travelled in; `yaw` the avatar's own.
export function applyKnockdown(model,state,direction,yaw,holdsBroom){
  const relative=direction-yaw,{down}=state;
  const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(relative),0,-Math.sin(relative)),state.tilt);
  model.root.quaternion.multiply(tilt);
  // Lying flat would sink half the body into the paving; slide back a little too.
  model.root.position.x+=Math.sin(direction)*.45*down;model.root.position.z+=Math.cos(direction)*.45*down;
  model.root.position.y+=Math.sin(state.tilt)*.17;
  model.arms.forEach((arm,i)=>{
    if(i===0&&holdsBroom)return;
    const side=i===0?-1:1;
    arm.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.35,0,side*1.35)),down);
    model.elbows[i].quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.55,0,0)),down);
  });
  model.legs.forEach((leg,i)=>{
    const side=i===0?-1:1;
    leg.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.18-.1*side,0,side*.2)),down);
    model.knees[i].quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(.35+.2*side,0,0)),down);
  });
  model.head.rotation.x-=.22*down;
  model.shadow.visible=down<.15;
  // Keep the name floating above the fallen body rather than lying with it.
  const height=model.label.position.y;
  model.label.position.set(0,THREE.MathUtils.lerp(height,1.25,down),0).applyQuaternion(tilt.invert());model.label.position.y+=.85*down;
}

const starGeometry=new THREE.OctahedronGeometry(.075),starMaterial=new THREE.MeshBasicMaterial({color:'#ffd95e'});
// Little stars circling a dazed head.
export function createDizzyStars(parent){
  const stars=new THREE.Group();stars.name='dizzy-stars';stars.visible=false;
  for(let i=0;i<3;i++)stars.add(new THREE.Mesh(starGeometry,starMaterial));
  parent.add(stars);return stars;
}
export function updateDizzyStars(stars,head,time){
  head.getWorldPosition(stars.position);stars.position.y+=.55;
  stars.children.forEach((star,i)=>{const a=time*5+i*Math.PI*2/3;star.position.set(Math.cos(a)*.3,Math.sin(time*7+i)*.04,Math.sin(a)*.3);star.rotation.set(time*4,time*6,0);});
}

const chipGeometry=new THREE.BoxGeometry(.03,.03,.14);
const chipMaterials=['#e3c877','#b99a52','#fff6d8'].map(color=>new THREE.MeshBasicMaterial({color,transparent:true}));
// A burst of broom straw and dust where the bristles land.
export class HitBursts{
  constructor(parent){this.root=new THREE.Group();this.root.name='broom-hit-bursts';parent.add(this.root);this.chips=[];}
  burst(position,direction,time){
    for(let i=0;i<12;i++){
      const chip=new THREE.Mesh(chipGeometry,chipMaterials[i%3].clone()),a=i/12*Math.PI*2,spread=.6+((i*7)%5)*.25;
      chip.position.copy(position);
      chip.userData={start:time,velocity:new THREE.Vector3(Math.sin(direction)*1.6+Math.cos(a)*spread,1.4+((i*5)%4)*.5,Math.cos(direction)*1.6+Math.sin(a)*spread),spin:a};
      this.root.add(chip);this.chips.push(chip);
    }
  }
  update(time,dt){
    this.chips=this.chips.filter(chip=>{
      const age=time-chip.userData.start;
      if(age>.5){chip.material.dispose();chip.removeFromParent();return false;}
      chip.userData.velocity.y-=7*dt;chip.position.addScaledVector(chip.userData.velocity,dt);
      chip.rotation.set(age*9+chip.userData.spin,age*7,chip.userData.spin);chip.material.opacity=1-age/.5;
      return true;
    });
  }
}
