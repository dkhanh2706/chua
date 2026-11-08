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

test('the garden boundary closes behind the temple and mountain and only opens at its two portals',async()=>{
  const {Group,Raycaster,Vector3}=await import('three'),{GardenBoundary,GARDEN_BOUNDS:b}=await import('../public/garden-boundary.mjs'),{TempleGarden}=await import('../public/garden.mjs');
  const boundary=new GardenBoundary(new Group(),{riverX:world.riverX}),garden=new TempleGarden(new Group(),{batterySaver:true});
  assert.deepEqual(boundary.segments,world.gardenWallSegments());assert.ok(boundary.root.getObjectByName('arched-stream-outlet'));
  const endpoints=new Map();for(const segment of boundary.segments)for(const point of segment){const key=point.join(',');endpoints.set(key,(endpoints.get(key)||0)+1);}
  assert.equal([...endpoints.values()].filter(n=>n===1).length,4,'only the gate and stream portal remain open');
  assert.ok([...endpoints.values()].every(n=>n<=2));
  boundary.root.updateMatrixWorld(true);const ray=new Raycaster();
  for(const [x,z] of [[-30,-35],[35,-65]]){ray.set(new Vector3(x,1,z),new Vector3(0,0,-1));assert.ok(ray.intersectObject(boundary.root,true).length,'the rear wall is visible and solid');}
  for(const [a,b] of boundary.segments)for(let i=0;i<=10;i++){const t=i/10,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;assert.ok(world.coastHeight(x,z)>-.025,'the wall follows dry land rather than floating over the beach');}
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

test('river fish remain submerged, clear both banks and swim without jumps',async t=>{
  const original=global.window;global.window=world;t.after(()=>{global.window=original;});
  const {Group}=await import('three'),{RiverGarden,riverCenter}=await import('../public/river-garden.mjs');
  const river=new RiverGarden(new Group(),{value:0});assert.equal(river.fish.length,16);
  const previous=new Map();
  for(let time=0;time<90;time+=.1){river.update(time);for(const f of river.fish){
    const p=f.g.position;assert.ok(p.y+.05<.055&&p.y-.05>-.34);assert.ok(Math.abs(p.x-riverCenter(p.z))<2.7);assert.ok(p.z> -24&&p.z<44);
    if(previous.has(f))assert.ok(p.distanceTo(previous.get(f))<.1);previous.set(f,p.clone());
  }}
});

test('fitted courtyard paving reaches curved shores and the temple, with continuous grout under joints',async()=>{
  const {Group,Raycaster,Vector3}=await import('three'),{buildCourtyardPaving}=await import('../public/courtyard-paving.mjs');
  const group=new Group();buildCourtyardPaving(group);group.updateMatrixWorld(true);const ray=new Raycaster();
  for(const [x,z] of [[19.2,-10.2],[-15.7,10.1],[-29.6,.9],[-49.8,17],[49,27],[19.2,-10],[-50,17],[6.9,7.4]]){
    ray.set(new Vector3(x,2,z),new Vector3(0,-1,0));assert.ok(ray.intersectObjects(group.children).length,`finished paving at ${x},${z}`);
  }
  for(const [x,z] of [[-29.6,10.1],[0,-13],[world.riverX(505)/10-50,15.5]]){
    ray.set(new Vector3(x,2,z),new Vector3(0,-1,0));assert.equal(ray.intersectObjects(group.children).length,0,'paving clears water and the hall');
  }
});
