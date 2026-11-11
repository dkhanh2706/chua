const {test}=require('node:test');
const assert=require('node:assert/strict');

test('water slopes agree with the moving surface so reflections and boats follow the crests',async()=>{
  const {sampleWaterWaves}=await import('../public/water-waves.mjs'),step=.001;
  for(const [x,z] of [[-34,-110],[108,-15],[-112,8],[25,102],[-13,-220]]){
    for(let time=0;time<20;time+=.7){
      const wave=sampleWaterWaves(x,z,time);
      const dx=(sampleWaterWaves(x+step,z,time).height-sampleWaterWaves(x-step,z,time).height)/(step*2);
      const dz=(sampleWaterWaves(x,z+step,time).height-sampleWaterWaves(x,z-step,time).height)/(step*2);
      assert.ok(Math.abs(wave.dx-dx)<1e-6);assert.ok(Math.abs(wave.dz-dz)<1e-6);
      assert.ok(Math.abs(wave.height)<=.265,'swells stay within the designed waterline clearance');
      assert.ok(Math.abs(sampleWaterWaves(x,z,time+1/60).height-wave.height)<.02,'wave movement is smooth between frames');
    }
  }
});
