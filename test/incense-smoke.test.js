const {test}=require('node:test');
const assert=require('node:assert/strict');

test('a full incense burner uses one smoke batch and reduces particles on phones',async()=>{
  const {Group}=await import('three'),{IncenseSmoke}=await import('../public/incense-smoke.mjs');
  const parent=new Group(),smoke=new IncenseSmoke(parent),items=Array.from({length:12},(_,slot)=>({slot,end:300000}));
  smoke.update(items,1,true,1000);assert.equal(parent.children.length,1);assert.equal(smoke.mesh.isInstancedMesh,true);assert.equal(smoke.mesh.count,36);
  for(const value of smoke.mesh.instanceMatrix.array)assert.ok(Number.isFinite(value));
  for(const value of smoke.opacity.array)assert.ok(value>=0&&value<=.15);
  smoke.update(items,2,false,2000);assert.equal(smoke.mesh.count,60);
  smoke.update([],3,true,3000);assert.equal(smoke.mesh.count,0);assert.equal(smoke.mesh.visible,false);
  smoke.mesh.geometry.dispose();smoke.mesh.material.dispose();smoke.mesh.dispose();
});
