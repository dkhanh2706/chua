const {test}=require('node:test');
const assert=require('node:assert/strict');
const config=require('../public/avatar-config');

test('every character cocks the broom over the shoulder and chops it forward through the shared hit time',async()=>{
  const {Vector3,Quaternion}=await import('three');
  const {broomStrike,applyBroomPose,RIGHT_HAND,BROOM_GRIP,BROOM_SCALE}=await import('../public/broom-motion.mjs');
  const {HIT_CONTACT,HIT_DURATION}=require('../public/sweeping');
  const {createAvatar,poseAvatar,disposeAvatar}=await import('../public/avatar-model.mjs');
  // The rack broom's handle ends at 2.45; the fist closes round its top quarter.
  assert.ok(BROOM_GRIP/BROOM_SCALE>2&&BROOM_GRIP/BROOM_SCALE<2.3,'held near the end of the handle, not its middle');
  for(const [index,appearance] of [config.defaults('male'),config.defaults('female'),config.withCharacterCode(config.defaults(),'tom'),config.withCharacterCode(config.defaults(),'chồn')].entries()){
    const model=createAvatar(appearance);
    const sample=(time,dt=.05)=>{
      poseAvatar(model,{action:'stand'},time,dt);applyBroomPose(model,{hitStart:0},time);model.root.position.y=model.postureOffset;model.root.updateMatrixWorld(true);
      const wrist=model.wrists[RIGHT_HAND].getWorldPosition(new Vector3());
      const hand=model.wrists[RIGHT_HAND].localToWorld(new Vector3(0,-.08,.018));
      const orientation=model.body.getWorldQuaternion(new Quaternion()).multiply(model.broomQuaternion);
      const direction=new Vector3(0,-1,0).applyQuaternion(orientation);
      // The last character's squashed body skews its wrist matrix slightly.
      const locked=model.wrists[RIGHT_HAND].getWorldQuaternion(new Quaternion()).angleTo(orientation)<(index<3?1e-6:.25);
      return{direction,wrist,locked,tip:hand.clone().addScaledVector(direction,BROOM_GRIP)};
    };
    const windUp=sample(.22),contact=sample(HIT_CONTACT/1000),follow=sample(.50);
    assert.ok(model.arms[RIGHT_HAND].position.x<0,'anatomical right arm');
    assert.ok(windUp.direction.y>.7&&windUp.direction.z<0,'cocked back over the right shoulder');
    assert.ok(windUp.tip.y>windUp.wrist.y+.8,'bristles raised above the fist');
    assert.ok(contact.direction.z>.95&&Math.abs(contact.direction.y)<.25,'bristles land straight ahead exactly at hit detection');
    assert.ok(contact.tip.z>1.1&&contact.tip.y>.7&&contact.tip.y<1.8,'the blow lands at body height, well in front');
    assert.ok(follow.direction.y<-.5&&follow.direction.x>.3,'the weight carries through, down to the left');
    assert.ok(windUp.wrist.y>contact.wrist.y&&contact.wrist.y>follow.wrist.y,'the fist drives downward through the blow');
    assert.ok(model.body.rotation.x>.2,'the torso leans into the follow-through');
    let previous;
    for(let time=0;time<=HIT_DURATION/1000+.02;time+=1/120){
      const frame=sample(time,1/120);
      assert.ok(frame.tip.y>.02,`the bristles never dig into the ground at ${time}: ${frame.tip.y}`);
      assert.ok(frame.locked,'hand and handle share the same orientation');
      if(previous)assert.ok(frame.wrist.distanceTo(previous)<.11,'wind-up and recovery stay continuous');previous=frame.wrist;
    }
    poseAvatar(model,{action:'stand'},1,1/120);assert.ok(Math.abs(model.body.rotation.x)<.05,'the lean does not linger after the swing');
    assert.equal(broomStrike(HIT_DURATION/1000,0),null);assert.equal(broomStrike(-.1,0),null);
    disposeAvatar(model);
  }
});

test('a knockdown topples the visitor, leaves them dazed, and has them upright again when control returns',async()=>{
  const {knockdown}=await import('../public/knockdown.mjs');
  const {KNOCKDOWN_DURATION,HIT_COOLDOWN,HIT_CONTACT,KNOCKDOWN_GRACE}=require('../public/sweeping'),duration=KNOCKDOWN_DURATION/1000;
  for(const [age,length] of [[-.01,duration],[duration,duration],[.5,0],[.5,undefined]])assert.equal(knockdown(age,length),null);
  assert.equal(knockdown(0,duration).tilt,0);
  const lying=knockdown(duration/2,duration);assert.ok(lying.tilt>1.4&&lying.dazed,'flat on the ground and seeing stars');
  let previous=0;
  for(let age=0;age<duration;age+=1/120){
    const {tilt}=knockdown(age,duration);
    assert.ok(tilt>=0&&tilt<1.55&&Math.abs(tilt-previous)<.12,`no snap at ${age}`);
    if(age<.35)assert.ok(tilt>=previous,'falls without hesitating');previous=tilt;
  }
  assert.ok(previous<.01,'standing again as the lock ends');
  // The next swing cannot land before the victim has had time to walk away.
  assert.ok(HIT_COOLDOWN+HIT_CONTACT<KNOCKDOWN_DURATION+KNOCKDOWN_GRACE);
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
      // The avatar also spins at 3 rad/s here, carrying the outstretched bristles round with it.
      if(previous)assert.ok(tip.distanceTo(previous)<.08,'no position jump at sweep boundaries');previous=tip;
    }
    disposeAvatar(model);
  }
});
