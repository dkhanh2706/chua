import * as THREE from 'three';

// The avatar faces local +Z, so its anatomical right hand is on local -X.
export const RIGHT_HAND=0;
// A carried broom is 60% of the rack model. The hand closes round the top of
// the handle, leaving only a short stub above the fist.
export const BROOM_SCALE=.6;
export const BROOM_GRIP=2.08*BROOM_SCALE;
const down=new THREE.Vector3(0,-1,0);
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const easeIn=t=>t**1.7,easeOut=t=>1-(1-t)**1.7,liftIn=t=>t**1.4,liftOut=t=>1-(1-t)**1.4;

// Orient the broom so its bristles point along `direction` while the flat fan
// stays square to the avatar. Unlike a shortest-arc rotation this has no flip
// when the broom passes overhead.
export function broomQuaternion(direction){
  const y=direction.clone().normalize().negate(),x=new THREE.Vector3(1,0,0);
  x.addScaledVector(y,-x.dot(y)).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,x.clone().cross(y)));
}

// One overhead blow, in the upright hip frame: lift the broom out to the
// right, cock it back over the shoulder, whip it down so the bristles land in
// front at the 360 ms hit time (HIT_CONTACT), then let the weight carry through to the left.
const pose=(t,ease,hand,direction,twist,lean)=>({t,ease,hand:hand&&new THREE.Vector3(...hand),quaternion:direction&&broomQuaternion(new THREE.Vector3(...direction)),twist,lean});
const STRIKE=[
  pose(0),
  pose(.12,liftIn,[-.46,.74,.22],[-.8,.12,.58],-.16,-.03),
  pose(.22,liftOut,[-.38,1.1,-.04],[-.3,.86,-.42],-.42,-.1),
  pose(.36,easeIn,[-.14,.72,.52],[.02,-.12,.99],.26,.26),
  pose(.50,easeOut,[.06,.44,.42],[.45,-.7,.55],.42,.32),
  pose(.76,smooth),
];

export function broomStrike(time,start){
  const age=time-(start??-100);if(age<0||age>=STRIKE.at(-1).t)return null;
  const index=STRIKE.findIndex(key=>age<key.t),from=STRIKE[index-1],to=STRIKE[index];
  return{age,from,to,progress:to.ease((age-from.t)/(to.t-from.t))};
}

// Blend the two neighbouring key poses; the first and last are the carried pose.
export function strikePose(strike,rest){
  const a=strike.from.hand?strike.from:rest,b=strike.to.hand?strike.to:rest,t=strike.progress;
  return{
    hand:a.hand.clone().lerp(b.hand,t),
    quaternion:a.quaternion.clone().slerp(b.quaternion,t),
    twist:THREE.MathUtils.lerp(a.twist,b.twist,t),
    lean:THREE.MathUtils.lerp(a.lean,b.lean,t),
  };
}

export const armLengths=model=>[model.rig?.armUpper??.34,model.rig?.armLower??.29];
// Keep a body-local hand target inside the arm's reach.
export function reachable(model,target){
  const [upper,lower]=armLengths(model),shoulder=model.arms[RIGHT_HAND].position,delta=target.clone().sub(shoulder);
  return shoulder.clone().addScaledVector(delta.clone().normalize(),THREE.MathUtils.clamp(delta.length(),Math.abs(upper-lower)+.005,upper+lower-.005));
}

export function solveRightArm(model,target){
  const arm=model.arms[RIGHT_HAND],elbow=model.elbows[RIGHT_HAND];
  const [upperLength,lowerLength]=armLengths(model);
  target=reachable(model,target);
  const shoulder=arm.position,delta=target.clone().sub(shoulder),distance=delta.length(),axis=delta.normalize();
  const along=(upperLength**2-lowerLength**2+distance**2)/(2*distance);
  const pole=new THREE.Vector3(-1,-.3,.1);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const joint=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,upperLength**2-along**2)));
  const upper=new THREE.Quaternion().setFromUnitVectors(down,joint.clone().sub(shoulder).normalize());
  const lower=new THREE.Quaternion().setFromUnitVectors(down,target.sub(joint).normalize());
  arm.quaternion.copy(upper);
  elbow.quaternion.copy(upper.clone().invert().multiply(lower));
}

export function applyBroomPose(model,player,time){
  const age=time-(player.sweepStart??-100),sweeping=age>=0&&age<.9,phase=THREE.MathUtils.clamp(age/.9,0,1);
  // Ease into ground contact, sweep once, then bring the broom back to the side.
  const contact=sweeping?smooth(phase/.15)*(1-smooth((phase-.62)/.38)):0;
  const sweepAngle=THREE.MathUtils.lerp(-.95,.75,smooth((phase-.15)/.47));
  const strike=broomStrike(time,player.hitStart),hipDrop=(model.rig?.hipHeight??.72)-.72;
  // Carried like a staff: the fist at chest height, the bristles resting ahead
  // and to the right. They lift clear of the paving while the avatar walks.
  const hand=new THREE.Vector3(-.40,.47,.24).lerp(new THREE.Vector3(-.26+Math.sin(sweepAngle)*.13,.45,.28),contact);
  const bearing=THREE.MathUtils.lerp(-.52,sweepAngle,contact);
  const clearance=.045+.12*(model.motionOutput?.moveBlend??0)*(1-contact);
  hand.y-=hipDrop;
  const restTwist=Math.sin(sweepAngle)*.12*contact;
  // First find where the wrist really ends up, then tilt the broom by exactly
  // the angle that puts its bristle tips at the wanted height above the ground.
  const body=model.body;body.rotation.y=restTwist;
  let inverse=body.quaternion.clone().invert();
  const wrist=model.wrists[RIGHT_HAND],local=reachable(model,hand.applyQuaternion(inverse));
  hand.copy(local).applyQuaternion(body.quaternion);
  // Measured rather than predicted: some characters have scaled bodies and arms.
  solveRightArm(model,local);body.updateMatrixWorld(true);
  const wristHeight=model.root.worldToLocal(wrist.getWorldPosition(new THREE.Vector3())).y+(model.postureOffset??0);
  const reach=BROOM_GRIP+.08*wrist.getWorldScale(new THREE.Vector3()).y;
  const cos=THREE.MathUtils.clamp((wristHeight-clearance)/reach,-1,1),sin=Math.sqrt(1-cos*cos);
  let current={hand,quaternion:broomQuaternion(new THREE.Vector3(Math.sin(bearing)*sin,-cos,Math.cos(bearing)*sin)),twist:restTwist,lean:0};
  if(strike){
    // Key poses share the carried pose's convention of a fixed height above the ground.
    hand.y+=hipDrop;current=strikePose(strike,current);current.hand.y-=hipDrop;
    // The torso winds up and drives through the blow. poseAvatar removes the
    // lean again before damping its own bow rotation.
    body.rotation.y=current.twist;body.rotation.x+=current.lean;model.strikeLean=current.lean;
    inverse=body.quaternion.clone().invert();
  }
  solveRightArm(model,current.hand.clone().applyQuaternion(inverse));
  // The wrist and tool share one orientation; the grip remains attached even
  // while the torso turns or the avatar walks over the curved bridge.
  const arm=model.arms[RIGHT_HAND],elbow=model.elbows[RIGHT_HAND];
  const quaternion=inverse.multiply(current.quaternion);
  wrist.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(quaternion);
  model.broomQuaternion=quaternion;
}
