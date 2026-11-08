const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Server } = require('socket.io');
const { validPosition,canWalkBetween,groundHeight,SOFA_SEATS,SOFA_REACH, URN, WORLD,WALK_BOUNDS } = require('./public/world');
const AvatarConfig = require('./public/avatar-config');
const {ROOM_CAPACITY}=require('./public/world');
const {BROOM_RACKS,LEAF_PATCHES,PICKUP_RANGE,SWEEP_RANGE,SWEEP_DURATION,LEAF_RESPAWN,HIT_RANGE,HIT_DURATION,HIT_CONTACT,HIT_COOLDOWN}=require('./public/sweeping');

function createTemple(options = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 4096 });
  const players = new Map();
  const swingTimers=new Set();
  const incense = new Map();
  const messages = [];
  const leafPatches=new Map(LEAF_PATCHES.map(p=>[p.id,{...p,availableAt:0}]));
  const password = options.password ?? process.env.ROOM_PASSWORD;
  const now = options.now || Date.now;
  const ttl = options.incenseTTL || 300000;
  let dirty = false;
  const publicPlayer = p => ({ id: p.id, name: p.name, character: p.character, color: p.color, avatar: p.avatar, x: p.x, y: p.y, action: p.action,sofaSeatId:p.sofaSeatId,hasBroom:p.hasBroom,blessings:p.blessings });
  const publicIncense = i => ({ id: i.id, owner: i.owner, slot: i.slot, ttl: Math.max(0, i.expiresAt - now()) });
  const publicPatch=p=>({id:p.id,x:p.x,y:p.y,tree:p.tree,readyIn:Math.max(0,p.availableAt-now())});
  app.disable('x-powered-by');
  app.get('/api/status', (_, res) => res.json({ online: players.size, capacity: ROOM_CAPACITY, passwordRequired: !!password }));
  app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build')));
  app.use('/picture', express.static(path.join(__dirname, 'picture'), { index: false, dotfiles: 'deny' }));
  app.use(express.static(path.join(__dirname, 'public')));

  io.on('connection', socket => {
    let lastMove = 0;
    let lastChat = -Infinity;
    socket.on('join', input => {
      if (players.has(socket.id)) return;
      if (!input || typeof input !== 'object' || typeof input.name !== 'string' || !Number.isInteger(input.character) || input.character < 0 || input.character > 1) return socket.emit('join-error', 'bad-input');
      const name = Array.from(input.name.normalize('NFC').replace(/[\p{C}<>]/gu, '').replace(/\s+/g, ' ').trim()).slice(0, 14).join('');
      if (!name) return socket.emit('join-error', 'bad-input');
      if (password && input.password !== password) return socket.emit('join-error', 'bad-password');
      if (players.size >= ROOM_CAPACITY) return socket.emit('join-error', 'full');
      const occupied = new Set([...players.values()].map(p => p.spawn));
      const spawn = Array.from({length:ROOM_CAPACITY},(_,i)=>i).find(n => !occupied.has(n));
      const code=AvatarConfig.characterCode(input.characterCode);
      if(code && code!=='tom')return socket.emit('join-error','bad-character-code');
      const avatar = AvatarConfig.withCharacterCode(AvatarConfig.normalize(input.avatar, input.character, input.color),code);
      const p = { id: socket.id, name, character: avatar.gender === 'female' ? 1 : 0, color: avatar.colors.shirt, avatar, x: 450 + spawn * 25, y: 605, action: 'stand',sofaSeatId:null, bowUntil: 0, spawn,hasBroom:false,blessings:0,sweepUntil:0,lastHit:-Infinity };
      players.set(socket.id, p);
      socket.join('temple');
      socket.emit('joined', { id: p.id, players: [...players.values()].map(publicPlayer), incense: [...incense.values()].map(publicIncense),leaves:[...leafPatches.values()].map(publicPatch) });
      socket.to('temple').emit('player-joined', publicPlayer(p));
      socket.emit('chat-history',messages);
      io.emit('presence', { online: players.size, capacity: ROOM_CAPACITY });
      dirty = true;
    });
    socket.on('chat-send', input => {
      const p=players.get(socket.id);
      if(!p||typeof input!=='string')return;
      const text=input.normalize('NFC').replace(/[\p{C}]/gu,' ').replace(/\s+/g,' ').trim();
      if(!text||Array.from(text).length>300)return socket.emit('chat-error','invalid');
      const time=now();
      if(time-lastChat<800)return socket.emit('chat-error','rate-limit');
      lastChat=time;
      const message={id:randomUUID(),playerId:p.id,name:p.name,text,time};
      messages.push(message);if(messages.length>50)messages.shift();
      io.to('temple').emit('chat-message',message);
    });
    socket.on('move', input => {
      const p = players.get(socket.id);
      const time = now();
      if (!p || !input || typeof input.x !== 'number' || typeof input.y !== 'number' || !Number.isFinite(input.x) || !Number.isFinite(input.y) || time - lastMove < 35) return;
      if (p.bowUntil > time || p.sweepUntil > time || p.sofaSeatId) return;
      const x = Math.max(WALK_BOUNDS.left, Math.min(WALK_BOUNDS.right, input.x));
      const y = Math.max(WALK_BOUNDS.rear, Math.min(WALK_BOUNDS.front, input.y));
      if (!validPosition(x, y)||!canWalkBetween(p.x,p.y,x,y)) return;
      const maxDistance = 230 * Math.min((time - (lastMove || time - 50)) / 1000, 1) + 14;
      if (Math.hypot(x - p.x, y - p.y) > maxDistance) return;
      lastMove = time;
      p.x = x; p.y = y; p.action = 'stand'; dirty = true;
    });
    socket.on('action', action => {
      const p = players.get(socket.id);
      if (!p || !['stand', 'sit', 'bow'].includes(action) || p.bowUntil > now() || p.sweepUntil > now()) return;
      if(p.sofaSeatId){
        if(action!=='stand')return;
        const seat=SOFA_SEATS.find(s=>s.id===p.sofaSeatId);p.x=seat.approachX;p.y=seat.approachY;p.sofaSeatId=null;p.action='stand';p.bowUntil=now()+500;
        io.to('temple').emit('sofa-changed',{id:p.id,x:p.x,y:p.y,sofaSeatId:null,action:'stand'});dirty=true;return;
      }
      p.action = action;
      p.bowUntil = action === 'bow' ? now() + 1500 : 0;
      dirty = true;
    });
    socket.on('sit-sofa',input=>{
      const p=players.get(socket.id);if(!p)return;
      const fail=code=>socket.emit('sofa-error',code),seat=SOFA_SEATS.find(s=>s.id===input?.seatId),time=now();
      if(!seat)return fail('invalid');
      if(p.sofaSeatId||p.action!=='stand'||p.bowUntil>time||p.sweepUntil>time)return fail('busy');
      if(Math.hypot(p.x-seat.approachX,p.y-seat.approachY)>SOFA_REACH||!canWalkBetween(p.x,p.y,seat.approachX,seat.approachY))return fail('far');
      if([...players.values()].some(other=>other.sofaSeatId===seat.id))return fail('occupied');
      p.x=seat.x;p.y=seat.y;p.sofaSeatId=seat.id;p.action='sit';p.bowUntil=time+500;
      io.to('temple').emit('sofa-changed',{id:p.id,x:p.x,y:p.y,sofaSeatId:seat.id,action:'sit'});dirty=true;
    });
    socket.on('plant-incense', () => {
      const p = players.get(socket.id);
      if (!p) return;
      const time=now(),fail = code => socket.emit('incense-error', code);
      if(p.bowUntil>time||p.sweepUntil>time||p.sofaSeatId)return fail('busy');
      if (Math.hypot(p.x - URN.x, p.y - URN.y) > 80) return fail('far');
      if ([...incense.values()].filter(i => i.owner === p.id).length >= 3) return fail('limit');
      if (incense.size >= 12) return fail('full');
      const slots = new Set([...incense.values()].map(i => i.slot));
      const item = { id: randomUUID(), owner: p.id, slot: Array.from({ length: 12 }, (_, i) => i).find(i => !slots.has(i)), expiresAt: now() + ttl };
      incense.set(item.id, item); p.action = 'bow'; p.bowUntil = time + 1500;
      io.to('temple').emit('incense-added', publicIncense(item)); dirty = true;
    });
    socket.on('broom',input=>{
      const p=players.get(socket.id);if(!p)return;
      const rack=BROOM_RACKS.find(r=>r.id===input?.rackId);
      if(typeof input?.take!=='boolean'||!rack||Math.hypot(p.x-rack.x,p.y-rack.y)>PICKUP_RANGE)return socket.emit('sweep-error','rack');
      if(p.bowUntil>now()||p.sweepUntil>now()||p.action!=='stand')return socket.emit('sweep-error','busy');
      p.hasBroom=input.take;io.to('temple').emit('broom-changed',{id:p.id,hasBroom:p.hasBroom});
    });
    socket.on('sweep',input=>{
      const p=players.get(socket.id);if(!p)return;
      const fail=code=>socket.emit('sweep-error',code),time=now();
      if(!p.hasBroom)return fail('broom');
      if(p.bowUntil>time||p.sweepUntil>time||p.action!=='stand')return fail('busy');
      const patch=typeof input?.patchId==='string'?leafPatches.get(input.patchId):null;
      if(!patch||patch.availableAt>time)return fail('empty');
      if(Math.hypot(p.x-patch.x,p.y-patch.y)>SWEEP_RANGE)return fail('far');
      // Consume once before broadcasting: two players cannot score on the same leaves.
      patch.availableAt=time+LEAF_RESPAWN;p.blessings++;p.sweepUntil=time+SWEEP_DURATION;
      io.to('temple').emit('swept',{id:p.id,blessings:p.blessings,patch:publicPatch(patch)});
    });
    socket.on('broom-hit',input=>{
      const p=players.get(socket.id);if(!p)return;
      const time=now(),fail=code=>socket.emit('hit-error',code);
      if(!p.hasBroom)return fail('broom');
      if(p.action!=='stand'||p.bowUntil>time||p.sweepUntil>time)return fail('busy');
      if(time-p.lastHit<HIT_COOLDOWN)return fail('cooldown');
      if(typeof input?.heading!=='number'||!Number.isFinite(input.heading))return fail('direction');
      const heading=((input.heading%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
      p.lastHit=time;p.sweepUntil=time+HIT_DURATION;
      io.to('temple').emit('broom-swing',{id:p.id,heading,duration:HIT_DURATION});
      // Resolve contact at the forward part of the swing, so another player can dodge.
      const timer=setTimeout(()=>{
        swingTimers.delete(timer);if(players.get(p.id)!==p)return;
        let target=null,nearest=HIT_RANGE;
        for(const other of players.values()){
          if(other.id===p.id)continue;
          const dx=other.x-p.x,dy=other.y-p.y,distance=Math.hypot(dx,dy);
          if(distance>nearest||dx*Math.sin(heading)+dy*Math.cos(heading)<distance*Math.SQRT1_2)continue;
          let clear=true;
          for(let i=0;i<=10;i++){
            const t=i/10,x=p.x+dx*t,y=p.y+dy*t;
            if(!validPosition(x,y)||Math.abs(groundHeight(x,y)-groundHeight(p.x,p.y))>.55){clear=false;break;}
          }
          if(clear){target=other;nearest=distance;}
        }
        if(target)p.blessings-=1;
        io.to('temple').emit('broom-hit',{id:p.id,targetId:target?.id??null,blessings:p.blessings});
      },HIT_CONTACT);
      swingTimers.add(timer);
    });
    socket.on('disconnect', () => {
      if (!players.delete(socket.id)) return;
      io.to('temple').emit('player-left', { id: socket.id });
      if (!players.size){incense.clear();messages.length=0;for(const p of leafPatches.values())p.availableAt=0;}
      io.emit('presence', { online: players.size, capacity: ROOM_CAPACITY });
      dirty = true;
    });
  });
  const stateTimer = setInterval(() => {
    for (const p of players.values()) if (p.action === 'bow' && now() >= p.bowUntil) { p.action = 'stand'; dirty = true; }
    if (!dirty) return;
    // Appearance is sent on joining; moving packets stay small on mobile data.
    io.to('temple').emit('state', [...players.values()].map(({id,x,y,action,sofaSeatId}) => ({id,x,y,action,sofaSeatId}))); dirty = false;
  }, 50);
  const incenseTimer = setInterval(() => {
    for (const [id, i] of incense) if (now() >= i.expiresAt) { incense.delete(id); io.to('temple').emit('incense-removed', { id }); }
  }, 1000);
  server.on('close', () => { clearInterval(stateTimer); clearInterval(incenseTimer);for(const timer of swingTimers)clearTimeout(timer); });
  return { app, server, io, players, incense,leafPatches };
}
if (require.main === module) {
  const { server } = createTemple();
  const port = process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', () => console.log(`Chùa Online đang mở tại http://localhost:${port}`));
}
module.exports = { createTemple };
