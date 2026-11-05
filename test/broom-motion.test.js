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
