const {test}=require('node:test');
const assert=require('node:assert/strict');
const config=require('../public/avatar-config');

test('every character swings diagonally from upper right to lower left through the shared hit time',async()=>{
  const {Vector3,Quaternion}=await import('three');
  const {broomStrike,strikeBroomQuaternion,applyBroomPose,RIGHT_HAND,BROOM_GRIP}=await import('../public/broom-motion.mjs');
  const {HIT_CONTACT,HIT_DURATION}=require('../public/sweeping');
  const {createAvatar,poseAvatar,disposeAvatar}=await import('../public/avatar-model.mjs');
  for(const appearance of [config.defaults('male'),config.defaults('female'),config.withCharacterCode(config.defaults(),'tom'),config.withCharacterCode(config.defaults(),'chồn')]){
  const model=createAvatar(appearance);
  const samples=[];
  for(const time of [.12,HIT_CONTACT/1000,.48]){
    const strike=broomStrike(time,0),direction=new Vector3(0,-1,0).applyQuaternion(strikeBroomQuaternion(strike));
    poseAvatar(model,{action:'stand'},time,.05);applyBroomPose(model,{hitStart:0},time);model.root.position.y=model.postureOffset;model.root.updateMatrixWorld(true);
    const wrist=model.wrists[RIGHT_HAND].getWorldPosition(new Vector3());
    const hand=model.wrists[RIGHT_HAND].localToWorld(new Vector3(0,-.08,.018));
    const orientation=model.body.getWorldQuaternion(new Quaternion()).multiply(model.broomQuaternion);
    const tip=hand.clone().add(new Vector3(0,-BROOM_GRIP,0).applyQuaternion(orientation));
    assert.ok(tip.y>.1,'the diagonal follow-through clears the ground');
    samples.push({direction,wrist,tip});
  }
  assert.ok(model.arms[RIGHT_HAND].position.x<0,'anatomical right arm');
  assert.ok(samples[0].direction.x<-.6&&samples[0].direction.y>.6,'raise toward the anatomical right');
  assert.ok(samples[1].direction.z>.999&&Math.abs(samples[1].direction.y)<1e-8,'cross forward exactly at hit detection');
  assert.ok(samples[2].direction.x>.6&&samples[2].direction.y<-.6,'follow through down the left');
  assert.ok(samples[0].wrist.x<samples[1].wrist.x&&samples[1].wrist.x<samples[2].wrist.x);
  assert.ok(samples[0].wrist.y>samples[1].wrist.y&&samples[1].wrist.y>samples[2].wrist.y);
  assert.ok(samples[0].tip.y>samples[2].tip.y+1,'the bristles follow a clear downward diagonal');
  let previous;
  for(let time=0;time<=HIT_DURATION/1000+.02;time+=1/120){
    poseAvatar(model,{action:'stand'},time,1/120);applyBroomPose(model,{hitStart:0},time);model.root.updateMatrixWorld(true);
    const hand=model.wrists[RIGHT_HAND].getWorldPosition(new Vector3());
    if(previous)assert.ok(hand.distanceTo(previous)<.08,'wind-up and recovery stay continuous');previous=hand;
  }
  assert.equal(broomStrike(HIT_DURATION/1000,0),null);assert.equal(broomStrike(-.1,0),null);
  disposeAvatar(model);
  }
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
