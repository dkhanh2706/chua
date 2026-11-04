const { test } = require('node:test');
const assert = require('node:assert/strict');
const poseModule = import('../public/embodiment.mjs');

test('sitting lowers the eyes; standing restores their height without added tilt', async () => {
  const { eyePose } = await poseModule;
  const standing = eyePose({ action: 'stand' }, 10000);
  const sitting = eyePose({ action: 'sit' }, 10000);
  assert.ok(sitting.height < standing.height - .4);
  assert.equal(standing.pitch, 0);assert.equal(sitting.pitch, 0);
  assert.deepEqual(eyePose({ action: 'stand' }, 12000), standing);
});
test('a bow lowers the eyes, looks down smoothly, then returns fully upright', async () => {
  const { eyePose } = await poseModule;
  const player = { action: 'bow', ritual: { kind: 'bow', start: 1000 } };
  const start = eyePose(player,1000),mid = eyePose(player,1750),end = eyePose(player,2500);
  assert.ok(mid.height < start.height - .7);assert.ok(mid.pitch > .6);
  assert.ok(eyePose(player,1300).pitch < mid.pitch);
  assert.deepEqual(end,start);assert.equal(end.prayer,0);
  const full = eyePose(player,1750,false);assert.ok(full.height < mid.height);assert.ok(full.pitch > mid.pitch);
});
test('incense uses a gentle inclination and a visible raised stick only during the accepted ritual', async () => {
  const { eyePose } = await poseModule;
  const player = { action: 'bow', ritual: { kind: 'incense', start: 5000 } };
  const mid = eyePose(player,5750),end = eyePose(player,6500);
  assert.equal(mid.incense,true);assert.ok(mid.lift>.9);
  assert.ok(mid.pitch>0&&mid.pitch<.3);assert.ok(mid.height>1.7);
  assert.equal(end.incense,false);assert.equal(end.lift,0);assert.equal(end.pitch,0);
  assert.equal(eyePose({action:'stand'},5750).incense,false);
});
test('eye height and ritual timing share the rendered body transition',async()=>{
  const{eyePose}=await poseModule;
  const half=eyePose({action:'stand',visualMotion:{sit:.5}},1000);assert.ok(half.height>1.48&&half.height<2.02);
  const player={action:'bow',ritual:{kind:'bow',start:1000},visualMotion:{sit:0,bow:1,prayer:1}};
  assert.ok(eyePose(player,1400).pitch>.7);assert.equal(eyePose({...player,visualMotion:{sit:0,bow:0,prayer:1}},1400).pitch,0);
});
