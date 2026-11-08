const {test}=require('node:test');
const assert=require('node:assert/strict');
const world=require('../public/world');

test('the rear coast slopes to the sea and the restored visible wall blocks direct crossings',()=>{
  const {validPosition,groundHeight,coastShoreZ,COAST}=world,x=200,shore=coastShoreZ(-30);
  let previous=0;
  for(let z=-20;z>=shore+.5;z-=.1){
    const y=z*10+350,h=groundHeight(x,y);
    assert.equal(validPosition(x,y),Math.abs(z+43)>=.9,`wall clearance at z=${z}`);
    assert.ok(h<=previous+1e-8&&previous-h<.03,'continuous downhill grade');previous=h;
  }
  assert.ok(previous<COAST.waterY+.1);
  assert.equal(validPosition(x,(shore-1)*10+350),false,'open sea is not a walking surface');
  assert.equal(validPosition(850,-150),false,'mountain remains solid');
  for(const [x,y] of [[NaN,0],[0,Infinity],[-1000,0],[200,-10000]])assert.equal(validPosition(x,y),false);
});

test('tap routes reach negative beach coordinates without cutting through the hall, pond or river',async()=>{
  const {findWalkingRoute}=await import('../public/navigation.mjs');
  for(const [sx,sy,ex,ey] of [[450,605,200,-260],[200,170,200,-260],[200,-260,450,605],[620,510,850,510]]){
    const route=findWalkingRoute(sx,sy,ex,ey,world.validPosition,world.WALK_BOUNDS);
    assert.ok(route,`route from ${sx},${sy} to ${ex},${ey}`);
    let previous={x:sx,y:sy};
    for(const point of route){assert.equal(world.canWalkBetween(previous.x,previous.y,point.x,point.y),true);previous=point;}
    assert.deepEqual(previous,{x:ex,y:ey});
  }
});

test('beach rendering uses the same ground height as walking and leaves the ocean horizon open',async t=>{
  const original=global.window;global.window=world;t.after(()=>global.window=original);
  const {Group,Raycaster,Vector3}=await import('three'),{Seaside}=await import('../public/seaside.mjs');
  const coast=new Seaside(new Group());coast.root.updateMatrixWorld(true);const ray=new Raycaster();
  for(const [x,z] of [[-30,-48],[-30,-60],[-12,-57],[8,-62]]){
    ray.set(new Vector3(x,5,z),new Vector3(0,-1,0));const hit=ray.intersectObject(coast.sand)[0];
    assert.ok(hit);assert.ok(Math.abs(hit.point.y+.025-world.groundHeight(x*10+500,z*10+350))<.006);
  }
  assert.equal(coast.boats.length,5);const before=coast.boats[0].root.position.y;coast.update(1);assert.notEqual(coast.boats[0].root.position.y,before);
  coast.water.geometry.computeBoundingBox();const bounds=coast.water.geometry.boundingBox;
  assert.ok(bounds.min.x< -2000&&bounds.max.x>2000&&bounds.min.z< -2000&&bounds.max.z>2000,'the sea reaches the horizon on all four sides');
  assert.ok(coast.boats.every(b=>world.coastProgress(b.x,b.z)>1),'boats float offshore around the island');
  for(const [x,z] of [[-68,0],[68,0],[0,55]]){
    ray.set(new Vector3(x,5,z),new Vector3(0,-1,0));const hit=ray.intersectObject(coast.sand)[0];
    assert.ok(hit,'sand continues around each side');assert.ok(Math.abs(hit.point.y+.025-world.coastHeight(x,z))<.006);
  }
});

test('island beaches are reachable on four sides without walking through enclosure walls or into open sea',async()=>{
  const {findWalkingRoute}=await import('../public/navigation.mjs');
  const point=(x,z)=>({x:x*10+500,y:z*10+350});
  let previous=point(-30,-60);
  for(const [x,z] of [[-68,0],[0,55],[68,0],[-30,-60]]){
    const next=point(x,z),route=findWalkingRoute(previous.x,previous.y,next.x,next.y,world.validPosition,world.WALK_BOUNDS);
    assert.ok(route,`reachable island shore at ${x},${z}`);
    for(const step of route){assert.ok(world.canWalkBetween(previous.x,previous.y,step.x,step.y));previous=step;}
    assert.equal(world.onCoast(next.x,next.y),true);
  }
  assert.equal(world.canWalkBetween(500,780,500,850),true,'the main gate opens onto the front beach');
  assert.equal(world.validPosition(world.riverX(900),900),true,'the old river collision does not continue invisibly across the front beach');
  assert.equal(world.canWalkBetween(-40,350,-120,350),false,'the visible west wall blocks a direct crossing');
  for(const [x,z] of [[-95,0],[95,0],[0,90],[0,-110]])assert.equal(world.validPosition(x*10+500,z*10+350),false,'deep sea is not walkable');
});

test('the server accepts walking beyond y=125 and zero, and rejects continuing into the sea',async t=>{
  const {createTemple}=require('../server'),{io}=require('socket.io-client');let now=10000;
  const temple=createTemple({now:()=>now});await new Promise(resolve=>temple.server.listen(0,'127.0.0.1',resolve));
  const socket=io(`http://127.0.0.1:${temple.server.address().port}`,{transports:['websocket'],forceNew:true});
  t.after(async()=>{socket.disconnect();await new Promise(resolve=>temple.io.close(resolve));});
  const event=name=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Timed out: ${name}`)),2000);socket.once(name,data=>{clearTimeout(timer);resolve(data);});});
  await event('connect');const joined=event('joined');socket.emit('join',{name:'Coast',character:0});await joined;
  const p=temple.players.get(socket.id);p.x=-180;p.y=130;
  for(let y=120;y>=-90;y-=30){now+=200;const state=event('state');socket.emit('move',{x:-180,y});await state;assert.equal(p.y,y,'authoritative movement is not clamped to the old courtyard');}
  p.x=200;p.y=-60;now+=250;socket.emit('move',{x:200,y:-100});await new Promise(resolve=>setTimeout(resolve,80));assert.equal(p.y,-60,'the restored rear wall blocks server-side crossings too');
  p.y=-100;
  for(let y=-110;y>=-300;y-=30){now+=200;const state=event('state');socket.emit('move',{x:200,y});await state;assert.equal(p.y,y);}
  const safe=world.coastShoreZ(-30)*10+350+5;now+=250;let state=event('state');socket.emit('move',{x:200,y:safe});await state;assert.equal(p.y,safe);
  now+=250;socket.emit('move',{x:200,y:safe-20});await new Promise(resolve=>setTimeout(resolve,80));assert.equal(p.y,safe,'cannot walk offshore');
  for(const [sx,sz,x,z] of [[-67,0,-68,0],[67,0,68,0],[0,54,0,55]]){
    p.x=sx*10+500;p.y=sz*10+350;now+=250;state=event('state');socket.emit('move',{x:x*10+500,y:z*10+350});await state;
    assert.equal(p.x,x*10+500);assert.equal(p.y,z*10+350,'the new island shore is accepted beyond the old map bounds');
  }
});
