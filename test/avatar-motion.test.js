const{test}=require('node:test');
const assert=require('node:assert/strict');
const motionModule=import('../public/avatar-motion.mjs');

test('walking phase follows actual distance at different frame rates and stays fixed against a wall',async()=>{
  const{createAvatarMotion,advanceAvatarMotion}=await motionModule;
  function walk(fps){const state=createAvatarMotion();advanceAvatarMotion(state,{x:0,y:0,action:'stand'},0,0);let result;for(let i=1;i<=fps;i++)result=advanceAvatarMotion(state,{x:i/fps*96,y:0,action:'stand',moving:true},i/fps,1/fps);return{state,result};}
  const a=walk(60),b=walk(20);assert.ok(Math.abs(a.result.phase-b.result.phase)<1e-8);assert.equal(a.state.totalDistance,96);assert.equal(a.result.stepCount,b.result.stepCount);
  const phase=a.result.phase;for(let i=0;i<60;i++)advanceAvatarMotion(a.state,{x:96,y:0,action:'stand',moving:true},2+i/60,1/60);
  assert.equal(a.state.phase,phase);assert.ok(a.state.moveBlend<.001);assert.equal(a.state.direction,'side');
});
test('sit-down and stand-up take half a second, reverse smoothly, and keep the feet position',async()=>{
  const{createAvatarMotion,advanceAvatarMotion}=await motionModule,state=createAvatarMotion();let result;
  for(let i=0;i<5;i++)result=advanceAvatarMotion(state,{x:10,y:15,action:'sit'},i*.05,.05);
  assert.equal(result.name,'sit_down');const halfway=result.sit;assert.ok(halfway>.4&&halfway<.6);
  result=advanceAvatarMotion(state,{x:10,y:15,action:'stand'},.3,.05);assert.equal(result.name,'sit_up');assert.ok(result.sit<halfway);assert.equal(result.locked,true);
  for(let i=0;i<10;i++)result=advanceAvatarMotion(state,{x:10,y:15,action:'stand'},.35+i*.05,.05);
  assert.equal(result.name,'idle');assert.equal(result.sit,0);assert.equal(result.totalDistance,0);
});
test('bow has preparation, a held low pose and a full recovery; incense has a distinct offering phase',async()=>{
  const{createAvatarMotion,advanceAvatarMotion}=await motionModule;
  for(const kind of ['bow','incense']){const state=createAvatarMotion();const player={x:0,y:0,action:'bow',ritual:{kind,start:1000}};
    let output=advanceAvatarMotion(state,player,1,.016);assert.equal(output.locked,true);assert.equal(output.bow,0);
    output=advanceAvatarMotion(state,player,1.75,.05);assert.equal(output.name,kind);assert.ok(output.prayer>.9);
    if(kind==='bow')assert.ok(output.bow>.9);else{assert.ok(output.incense>.9);assert.ok(output.bow<.3);}
    output=advanceAvatarMotion(state,{...player,action:'stand'},2.55,.05);assert.equal(output.locked,false);assert.equal(output.bow,0);assert.equal(output.incense,0);
  }
});
test('idle blinking is repeatable, spaced between three and six seconds, and heading is retained after stopping',async()=>{
  const{createAvatarMotion,advanceAvatarMotion}=await motionModule,state=createAvatarMotion(50);
  advanceAvatarMotion(state,{x:0,y:0,action:'stand'},10,.016);assert.ok(state.nextBlink>=13&&state.nextBlink<=16);
  const at=state.nextBlink;advanceAvatarMotion(state,{x:0,y:0,action:'stand'},at,.016);const output=advanceAvatarMotion(state,{x:0,y:0,action:'stand'},at+.085,.016);assert.ok(output.blink<.1);assert.ok(state.nextBlink>=at+3&&state.nextBlink<=at+6);
  advanceAvatarMotion(state,{x:0,y:-10,action:'stand'},20,.016);const heading=state.heading;advanceAvatarMotion(state,{x:0,y:-10,action:'stand'},21,.016);assert.equal(state.heading,heading);assert.equal(state.direction,'up');
});
test('input acceleration and braking approach their target in about a tenth of a second',async()=>{
  const{easeVelocity}=await import('../public/locomotion.mjs');let value=0;for(let i=0;i<6;i++)value=easeVelocity(value,75,1/60);assert.ok(value>65&&value<75);for(let i=0;i<6;i++)value=easeVelocity(value,0,1/60);assert.ok(value<7);for(let i=0;i<24;i++)value=easeVelocity(value,0,1/60);assert.equal(value,0);
});
