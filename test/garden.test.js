const{test}=require('node:test');
const assert=require('node:assert/strict');
const birdsong=require('../public/birdsong');

test('every tree has individual veined leaves and branches, with a bounded mobile budget',async()=>{
  const {TempleGarden}=await import('../public/garden.mjs'),{Group}=await import('three');
  const garden=new TempleGarden(new Group(),{batterySaver:true});
  assert.equal(garden.trees.length,21);assert.equal(new Set(garden.trees.map(t=>t.species)).size,3);
  assert.ok(garden.trees.every(t=>t.foliage.isInstancedMesh&&t.foliage.count===320&&t.leaves.length>500));
  assert.ok(garden.trees.every(t=>t.trunk.isMesh&&t.trunk.geometry.attributes.normal.getX(1)>0));
  assert.ok(garden.branches.count>1000);assert.equal(garden.fallBatches.reduce((sum,b)=>sum+b.mesh.count,0),30);
  for(const g of garden.geometries){assert.ok(g.attributes.uv);for(const n of g.attributes.position.array)assert.ok(Number.isFinite(n));for(const n of g.attributes.normal.array)assert.ok(Number.isFinite(n));}
  garden.setQuality(false);assert.equal(garden.fallBatches.reduce((sum,b)=>sum+b.mesh.count,0),72);assert.ok(garden.trees.every(t=>t.foliage.count===t.leaves.length));
  garden.update(5);const a=Array.from(garden.fallBatches[0].mesh.instanceMatrix.array);garden.update(5.5);const b=Array.from(garden.fallBatches[0].mesh.instanceMatrix.array);assert.notDeepEqual(a,b);assert.equal(garden.wind.value,5.5);
  assert.equal(garden.audioSources.length,4);assert.ok(garden.audioSources.every(s=>Number.isFinite(s.position.y)&&s.position.y>3));garden.sing('bird-0',6,1);assert.equal(garden.birds[0].singUntil,7);
  garden.dispose();
});
test('fallen leaves descend from their crown and settle above the ground without jumping back up during a fall',async()=>{
  const {fallingLeafPose}=await import('../public/garden-layout.mjs');
  const leaf={x:1,y:8,z:2,fallTime:10,cycle:15,offset:0,drift:2,crossDrift:.5,seed:1,size:.5};
  let previous=Infinity;for(let t=0;t<=10;t+=.25){const p=fallingLeafPose(leaf,t,.4);assert.ok(p.y<=previous);assert.ok(p.y>=.445-1e-9);previous=p.y;}
  const landed=fallingLeafPose(leaf,12,.4);assert.equal(landed.air,false);assert.ok(Math.abs(landed.y-.445)<1e-8);assert.ok(fallingLeafPose(leaf,14.8,.4).scale<landed.scale);
});
test('bird phrases vary in rhythm and use bounded smooth pitches',()=>{
  const types=['whistle','warble','chirp'];const phrases=types.map(type=>birdsong.phrase(type,()=>.5));
  assert.equal(new Set(phrases.map(p=>p.length)).size,3);
  for(const phrase of phrases){let previous=-1;for(const n of phrase){assert.ok(n.at>previous);previous=n.at;assert.ok(n.duration>.05&&n.duration<.5);for(const f of [n.from,n.to,n.end])assert.ok(f>1500&&f<6000);}}
});
test('bird sound gets quieter farther away and pans with the viewing direction',()=>{
  const listener={x:0,y:2,z:0,yaw:0};const near=birdsong.spatial({x:5,y:5,z:0},listener),far=birdsong.spatial({x:50,y:5,z:0},listener);
  assert.ok(near.gain>far.gain);assert.ok(near.pan>0);assert.ok(birdsong.spatial({x:-5,y:5,z:0},listener).pan<0);assert.ok(birdsong.spatial({x:5,y:5,z:0},{...listener,yaw:Math.PI}).pan<0);
  assert.ok(far.gain>0&&near.gain<=1);assert.ok(Math.abs(near.pan)<=1);
});
