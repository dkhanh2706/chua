import * as THREE from 'three';

// The avatar faces local +Z, so its anatomical right hand is on local -X.
export const RIGHT_HAND=0;
const down=new THREE.Vector3(0,-1,0);
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

export function broomStrike(time,start){
  const age=time-(start??-100);if(age<0||age>=.65)return null;
  const phase=age/.65;
  return{
    angle:-1.2+2.4*smooth((phase-.22)/.54),
    blend:smooth(phase/.22)*(1-smooth((phase-.76)/.24)),
  };
}

export function strikeBroomQuaternion(strike){
  return new THREE.Quaternion().setFromUnitVectors(down,new THREE.Vector3(-Math.sin(strike.angle),-.035,Math.cos(strike.angle)).normalize());
}

export function applyRightHandStrike(model,strike){
  const arm=model.arms[RIGHT_HAND],elbow=model.elbows[RIGHT_HAND],wrist=model.wrists[RIGHT_HAND];
  const shoulder=arm.position,target=new THREE.Vector3(-.18-.30*Math.sin(strike.angle),.56,.27+.08*Math.cos(strike.angle));
  const delta=target.clone().sub(shoulder),distance=delta.length(),axis=delta.normalize();
  const upperLength=.34,lowerLength=.29,along=(upperLength**2-lowerLength**2+distance**2)/(2*distance);
  const pole=new THREE.Vector3(-1,-.3,.1);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const joint=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,upperLength**2-along**2)));
  const upper=new THREE.Quaternion().setFromUnitVectors(down,joint.clone().sub(shoulder).normalize());
  const lower=new THREE.Quaternion().setFromUnitVectors(down,target.sub(joint).normalize());
  arm.quaternion.slerp(upper,strike.blend);
  elbow.quaternion.slerp(upper.clone().invert().multiply(lower),strike.blend);
  wrist.rotation.z=-.25*strike.blend;
}
