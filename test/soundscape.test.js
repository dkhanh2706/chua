const {test}=require('node:test');
const assert=require('node:assert/strict');
const world=require('../public/world');
const {mix}=require('../public/water-audio');

test('water is silent away from the shore and fades in smoothly close to water',()=>{
  for(const [x,y] of [[450,605],[500,220],[500,350],[200,605]]){
    const levels=mix(x,y,0,world);assert.equal(levels.stream,0);assert.equal(levels.waterfall,0);
  }
  const center=world.riverX(505);let previous=0;
  for(let distance=140;distance>=36;distance--){const level=mix(center+distance,505,0,world).stream;assert.ok(level>=previous);assert.ok(level-previous<.015);previous=level;}
  assert.ok(mix(center+40,505,0,world).stream>.35);
  assert.ok(mix(350,451,0,world).stream>0,'quiet shore sound near the lotus pond');
  assert.ok(mix(815,125,Math.PI/2,world).waterfall>.1);
});

test('ambient score uses a slow tempo, four soft chords and rests in its melody',()=>{
  const {BEAT,CHORDS,MELODY,frequency}=require('../public/ambient-music');
  assert.ok(60/BEAT>=60&&60/BEAT<=75);assert.equal(CHORDS.length,4);assert.ok(CHORDS.every(c=>c.length===4));assert.equal(MELODY.length,32);assert.ok(MELODY.filter(n=>n===null).length>=8);
  assert.equal(frequency(69),440);for(const n of MELODY.filter(n=>n!==null))assert.ok(frequency(n)>200&&frequency(n)<1100);
});
