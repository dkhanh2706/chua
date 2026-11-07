const {test}=require('node:test');
const assert=require('node:assert/strict');
const config=require('../public/avatar-config');

test('right-handed broom strike sweeps horizontally from the avatar left to right through the front',async()=>{
  const {Vector3}=await import('three');
  const {broomStrike,strikeBroomQuaternion,applyRightHandStrike,RIGHT_HAND}=await import('../public/broom-motion.mjs');
  const {createAvatar,poseAvatar,disposeAvatar}=await import('../public/avatar-model.mjs');
  const model=createAvatar(config.defaults());
  const samples=[];
  for(const time of [.15,.30,.49]){
    const strike=broomStrike(time,0),direction=new Vector3(0,-1,0).applyQuaternion(strikeBroomQuaternion(strike));
    assert.ok(Math.abs(direction.y)<.04,'broom stays horizontal');
    poseAvatar(model,{action:'stand'},time,.05);applyRightHandStrike(model,strike);model.root.updateMatrixWorld(true);
    const wrist=model.wrists[RIGHT_HAND].getWorldPosition(new Vector3());
    assert.ok(wrist.y>1.2&&wrist.y<1.4,'right hand holds the broom across the torso');
    samples.push({direction,wrist});
  }
  assert.ok(model.arms[RIGHT_HAND].position.x<0,'anatomical right arm');
  assert.ok(samples[0].direction.x>.85);assert.ok(samples[1].direction.z>.95);assert.ok(samples[2].direction.x<-.85);
  assert.ok(samples[0].wrist.x>samples[1].wrist.x&&samples[1].wrist.x>samples[2].wrist.x);
  assert.equal(broomStrike(.65,0),null);assert.equal(broomStrike(-.1,0),null);
  disposeAvatar(model);
});

test('sweeping keeps the bristles above the ground and the tool locked to the wrist at every heading',async()=>{
  const {Vector3,Quaternion}=await import('three');
  const {applyBroomPose,BROOM_GRIP}=await import('../public/broom-motion.mjs');
  const {createAvatar,poseAvatar,disposeAvatar}=await import('../public/avatar-model.mjs');
  for(const character of ['male','female']){
    const model=createAvatar(config.defaults(character));let previous;
    for(let time=0;time<=1;time+=1/120){
      poseAvatar(model,{action:'stand'},time,1/120);applyBroomPose(model,{sweepStart:0},time);
      model.root.rotation.y=time*3;model.root.position.y=model.postureOffset;model.root.updateMatrixWorld(true);
      const hand=new Vector3(0,-.08,.018);model.wrists[0].localToWorld(hand);
      const orientation=model.body.getWorldQuaternion(new Quaternion()).multiply(model.broomQuaternion);
      const tip=hand.clone().add(new Vector3(0,-BROOM_GRIP,0).applyQuaternion(orientation));
      assert.ok(tip.y>.005&&tip.y<.09,`bristles clear the paving at ${time}: ${tip.y}`);
      assert.ok(model.wrists[0].getWorldQuaternion(new Quaternion()).angleTo(orientation)<1e-6,'hand and handle share the same orientation');
      if(previous)assert.ok(tip.distanceTo(previous)<.05,'no position jump at sweep boundaries');previous=tip;
    }
    disposeAvatar(model);
  }
});
