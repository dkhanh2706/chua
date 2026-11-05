const { test } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const { createTemple } = require('../server');
const { validPosition,canWalkBetween,groundHeight,riverX,bridgeHeight,LOTUS_SEATS,lotusAt,lotusHeight,SOFA_LAYOUT,SOFA_SEATS,HALL_COLUMNS } = require('../public/world');
const {BROOM_RACKS,LEAF_PATCHES,LEAF_RESPAWN,SWEEP_DURATION,HIT_RANGE,HIT_DURATION,HIT_COOLDOWN}=require('../public/sweeping');

const event = (socket, name) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { socket.off(name, handler); reject(new Error(`Timed out: ${name}`)); }, 3000);
  const handler = data => { clearTimeout(timeout); resolve(data); };
  socket.once(name, handler);
});
async function fixture(t, options = {}) {
  const temple = createTemple(options);
  await new Promise(resolve => temple.server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${temple.server.address().port}`;
  const clients = [];
  t.after(async () => { clients.forEach(s => s.disconnect()); await new Promise(resolve => temple.io.close(resolve)); });
  async function client() { const s = io(url, { transports: ['websocket'], forceNew: true }); clients.push(s); await event(s, 'connect'); return s; }
  async function join(s, data = {}) { const result = event(s, 'joined'); s.emit('join', { name: 'An', character: 0, ...data }); return result; }
  return { ...temple, url, client, join };
}

test('brooms require a nearby rack; sweeping consumes actual nearby leaves and awards exactly one point',async t=>{
  let clock=100000;const f=await fixture(t,{now:()=>clock}),s=await f.client();await f.join(s);const p=f.players.get(s.id),patch=LEAF_PATCHES[0],rack=BROOM_RACKS[0];
  assert.ok([...BROOM_RACKS,...LEAF_PATCHES].every(p=>validPosition(p.x,p.y)));
  assert.equal(LEAF_RESPAWN,3000);
  let error=event(s,'sweep-error');s.emit('sweep',{patchId:patch.id});assert.equal(await error,'broom');
  error=event(s,'sweep-error');s.emit('broom',{rackId:rack.id,take:true});assert.equal(await error,'rack');
  p.x=rack.x;p.y=rack.y;
  let changed=event(s,'broom-changed');s.emit('broom',{rackId:rack.id,take:true});assert.deepEqual(await changed,{id:s.id,hasBroom:true});
  error=event(s,'sweep-error');s.emit('sweep',{patchId:patch.id,blessings:999});assert.equal(await error,'far');assert.equal(p.blessings,0);
  p.x=patch.x;p.y=patch.y;
  error=event(s,'sweep-error');s.emit('sweep',{patchId:{id:patch.id}});assert.equal(await error,'empty');
  let swept=event(s,'swept');s.emit('sweep',{patchId:patch.id,blessings:999});const result=await swept;assert.equal(result.blessings,1);assert.equal(p.blessings,1);assert.equal(result.patch.readyIn,LEAF_RESPAWN);
  error=event(s,'sweep-error');s.emit('sweep',{patchId:patch.id});assert.equal(await error,'busy');
  s.emit('move',{x:patch.x+10,y:patch.y});s.emit('action','sit');await new Promise(resolve=>setTimeout(resolve,60));assert.equal(p.x,patch.x);assert.equal(p.action,'stand');
  clock+=SWEEP_DURATION+1;error=event(s,'sweep-error');s.emit('sweep',{patchId:patch.id});assert.equal(await error,'empty');assert.equal(p.blessings,1);
  clock+=LEAF_RESPAWN;swept=event(s,'swept');s.emit('sweep',{patchId:patch.id});assert.equal((await swept).blessings,2);
  clock+=SWEEP_DURATION+1;p.x=rack.x;p.y=rack.y;changed=event(s,'broom-changed');s.emit('broom',{rackId:rack.id,take:false});assert.equal((await changed).hasBroom,false);
});

test('two players share cleared leaves, late joins see the cooldown, and an empty courtyard resets the leaves',async t=>{
  let clock=100000;const f=await fixture(t,{now:()=>clock}),a=await f.client(),b=await f.client();await f.join(a);await f.join(b);
  const patch=LEAF_PATCHES[0];for(const s of [a,b])Object.assign(f.players.get(s.id),{x:patch.x,y:patch.y,hasBroom:true});
  const first=event(a,'swept'),seenByOther=event(b,'swept'),rejected=event(b,'sweep-error');a.emit('sweep',{patchId:patch.id});await first;b.emit('sweep',{patchId:patch.id});assert.equal((await seenByOther).id,a.id);assert.equal(await rejected,'empty');
  assert.equal(f.players.get(a.id).blessings,1);assert.equal(f.players.get(b.id).blessings,0);
  const c=await f.client(),joined=await f.join(c);assert.equal(joined.leaves.find(p=>p.id===patch.id).readyIn,LEAF_RESPAWN);assert.equal(joined.players.find(p=>p.id===c.id).blessings,0);
  a.disconnect();b.disconnect();c.disconnect();await new Promise(resolve=>setTimeout(resolve,60));assert.equal(f.players.size,0);assert.equal(f.leafPatches.get(patch.id).availableAt,0);
});

test('free broom swings only penalise a front contact and let other players dodge',async t=>{
  let clock=100000;const f=await fixture(t,{now:()=>clock}),a=await f.client(),b=await f.client();await f.join(a);await f.join(b);
  const p=f.players.get(a.id),q=f.players.get(b.id);
  const reject=async(code,input={heading:Math.PI/2})=>{const result=event(a,'hit-error');a.emit('broom-hit',input);assert.equal(await result,code);};
  const swing=async(heading,afterStart)=>{
    const started=event(a,'broom-swing'),hit=event(a,'broom-hit'),seen=event(b,'broom-hit');
    a.emit('broom-hit',{heading,blessings:999,targetId:b.id});
    const animation=await started;assert.equal(animation.id,a.id);assert.equal(animation.duration,HIT_DURATION);
    afterStart?.();const result=await hit;assert.deepEqual(await seen,result);return result;
  };
  await reject('broom');p.hasBroom=true;await reject('direction',{});await reject('direction',{heading:'east'});
  // The target need not hold a broom. Behind and beside the swing are misses.
  assert.equal(q.hasBroom,false);
  let hit=await swing(-Math.PI/2);assert.equal(hit.targetId,null);assert.equal(p.blessings,0);
  await reject('busy');clock+=HIT_DURATION+1;await reject('cooldown');clock+=HIT_COOLDOWN;
  hit=await swing(0);assert.equal(hit.targetId,null);assert.equal(p.blessings,0);clock+=HIT_COOLDOWN;
  hit=await swing(Math.PI/2);assert.deepEqual(hit,{id:a.id,targetId:b.id,blessings:-1});assert.equal(q.blessings,0);clock+=HIT_COOLDOWN;
  q.x=p.x+HIT_RANGE+1;hit=await swing(Math.PI/2);assert.equal(hit.targetId,null);assert.equal(p.blessings,-1);clock+=HIT_COOLDOWN;
  q.x=p.x+25;hit=await swing(Math.PI/2,()=>{q.y+=100;});assert.equal(hit.targetId,null);assert.equal(p.blessings,-1);clock+=HIT_COOLDOWN;
  Object.assign(p,{x:296,y:230});Object.assign(q,{x:320,y:230});hit=await swing(Math.PI/2);assert.equal(hit.targetId,null);assert.equal(p.blessings,-1);clock+=HIT_COOLDOWN;
  Object.assign(p,{x:450,y:605});Object.assign(q,{x:475,y:605,action:'sit'});hit=await swing(Math.PI/2);assert.equal(hit.targetId,b.id);assert.equal(p.blessings,-2);
  const c=await f.client(),joined=await f.join(c);assert.equal(joined.players.find(p=>p.id===a.id).blessings,-2);
  const unjoined=await f.client();unjoined.emit('broom-hit',{heading:Math.PI/2});await new Promise(resolve=>setTimeout(resolve,40));assert.equal(p.blessings,-2);
});

test('serves application and exposes the configured capacity', async t => {
  const f = await fixture(t);
  const response = await fetch(f.url); assert.equal(response.status, 200); assert.match(await response.text(), /Chùa Online/);
  assert.deepEqual(await (await fetch(`${f.url}/api/status`)).json(), { online: 0, capacity: 5, passwordRequired: false });
});
test('five players share one courtyard; sixth is rejected; departure opens a place', async t => {
  const f = await fixture(t);const clients = [];
  for (let i = 0; i < 5; i++) { const s = await f.client(); clients.push(s); const result = await f.join(s, { name: `Bạn ${i}` }); assert.equal(result.players.length, i + 1); }
  const sixth = await f.client();const full = event(sixth, 'join-error');sixth.emit('join', { name: 'Bạn 6', character: 1 });assert.equal(await full, 'full');
  const left = event(clients[0], 'player-left');const id = clients[4].id;clients[4].disconnect();assert.deepEqual(await left, { id });
  assert.equal((await f.join(sixth)).players.length, 5);
});
test('input validation, Unicode name limit, optional password, and unjoined events', async t => {
  const f = await fixture(t, { password: 'lotus' });const s = await f.client();
  s.emit('move', { x: 500, y: 400 });s.emit('action', 'sit');assert.equal(f.players.size, 0);
  for (const data of [{ name: '  ', character: 0 }, { name: 'An', character: 8 }, { name: 'An', character: '1' }]) {
    const error = event(s, 'join-error');s.emit('join', data);assert.equal(await error, 'bad-input');
  }
  const error = event(s, 'join-error');s.emit('join', { name: 'An', character: 0, password: 'wrong' });assert.equal(await error, 'bad-password');
  const result = await f.join(s, { name: '  <An>   Nhiên Rất Dài  ', password: 'lotus', color: 'url(evil)' });
  assert.equal(result.players[0].name, 'An Nhiên Rất D');assert.equal(result.players[0].color, '#87966f');
  s.emit('action', 'invalid');s.emit('move', { x: null, y: Infinity });
  await new Promise(resolve => setTimeout(resolve, 70));assert.equal(f.players.get(s.id).action, 'stand');
});
test('movement, incense proximity, sequential rituals, limits, late join, expiry and empty cleanup', async t => {
  let clock = 100000;const f = await fixture(t, { now: () => clock, incenseTTL: 300000 });const s = await f.client();await f.join(s);
  let error = event(s, 'incense-error');s.emit('plant-incense');assert.equal(await error, 'far');
  // Traverse the courtyard using valid, server-checked steps.
  for(let y=595;y>=235;y-=10){clock+=100;s.emit('move',{x:450,y});await new Promise(resolve=>setTimeout(resolve,2));}
  for(let x=460;x<=500;x+=10){clock+=100;s.emit('move',{x,y:235});await new Promise(resolve=>setTimeout(resolve,2));}
  await new Promise(resolve=>setTimeout(resolve,65));assert.equal(f.players.get(s.id).y,235);
  s.emit('action','sit');await new Promise(resolve=>setTimeout(resolve,60));assert.equal(f.players.get(s.id).action,'sit');
  let added=event(s,'incense-added');s.emit('plant-incense');const first=await added;assert.equal(first.slot,0);assert.equal(first.ttl,300000);assert.equal(first.expiresAt,undefined);
  error=event(s,'incense-error');s.emit('plant-incense');assert.equal(await error,'busy');
  for(let i=1;i<3;i++){clock+=1500;added=event(s,'incense-added');s.emit('plant-incense');assert.equal((await added).slot,i);}
  clock+=1500;error=event(s,'incense-error');s.emit('plant-incense');assert.equal(await error,'limit');
  const second=await f.client();const result=await f.join(second);assert.equal(result.incense.length,3);assert.ok(result.incense[0].ttl<300000);
  const departed=event(second,'player-left');s.disconnect();await departed;assert.equal(f.incense.size,3);
  const removed=event(second,'incense-removed');clock+=300001;await removed;assert.equal(f.incense.size,0);
  second.disconnect();await new Promise(resolve=>setTimeout(resolve,40));assert.equal(f.players.size,0);
});

test('incense spam creates one stick per completed ritual and cannot cancel the animation lock',async t=>{
  let clock=100000;const f=await fixture(t,{now:()=>clock}),s=await f.client();await f.join(s);
  const p=f.players.get(s.id);Object.assign(p,{x:500,y:235});
  let added=event(s,'incense-added');for(let i=0;i<30;i++)s.emit('plant-incense');await added;
  await new Promise(resolve=>setTimeout(resolve,50));assert.equal(f.incense.size,1);
  s.emit('action','stand');s.emit('move',{x:510,y:235});await new Promise(resolve=>setTimeout(resolve,40));assert.equal(p.action,'bow');assert.equal(p.x,500);
  clock+=1499;let error=event(s,'incense-error');s.emit('plant-incense');assert.equal(await error,'busy');assert.equal(f.incense.size,1);
  clock+=1;added=event(s,'incense-added');for(let i=0;i<30;i++)s.emit('plant-incense');await added;
  await new Promise(resolve=>setTimeout(resolve,40));assert.equal(f.incense.size,2);
  clock+=1500;p.sweepUntil=clock+900;error=event(s,'incense-error');s.emit('plant-incense');assert.equal(await error,'busy');assert.equal(f.incense.size,2);
});
test('navigation blocks the pond and stream, permits crossing the bridge', () => {
  assert.equal(validPosition(204,390),false);assert.equal(validPosition(760,400),false);assert.equal(validPosition(760,505),true);assert.equal(validPosition(500,180),false);assert.equal(validPosition(500,335),true);assert.equal(validPosition(500,400),true);
});

test('lotus seats connect to shore while open water stays blocked and height follows the leaf',()=>{
  assert.equal(LOTUS_SEATS.length,3);
  for(let x=262;x<=365;x++)assert.equal(validPosition(x,451),true);
  for(let y=350;y<=401;y++)assert.equal(validPosition(175,y),true);
  for(let y=501;y<=555;y++)assert.equal(validPosition(175,y),true);
  const distances=LOTUS_SEATS.map((p,i)=>Math.hypot(p.x-LOTUS_SEATS[(i+1)%3].x,p.y-LOTUS_SEATS[(i+1)%3].y));
  assert.ok(Math.max(...distances)-Math.min(...distances)<1);
  assert.equal(validPosition(204,451),false);
  for(const seat of LOTUS_SEATS){
    assert.equal(lotusAt(seat.x,seat.y).id,seat.id);
    for(let angle=0;angle<Math.PI*2;angle+=.05){
      const x=seat.x+Math.cos(angle)*seat.radius*1.025,y=seat.y+Math.sin(angle)*seat.radius*1.025;
      assert.ok(((x-204)/134)**2+((y-451)/86)**2<.85,'whole leaf remains inside the shoreline');
    }
    for(const time of [0,1,5,20])assert.equal(groundHeight(seat.x,seat.y,time),lotusHeight(seat.id,time));
    assert.equal(validPosition(seat.x,seat.y+(seat.y>451?-35:35)),false);
  }
  assert.equal(lotusAt(204,390),null);
});

test('arched bridge rises smoothly from either bank and blocks walking through the rails',()=>{
  const center=riverX(505);
  assert.equal(groundHeight(center,505),1.1);assert.equal(bridgeHeight(center-66,505),.02);assert.equal(bridgeHeight(center+66,505),.02);
  let previous=.02;
  for(let offset=-65;offset<=0;offset++){
    const height=groundHeight(center+offset,505);assert.ok(height>=previous);assert.ok(height-previous<.04);assert.equal(validPosition(center+offset,505),true);assert.ok(Math.abs(height-groundHeight(center-offset,505))<1e-10);previous=height;
  }
  assert.equal(validPosition(center,477),false);assert.equal(validPosition(center,533),false);assert.equal(groundHeight(center+67,505),0);
});
test('3D hall has an open entrance, solid walls and altar, and raised floor', () => {
  assert.equal(validPosition(450,240),true);assert.equal(validPosition(420,240),false);
  assert.equal(validPosition(308,220),false);
  assert.equal(validPosition(335,220),true);
  assert.equal(groundHeight(320,240),1.2);
  assert.equal(validPosition(500,135),false);
  assert.equal(validPosition(500,180),false);
  assert.equal(groundHeight(420,240),1.2);
  assert.equal(groundHeight(500,400),0);
  assert.ok(groundHeight(500,280)>0&&groundHeight(500,280)<1.2);
});

test('sofas and columns block walking; reserved sofa seats synchronise and release safely',async t=>{
  for(const sofa of SOFA_LAYOUT){assert.equal(validPosition(sofa.x,sofa.y),false);assert.equal(canWalkBetween(sofa.x-40,sofa.y,sofa.x+40,sofa.y),false);}
  for(const column of HALL_COLUMNS.filter(c=>c.y>=125)){assert.equal(validPosition(column.x,column.y),false);assert.equal(canWalkBetween(column.x-12,column.y,column.x+12,column.y),false);}
  for(const seat of SOFA_SEATS)assert.equal(validPosition(seat.approachX,seat.approachY),true);
  let clock=100000;const f=await fixture(t,{now:()=>clock}),a=await f.client(),b=await f.client();await f.join(a);await f.join(b);
  const seat=SOFA_SEATS[1],p=f.players.get(a.id),q=f.players.get(b.id);
  let error=event(a,'sofa-error');a.emit('sit-sofa',{seatId:seat.id});assert.equal(await error,'far');
  Object.assign(p,{x:seat.approachX,y:seat.approachY});Object.assign(q,{x:seat.approachX,y:seat.approachY});
  const changed=event(a,'sofa-changed'),seen=event(b,'sofa-changed');a.emit('sit-sofa',{seatId:seat.id});const seated=await changed;assert.deepEqual(await seen,seated);assert.equal(p.sofaSeatId,seat.id);assert.equal(p.action,'sit');assert.equal(p.x,seat.x);
  error=event(b,'sofa-error');b.emit('sit-sofa',{seatId:seat.id});assert.equal(await error,'occupied');
  a.emit('move',{x:450,y:235});await new Promise(resolve=>setTimeout(resolve,40));assert.equal(p.x,seat.x);
  const c=await f.client();assert.equal((await f.join(c)).players.find(p=>p.id===a.id).sofaSeatId,seat.id);
  clock+=501;let left=event(a,'sofa-changed');const sawLeave=event(b,'sofa-changed');a.emit('action','stand');await left;await sawLeave;assert.equal(p.sofaSeatId,null);assert.equal(p.y,seat.approachY);assert.equal(validPosition(p.x,p.y),true);
  const occupied=event(b,'sofa-changed');b.emit('sit-sofa',{seatId:seat.id});await occupied;assert.equal(q.sofaSeatId,seat.id);b.disconnect();
  clock+=501;left=event(a,'sofa-changed');a.emit('sit-sofa',{seatId:seat.id});await left;assert.equal(p.sofaSeatId,seat.id);
  clock+=501;left=event(a,'sofa-changed');a.emit('action','stand');await left;clock+=501;
  a.emit('move',{x:p.x,y:p.y});await new Promise(resolve=>setTimeout(resolve,40));clock+=1000;
  a.emit('move',{x:seat.x,y:SOFA_LAYOUT[0].y+25});await new Promise(resolve=>setTimeout(resolve,50));assert.equal(p.y,seat.approachY,'cannot jump through the sofa even with a delayed movement packet');
});
test('custom appearance is sanitized, broadcast to current players, and included for late joiners',async t=>{
  const f=await fixture(t),first=await f.client();await f.join(first,{name:'An'});
  const second=await f.client(),notice=event(first,'player-joined');
  const custom={gender:'female',shirt:'short',pants:'wide',shoes:'sneakers',hair:'braids',necklace:true,hairAccessory:'clip',colors:{shirt:'#123abc',pants:'#345678',shoes:'#566778',shoeTrim:'#ccddee',hair:'#332244',hairTie:'#11ff22',skin:'#c88a60',necklace:'#d4ae56',hairAccessory:'#fa4321'}};
  const joined=await f.join(second,{name:'Tâm',character:1,avatar:custom});
  assert.deepEqual((await notice).avatar,custom);assert.deepEqual(joined.players.find(p=>p.id===second.id).avatar,custom);
  const third=await f.client();assert.deepEqual((await f.join(third)).players.find(p=>p.id===second.id).avatar,custom);
  const state=event(first,'state');second.emit('action','sit');const moving=await state;assert.ok(JSON.stringify(moving).length<500);assert.ok(moving.every(p=>!('avatar'in p)));
});
