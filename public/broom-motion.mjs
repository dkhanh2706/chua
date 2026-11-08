import * as THREE from 'three';

// The avatar faces local +Z, so its anatomical right hand is on local -X.
export const RIGHT_HAND=0;
export const BROOM_GRIP=.945;
const down=new THREE.Vector3(0,-1,0);
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

export function broomStrike(time,start){
  const age=time-(start??-100);if(age<0||age>=.65)return null;
  return{
    // Raise on the avatar's right, cross the front at the 300 ms hit time,
    // then follow through down its left before returning to the resting grip.
    angle:-1.2+2.4*smooth((age-.12)/.36),
    blend:smooth(age/.12)*(1-smooth((age-.48)/.17)),
  };
}

export function strikeBroomQuaternion(strike){
  return new THREE.Quaternion().setFromUnitVectors(down,new THREE.Vector3(Math.sin(strike.angle)*.72,-Math.sin(strike.angle)*.72,Math.cos(strike.angle)*.95).normalize());
}

const strikeHandTarget=strike=>new THREE.Vector3(-.18+.30*Math.sin(strike.angle),.66-.30*Math.sin(strike.angle),.32+.12*Math.cos(strike.angle));

function solveRightArm(model,target,blend=1){
  const arm=model.arms[RIGHT_HAND],elbow=model.elbows[RIGHT_HAND],wrist=model.wrists[RIGHT_HAND];
  const shoulder=arm.position,delta=target.clone().sub(shoulder),distance=THREE.MathUtils.clamp(delta.length(),.06,.625),axis=delta.normalize();
  target=shoulder.clone().addScaledVector(axis,distance);
  const upperLength=.34,lowerLength=.29,along=(upperLength**2-lowerLength**2+distance**2)/(2*distance);
  const pole=new THREE.Vector3(-1,-.3,.1);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const joint=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,upperLength**2-along**2)));
  const upper=new THREE.Quaternion().setFromUnitVectors(down,joint.clone().sub(shoulder).normalize());
  const lower=new THREE.Quaternion().setFromUnitVectors(down,target.sub(joint).normalize());
  arm.quaternion.slerp(upper,blend);
  elbow.quaternion.slerp(upper.clone().invert().multiply(lower),blend);
  wrist.rotation.z=0;
}

export function applyRightHandStrike(model,strike){
  solveRightArm(model,strikeHandTarget(strike),strike.blend);
}

export function applyBroomPose(model,player,time){
  const age=time-(player.sweepStart??-100),sweeping=age>=0&&age<.9,phase=THREE.MathUtils.clamp(age/.9,0,1);
  // Ease into ground contact, sweep once, then bring the broom back to the side.
  const contact=sweeping?smooth(phase/.18)*(1-smooth((phase-.76)/.24)):0;
  const sweepAngle=THREE.MathUtils.lerp(-.7,.7,smooth((phase-.18)/.58));
  const target=new THREE.Vector3(-.39,.34,.20);
  target.lerp(new THREE.Vector3(-.35-Math.sin(sweepAngle)*.12,.32,.23),contact);
  const direction=new THREE.Vector3(-.13, -1,.10).lerp(new THREE.Vector3(-Math.sin(sweepAngle)*.25,-1,.08),contact).normalize();
  const quaternion=new THREE.Quaternion().setFromUnitVectors(down,direction),strike=broomStrike(time,player.hitStart);
  if(strike){
    target.lerp(strikeHandTarget(strike),strike.blend);
    quaternion.slerp(strikeBroomQuaternion(strike),strike.blend);
    model.body.rotation.y=Math.sin(strike.angle)*.10*strike.blend;
    model.body.rotation.x+=Math.sin(strike.angle)*.06*strike.blend;
  }else model.body.rotation.y=0;
  solveRightArm(model,target);
  // The wrist and tool share one orientation; the grip remains attached even
  // while the torso turns or the avatar walks over the curved bridge.
  const arm=model.arms[RIGHT_HAND],elbow=model.elbows[RIGHT_HAND],wrist=model.wrists[RIGHT_HAND];
  wrist.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(quaternion);
  model.broomQuaternion=quaternion;
}
