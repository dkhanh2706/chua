const {test}=require('node:test');
const assert=require('node:assert/strict');
const world=require('../public/world');

test('terraced waterfall stays above its bed, joins the river and clears every garden tree',async()=>{
  const {cascadeCenter,cascadeHeight,cascadeHalfWidth,mountainFootprint,rockyHeight,streamCenter,FALL_STATIONS}=await import('../public/waterfall-layout.mjs');
  const {makeTreeLayout}=await import('../public/garden-layout.mjs');
  assert.equal(FALL_STATIONS.filter((s,i)=>i&&FALL_STATIONS[i-1][1]-s[1]>5).length,3);
  let previous=Infinity;
  for(let z=-60;z<=-22.8;z+=.05){
    const y=cascadeHeight(z);assert.ok(y<=previous+1e-8);previous=y;
    for(const side of [-1,0,1])assert.ok(y-rockyHeight(cascadeCenter(z)+side*cascadeHalfWidth(z),z)>.05,'water clears the rock bed');
  }
  assert.ok(Math.abs(cascadeCenter(-23)-streamCenter(-23))<1e-8);assert.equal(cascadeHeight(-23),.055);
  for(const tree of makeTreeLayout())assert.equal(mountainFootprint(tree.x,tree.z,tree.radius+1),false,`${tree.id} clears the mountain`);
});

test('the enclosure surrounds every tree crown and only opens at the finished entrance and stream portal',async()=>{
  const {Group}=await import('three'),{GardenBoundary,GARDEN_BOUNDS:b}=await import('../public/garden-boundary.mjs'),{TempleGarden}=await import('../public/garden.mjs');
  const boundary=new GardenBoundary(new Group(),{riverX:world.riverX}),garden=new TempleGarden(new Group(),{batterySaver:true});
  assert.equal(boundary.segments.length,8);assert.ok(boundary.root.getObjectByName('arched-stream-outlet'));
  const endpoints=new Map();for(const segment of boundary.segments)for(const point of segment){const key=point.join(',');endpoints.set(key,(endpoints.get(key)||0)+1);}
  assert.equal([...endpoints.values()].filter(n=>n===1).length,4,'two portal openings; all other wall ends meet');
  assert.ok([...endpoints.values()].every(n=>n<=2));
  assert.equal(garden.crowns.isInstancedMesh,true);assert.equal(garden.crowns.count,21*24);
  for(const c of garden.crownTransforms){assert.ok(c.position.x-c.radius>b.left+.6);assert.ok(c.position.x+c.radius<b.right-.6);assert.ok(c.position.z-c.radius>b.rear+.6);assert.ok(c.position.z+c.radius<b.front-.6);}
  garden.dispose();
});

test('patterned koi stay below the surface and within the pond throughout smooth swimming',async t=>{
  const original=global.window;global.window=world;t.after(()=>{global.window=original;});
  const {Group}=await import('three'),{LotusPond}=await import('../public/lotus-pond.mjs');
  const pond=new LotusPond(new Group());assert.equal(pond.fish.length,8);assert.equal(pond.pads.length,3);
  assert.ok(pond.root.getObjectByName('submerged-pond-pebbles').isInstancedMesh);
  for(const fish of pond.fish){const colors=fish.g.children[0].geometry.attributes.color;assert.ok(colors);assert.ok(new Set(Array.from(colors.array).map(n=>n.toFixed(2))).size>4);}
  for(let time=0;time<120;time+=.5){pond.update(time);for(const fish of pond.fish){assert.ok((fish.g.position.x/13.4)**2+(fish.g.position.z/8.6)**2<.65);assert.ok(fish.g.position.y+.085*fish.g.scale.y<.235);assert.ok(Number.isFinite(fish.tail.rotation.y));}}
});
