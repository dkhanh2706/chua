import { TempleView,drawPortrait } from './scene.js';
import { Customizer } from './customizer.mjs';
import { easeVelocity } from './locomotion.mjs';
(() => {
  const $=id=>document.getElementById(id);
  const sound=new TempleSound();
  let muted=false;try{muted=localStorage.getItem('temple-muted')==='true';}catch{}
  let socket=null,myId=null,active=false,joining=false;
  let target=null,lastFrame=performance.now(),lastSent=0,lastPosition=null,localBowUntil=0,incensePending=false,sofaPending=false,lastHit=-Infinity;
  let toastTimer,pendingJoin,joinTimer,uiTimer=0;
  const players=new Map(),items=new Map(),keys=new Set(),leafPatches=new Map();
  const {nearestRack,nearestLeaves,SWEEP_DURATION,HIT_DURATION,HIT_COOLDOWN}=window.TempleSweeping;
  const joystickInput={x:0,y:0,pointer:null,bounds:null};
  const velocity={x:0,y:0};
  function clearMovement(immediate=true){keys.clear();joystickInput.x=0;joystickInput.y=0;joystickInput.pointer=null;joystickInput.bounds=null;if(immediate){velocity.x=0;velocity.y=0;}$('joystick').style.setProperty('--jx','0px');$('joystick').style.setProperty('--jy','0px');}
  const gameCanvas=$('canvas'),previewHost=$('preview').parentElement,gameHost=gameCanvas.parentElement;
  $('preview').replaceWith(gameCanvas);
  let view;
  try{view=new TempleView(gameCanvas);}catch(error){$('join-error').textContent='Thiết bị chưa mở được đồ họa 3D. Hãy bật tăng tốc đồ họa hoặc thử Chrome / Edge mới nhé.';$('join-button').disabled=true;console.error(error);}
  const customizer=new Customizer(view);
  sound.onBird=call=>view?.garden?.sing(call.id,performance.now()/1000+call.delay,call.duration);
  gameCanvas.addEventListener('render-error',()=>toast('Đồ họa 3D bị gián đoạn. Hãy tải lại trang để vào lại nhé.'));
  gameCanvas.addEventListener('avatar-step',event=>sound.footstep(event.detail.surface));
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
  $('share-link').onclick=async()=>{
    const link=new URL('/',location.href).href;
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(link);
      else{const input=document.createElement('textarea');input.value=link;input.style.cssText='position:fixed;top:0;left:-9999px';document.body.append(input);input.select();const copied=document.execCommand('copy');input.remove();if(!copied)throw new Error('copy');}
      toast(['localhost','127.0.0.1','[::1]'].includes(location.hostname)?'Đã sao chép. Để mời bạn, hãy mở bằng IP cùng Wi-Fi hoặc link website công khai.':'Đã sao chép link · Mời bạn vào cùng sân, tối đa 5 người.');
    }catch{toast(`Link mời bạn: ${link}`);}
  };
  function soundUI(){
    $('sound').innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5 6 9H3v6h3l5 4V5Z"/>${muted?'<path d="m16 9 6 6m0-6-6 6"/>':'<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'}</svg>`;
    $('sound').setAttribute('aria-label',muted?'Bật âm thanh':'Tắt âm thanh');$('sound').setAttribute('aria-pressed',String(!muted));
  }
  async function toggleSound(){muted=!muted;try{localStorage.setItem('temple-muted',String(muted));}catch{}await sound.start(!muted);soundUI();toast(muted?'Âm thanh đã tắt.':'Lắng nghe tiếng suối và tiếng chim.');}
  soundUI();$('sound').onclick=toggleSound;
  $('name').addEventListener('input',()=>{const chars=Array.from($('name').value);if(chars.length>14)$('name').value=chars.slice(0,14).join('');$('name-count').textContent=`${Array.from($('name').value).length} / 14`;$('join-error').textContent='';});
  function presence(n){$('presence-text').textContent=n?`${n} người đang trong sân`:'Sân chùa đang mở';}
  async function status(){try{const res=await fetch('/api/status');if(!res.ok)return;const data=await res.json();presence(data.online);$('password-wrap').hidden=!data.passwordRequired;}catch{}}
  status();const statusTimer=setInterval(()=>{if(!active)status();},15000);
  const errorMessages={'full':'Sân chùa đã đủ 5 người. Bạn ghé lại sau một chút nhé.','bad-password':'Mật khẩu chưa đúng. Bạn thử lại nhé.','bad-input':'Bạn nhập tên và chọn một nhân vật nhé.'};
  function setJoining(value){joining=value;$('join-button').disabled=value;$('join-button').firstElementChild.textContent=value?'Đang mở cổng…':'Ghé vào chùa';if(!value)clearTimeout(joinTimer);}
  function connect(){
    if(socket)return;
    socket=io({autoConnect:false,reconnection:true,reconnectionAttempts:5,timeout:8000});
    socket.on('connect',()=>{if(joining&&pendingJoin)socket.emit('join',pendingJoin);});
    socket.on('presence',p=>presence(p.online));
    socket.on('joined',data=>{
      myId=data.id;players.clear();items.clear();for(const p of data.players)players.set(p.id,{...p,tx:p.x,ty:p.y});for(const item of data.incense)items.set(item.id,{...item,end:performance.now()+item.ttl});
      active=true;setJoining(false);target=null;clearMovement();lastPosition=null;localBowUntil=0;incensePending=false;sofaPending=false;lastHit=-Infinity;
      gameHost.prepend(gameCanvas);document.body.classList.add('playing');view.setActive(true);setCamera('overhead');
      leafPatches.clear();for(const patch of data.leaves||[])leafPatches.set(patch.id,{...patch,readyAt:performance.now()+patch.readyIn});
      view.yardCare.setPatches([...leafPatches.values()]);updateYardUI(players.get(myId),performance.now());
      sound.setGardenSources(view.garden.audioSources);
      $('welcome').hidden=true;$('welcome-footer').hidden=true;$('game').hidden=false;$('connection-dialog').close();$('canvas').focus({preventScroll:true});updatePeople();toast(view.mobile?'Bạn đã về đến. Kéo cần để đi, vuốt để nhìn quanh.':'Bạn đã về đến. Kéo để ngắm cảnh, WASD để bước đi.');
    });
    socket.on('join-error',code=>{setJoining(false);$('join-error').textContent=errorMessages[code]||'Chưa thể vào sân chùa.';if($('connection-dialog').open){$('connection-dialog').close();showHome();$('join-error').textContent=errorMessages[code]||'Chưa thể vào sân chùa.';}});
    socket.on('player-joined',p=>{players.set(p.id,{...p,tx:p.x,ty:p.y});updatePeople();toast(`${p.name} vừa ghé vào sân chùa.`);});
    socket.on('player-left',p=>{players.delete(p.id);updatePeople();});
    socket.on('sofa-changed',data=>{
      const p=players.get(data.id);if(!p)return;Object.assign(p,{x:data.x,y:data.y,tx:data.x,ty:data.y,action:data.action,sofaSeatId:data.sofaSeatId,ritual:null,moving:false});
      if(data.id===myId){sofaPending=false;if(data.sofaSeatId){target=null;clearMovement();}localBowUntil=performance.now()+500;lastPosition={x:p.x,y:p.y};}
      updatePeople();
    });
    socket.on('sofa-error',code=>{sofaPending=false;toast({occupied:'Chỗ này đã có người ngồi. Bạn chọn đệm bên cạnh nhé.',far:'Tới phía trước ghế để ngồi nhé.',busy:'Đợi hoàn thành động tác rồi ngồi nhé.'}[code]||'Bạn chọn một chỗ trên sofa nhé.');});
    socket.on('state',state=>{let change=false;for(const p of state){const current=players.get(p.id);if(!current)continue;const oldAction=current.action;current.tx=p.x;current.ty=p.y;if(p.id!==myId){current.action=p.action;current.moving=Math.hypot(current.x-p.x,current.y-p.y)>1;}else if(performance.now()>=localBowUntil&&current.action==='bow'&&p.action==='stand')current.action='stand';if(oldAction!==current.action)change=true;}if(change)updatePeople();});
    socket.on('incense-added',i=>{items.set(i.id,{...i,end:performance.now()+i.ttl});const p=players.get(i.owner);if(p){p.ritual={kind:'incense',start:performance.now(),fromSit:p.action==='sit'};p.action='bow';if(i.owner===myId){incensePending=false;localBowUntil=performance.now()+1500;target=null;clearMovement();}sound.bell(Math.hypot((players.get(myId)?.x||500)-URN.x,(players.get(myId)?.y??URN.y)-URN.y));}updatePeople();toast(i.owner===myId?'Một nén hương, một chút lòng thành.':'Một nén hương vừa được thắp.');});
    socket.on('incense-removed',i=>{items.delete(i.id);updatePeople();});
    socket.on('broom-changed',data=>{
      const p=players.get(data.id);if(!p)return;p.hasBroom=data.hasBroom;
      if(data.id===myId){updateYardUI(p,performance.now());toast(p.hasBroom?'Đã lấy chổi. Tới gần đám lá rồi chạm Quét lá.':'Đã trả chổi lên giá.');}
    });
    socket.on('swept',data=>{
      const p=players.get(data.id),now=performance.now();if(!p)return;
      p.blessings=data.blessings;p.sweepStart=now/1000;
      leafPatches.set(data.patch.id,{...data.patch,readyAt:now+data.patch.readyIn});view.yardCare.setPatches([...leafPatches.values()]);
      if(data.id===myId){target=null;clearMovement();localBowUntil=now+SWEEP_DURATION;updateYardUI(p,now);$('blessing-score').animate([{transform:'scale(1.22)',color:'#b09344'},{transform:'scale(1)',color:'#7c7845'}],{duration:500});toast('Sân sạch thêm một chút · +1 điểm phước lành');}
    });
    socket.on('sweep-error',code=>toast({rack:'Tới gần một giá chổi để lấy hoặc trả chổi nhé.',broom:'Bạn cần lấy chổi ở giá trước nhé.',busy:'Đợi hoàn thành động tác rồi quét tiếp nhé.',empty:'Chỗ này đã sạch lá rồi.',far:'Tới gần đám lá hơn để quét nhé.'}[code]||'Chưa thể quét lá.'));
    socket.on('broom-swing',data=>{
      const p=players.get(data.id),now=performance.now();if(!p)return;
      p.hitStart=now/1000;p.hitHeading=data.heading;
      if(data.id===myId){lastHit=now;localBowUntil=now+HIT_DURATION;target=null;clearMovement();updateYardUI(p,now);}
    });
    socket.on('broom-hit',data=>{
      const p=players.get(data.id),other=players.get(data.targetId),now=performance.now();if(!p)return;
      p.blessings=data.blessings;if(other)other.struckStart=now/1000;
      if(data.id===myId){updateYardUI(p,now);toast(other?`Chổi trúng ${other.name} · −1 phước lành`:'Vung chổi hụt · Không mất phước lành');}
      else if(data.targetId===myId)toast(`${p.name} vừa đánh chổi · Người đánh mất 1 phước lành`);
    });
    socket.on('hit-error',code=>toast({broom:'Bạn cần cầm chổi trước.',busy:'Đợi hoàn thành động tác nhé.',cooldown:'Chờ một chút trước khi vung tiếp.',direction:'Hãy quay về hướng muốn vung chổi.'}[code]||'Chưa thể vung chổi.'));
    socket.on('incense-error',code=>{incensePending=false;toast({far:'Lại gần lư hương trong chính điện nhé.',busy:'Hoàn thành động tác rồi cắm nén tiếp theo nhé.',limit:'Bạn đang có 3 nén hương. Hãy đợi hương tàn.',full:'Lư hương đã đầy. Hãy đợi một chút nhé.'}[code]||'Chưa thể thắp nhang.');});
    socket.on('disconnect',reason=>{incensePending=false;sofaPending=false;clearMovement();target=null;if(active){active=false;$('connection-dialog').showModal();}if(joining){setJoining(false);$('join-error').textContent='Kết nối bị gián đoạn. Bạn thử vào lại nhé.';}});
    socket.on('connect_error',()=>{if(joining){setJoining(false);$('join-error').textContent='Chưa kết nối được với sân chùa. Bạn thử lại nhé.';}});
  }
  function join(){
    if(joining||!view?.ready)return;
    const name=$('name').value.trim();if(!name){$('name').focus();$('join-error').textContent='Bạn cho mình biết tên trước nhé.';return;}
    if(typeof io==='undefined'){$('join-error').textContent='Chưa tải được kết nối. Bạn tải lại trang nhé.';return;}
    pendingJoin={name,character:customizer.gender==='female'?1:0,color:customizer.value.colors.shirt,avatar:customizer.value,password:$('password').value};setJoining(true);$('join-error').textContent='';
    sound.start(!muted).catch(()=>{});connect();
    if(socket.connected)socket.emit('join',pendingJoin);else socket.connect();
    joinTimer=setTimeout(()=>{if(!joining)return;setJoining(false);socket.disconnect();$('join-error').textContent='Kết nối hơi lâu. Bạn thử vào lại nhé.';if($('connection-dialog').open){$('connection-dialog').close();showHome();}},12000);
  }
  $('join-form').onsubmit=e=>{e.preventDefault();join();};
  function showHome(){active=false;myId=null;players.clear();items.clear();clearMovement();target=null;document.body.classList.remove('playing','people-open','settings-open');$('people-toggle').setAttribute('aria-expanded','false');$('settings-toggle').setAttribute('aria-expanded','false');previewHost.prepend(gameCanvas);view?.setActive(false);$('game').hidden=true;$('welcome').hidden=false;$('welcome-footer').hidden=false;$('connection-dialog').close();setJoining(false);if(socket)socket.disconnect();sound.setEnabled(false);status();}
  $('leave').onclick=showHome;$('back-home').onclick=showHome;$('rejoin').onclick=()=>{if(joining)return;join();};
  $('help').onclick=()=>{$('help-dialog').showModal();clearMovement();target=null;};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  function setCamera(mode){view?.setMode(mode);for(const key of ['overhead','panorama','follow'])$('camera-'+key).setAttribute('aria-pressed',String(mode===key));}
  $('camera-overhead').onclick=()=>setCamera('overhead');$('camera-panorama').onclick=()=>setCamera('panorama');$('camera-follow').onclick=()=>setCamera('follow');$('camera-in').onclick=()=>view?.zoomBy(.85);$('camera-out').onclick=()=>view?.zoomBy(1.18);$('camera-reset').onclick=()=>view?.resetCamera();
  $('people-toggle').onclick=()=>{const open=document.body.classList.toggle('people-open');$('people-toggle').setAttribute('aria-expanded',String(open));};
  $('settings-toggle').onclick=()=>{const open=document.body.classList.toggle('settings-open');$('settings-toggle').setAttribute('aria-expanded',String(open));};
  function updateQualityUI(){const high=view?.quality==='high';$('quality-mode').setAttribute('aria-pressed',String(high));$('quality-mode').textContent=high?'Rất nét':'Đẹp & mượt';}
  updateQualityUI();
  $('quality-mode').onclick=()=>{if(!view)return;view.setQuality(view.quality==='high'?'balanced':'high');updateQualityUI();try{localStorage.setItem('temple-visual-quality',view.quality);}catch{}toast(view.quality==='high'?'Hình ảnh rất nét, đầy đủ chi tiết.':'Hình ảnh đẹp, ưu tiên chuyển động mượt.');};
  const stick=$('joystick');
  function moveStick(e){
    if(joystickInput.pointer!==e.pointerId)return;
    const rect=joystickInput.bounds||stick.getBoundingClientRect(),radius=rect.width*.33;let dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2;
    const length=Math.hypot(dx,dy);if(length>radius){dx*=radius/length;dy*=radius/length;}
    joystickInput.x=Math.abs(dx/radius)<.12?0:dx/radius;joystickInput.y=Math.abs(dy/radius)<.12?0:dy/radius;stick.style.setProperty('--jx',dx+'px');stick.style.setProperty('--jy',dy+'px');
  }
  stick.addEventListener('pointerdown',e=>{if(!active||joystickInput.pointer!==null||performance.now()<localBowUntil)return;e.preventDefault();joystickInput.pointer=e.pointerId;joystickInput.bounds=stick.getBoundingClientRect();stick.setPointerCapture(e.pointerId);target=null;moveStick(e);});
  stick.addEventListener('pointermove',moveStick);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,e=>{if(joystickInput.pointer===e.pointerId)clearMovement(type!=='pointerup');});
  function updatePeople(){
    $('online-count').textContent=`${players.size}/5`;$('people-badge').textContent=`${players.size}/5`;$('incense-count').innerHTML=`${items.size} <small>/ 12 nén</small>`;presence(players.size);
    const list=$('players');list.replaceChildren();for(const p of players.values()){const li=document.createElement('li'),c=document.createElement('canvas'),info=document.createElement('div'),name=document.createElement('strong'),state=document.createElement('small');c.width=60;c.height=72;drawPortrait(c,window.AvatarConfig.normalize(p.avatar,p.character,p.color));info.className='player-info';name.textContent=p.name;state.textContent=p.action==='sit'?(p.sofaSeatId?'Đang ngồi sofa':'Đang ngồi thiền'):p.action==='bow'?(p.ritual?.kind==='incense'?'Đang thắp nhang':'Đang cúi lạy'):'Đang thong thả';info.append(name,state);li.append(c,info);if(p.id===myId){const you=document.createElement('span');you.className='you';you.textContent='bạn';li.append(you);}list.append(li);}
  }
  function availableSofaSeats(){return window.SOFA_SEATS.filter(s=>![...players.values()].some(p=>p.sofaSeatId===s.id));}
  function nearbySofaSeat(me){return availableSofaSeats().filter(s=>Math.hypot(me.x-s.approachX,me.y-s.approachY)<=window.SOFA_REACH&&window.canWalkBetween(me.x,me.y,s.approachX,s.approachY)).sort((a,b)=>Math.hypot(me.x-a.approachX,me.y-a.approachY)-Math.hypot(me.x-b.approachX,me.y-b.approachY))[0];}
  function requestSofa(seatId){if(!active||sofaPending||performance.now()<localBowUntil)return;sofaPending=true;sendMove(true);socket.emit('sit-sofa',{seatId});}
  function exitSofaLocally(me){const seat=window.SOFA_SEATS.find(s=>s.id===me.sofaSeatId);if(!seat)return;me.x=seat.approachX;me.y=seat.approachY;me.sofaSeatId=null;}
  function action(type){const me=players.get(myId);if(!active||!me||sofaPending||performance.now()<localBowUntil)return;if(type==='bow'&&me.sofaSeatId){toast('Đứng dậy khỏi sofa để cúi lạy nhé.');return;}target=null;clearMovement();if(type==='sit')type=me.action==='sit'?'stand':'sit';if(type==='sit'){const seat=nearbySofaSeat(me);if(seat){requestSofa(seat.id);return;}}const fromSit=me.action==='sit';if(type==='stand')exitSofaLocally(me);me.action=type;if(type==='bow'){me.ritual={kind:'bow',start:performance.now(),fromSit};localBowUntil=performance.now()+1500;}else{me.ritual=null;if(fromSit&&type==='stand')localBowUntil=performance.now()+500;}socket.emit('action',type);updatePeople();}
  $('sit').onclick=()=>action('sit');$('bow').onclick=()=>action('bow');
  function plant(){if(!active||incensePending)return;const me=players.get(myId);if(!me)return;if(Math.hypot(me.x-URN.x,me.y-URN.y)>80){toast('Lại gần lư hương trong chính điện nhé.');return;}if(performance.now()<localBowUntil)return;if([...items.values()].filter(i=>i.owner===myId).length>=3){toast('Bạn đang có 3 nén hương. Hãy đợi hương tàn.');return;}incensePending=true;$('incense').disabled=true;sendMove(true);socket.emit('plant-incense');}
  $('incense').onclick=plant;
  function updateYardUI(me,now){
    if(!me)return;
    const rack=nearestRack(me),patch=nearestLeaves(me,leafPatches.values(),now),busy=now<localBowUntil||me.action!=='stand';
    const score=String(me.blessings||0);if($('blessing-score').textContent!==score)$('blessing-score').textContent=score;
    const sweeping=me.sweepStart&&now-me.sweepStart*1000<SWEEP_DURATION,canSweep=!!me.hasBroom&&!!patch;
    $('broom-label').textContent=me.hasBroom?'Trả chổi':'Lấy chổi';$('broom-pickup').setAttribute('aria-pressed',String(!!me.hasBroom));$('broom-pickup').hidden=!rack;$('broom-pickup').disabled=!rack||busy;
    $('sweep-leaves').hidden=!canSweep&&!sweeping;$('sweep-leaves').disabled=!canSweep||busy;$('sweep-label').textContent=sweeping?'Đang quét…':'Quét lá';
    $('broom-hit').hidden=!me.hasBroom;$('broom-hit').disabled=!me.hasBroom||busy||now-lastHit<HIT_COOLDOWN;
    $('hit-label').textContent='Var nhau';
    document.querySelector('.yard-tools').hidden=!rack&&!canSweep&&!sweeping&&!me.hasBroom;
    $('broom-hint').textContent=sweeping?'Dọn sân thêm sạch':me.hasBroom?'G / Var nhau: vung chổi phía trước · Trúng người mới mất 1 phước':canSweep?'Chạm để quét · +1 phước lành':'Chạm để lấy chổi trên giá';
    if(me.hitStart&&now-me.hitStart*1000<HIT_DURATION)$('location-hint').textContent='Đang vung chổi về phía trước…';
    if(sweeping)$('location-hint').textContent='Đang quét lá…';
  }
  function takeBroom(){const me=players.get(myId);if(!active||!me||performance.now()<localBowUntil)return;const rack=nearestRack(me);if(!rack){toast('Tới giá chổi gần cổng hoặc bên vườn để lấy chổi nhé.');return;}sendMove(true);socket.emit('broom',{rackId:rack.id,take:!me.hasBroom});}
  function sweepLeaves(){const me=players.get(myId);if(!active||!me||performance.now()<localBowUntil)return;if(!me.hasBroom){toast('Tới giá chổi để lấy chổi trước nhé.');return;}const patch=nearestLeaves(me,leafPatches.values(),performance.now());if(!patch){toast('Tới gần đám lá dưới cây để quét nhé.');return;}target=null;clearMovement();sendMove(true);socket.emit('sweep',{patchId:patch.id});}
  function hitBroom(){const me=players.get(myId),now=performance.now();if(!active||!me||!me.hasBroom||me.action!=='stand'||now<localBowUntil||now-lastHit<HIT_COOLDOWN)return;const model=view.models.get(myId);if(!model)return;const heading=model.root.rotation.y;target=null;clearMovement();sendMove(true);socket.emit('broom-hit',{heading});}
  $('broom-hit').onclick=hitBroom;
  $('broom-pickup').onclick=takeBroom;$('sweep-leaves').onclick=sweepLeaves;
  const movementKeys=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'];
  document.addEventListener('keydown',e=>{
    if(e.target.closest('input,textarea')||$('help-dialog').open||$('connection-dialog').open)return;
    const key=e.key.toLowerCase();if(key==='m'&&!e.repeat){e.preventDefault();toggleSound();return;}
    if(!active)return;
    if(movementKeys.includes(key)){e.preventDefault();if(performance.now()<localBowUntil)return;keys.add(key);target=null;}
    if(e.repeat)return;
    if(key==='v'){e.preventDefault();const modes=['overhead','panorama','follow'];setCamera(modes[(modes.indexOf(view.mode)+1)%modes.length]);}if(key==='r'){e.preventDefault();view.resetCamera();}
    if(key==='e'){e.preventDefault();action('sit');}if(key===' '){e.preventDefault();action('bow');}if(key==='f'){e.preventDefault();plant();}
    if(key==='g'){e.preventDefault();hitBroom();}
  });
  document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{clearMovement();target=null;});document.addEventListener('visibilitychange',()=>{clearMovement();target=null;lastFrame=performance.now();});
  // A tap chooses a ground point via raycasting; a drag rotates the camera.
  const pointers=new Map();let gesture=null,pinchDistance=0;
  window.addEventListener('resize',()=>{clearMovement();target=null;pointers.clear();gesture=null;pinchDistance=0;});
  gameCanvas.addEventListener('pointerdown',e=>{if(!active)return;gameCanvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});gesture={x:e.clientX,y:e.clientY,moved:false};if(pointers.size===2){const[a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);gesture.moved=true;}});
  gameCanvas.addEventListener('pointermove',e=>{const previous=pointers.get(e.pointerId);if(!active||!previous)return;const dx=e.clientX-previous.x,dy=e.clientY-previous.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const[a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(distance>1&&pinchDistance>1)view.zoomBy(pinchDistance/distance);pinchDistance=distance;gesture.moved=true;}else if(gesture&&(gesture.moved||Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>6)){gesture.moved=true;view.orbit(dx,dy);}});
  gameCanvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null;});
  gameCanvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);const tap=gesture&&!gesture.moved&&!pointers.size;gesture=null;if(tap)walkTo(e.clientX,e.clientY);});
  gameCanvas.addEventListener('wheel',e=>{if(!active)return;e.preventDefault();view.zoomBy(Math.exp(e.deltaY*.001));},{passive:false});
  gameCanvas.addEventListener('contextmenu',e=>e.preventDefault());
  function walkTo(clientX,clientY){
    if(!active||performance.now()<localBowUntil)return;const hit=view.pick(clientX,clientY);if(!hit)return;
    let {x,y}=hit,sofaSeat=null;
    if(hit.sofaSeatId){const requested=window.SOFA_SEATS.find(s=>s.id===hit.sofaSeatId);sofaSeat=availableSofaSeats().filter(s=>s.sofaId===requested.sofaId).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0];if(!sofaSeat){toast('Sofa này đã đủ chỗ. Bạn chọn ghế khác nhé.');return;}x=sofaSeat.approachX;y=sofaSeat.approachY;}
    const lotus=window.lotusAt(x,y);if(lotus){x=lotus.x;y=lotus.y;}
    if(Math.hypot(x-URN.x,y-URN.y)<38){x=URN.x;y=URN.y+53;}
    if(!validPosition(x,y)){toast('Đi trên sân và qua cầu để sang bờ suối nhé.');return;}
    const me=players.get(myId),exit=window.SOFA_SEATS.find(s=>s.id===me.sofaSeatId);const route=findRoute(exit?.approachX??me.x,exit?.approachY??me.y,x,y);if(!route){toast('Chỗ đó hơi xa lối đi. Bạn thử chạm gần hơn nhé.');return;}target={x,y,route,meditate:!!lotus,sofaSeatId:sofaSeat?.id};clearMovement();$('canvas').focus({preventScroll:true});
  }
  // A small navigation grid routes touches around the pond, stream and incense burner.
  function findRoute(sx,sy,ex,ey){
    const size=20,cols=50,rows=35,idx=(x,y)=>y*cols+x;
    const canCross=(ax,ay,bx,by)=>[0,.25,.5,.75,1].every(t=>validPosition(ax+(bx-ax)*t,ay+(by-ay)*t));
    const start={x:Math.floor(sx/size),y:Math.floor(sy/size)},end={x:Math.floor(ex/size),y:Math.floor(ey/size)};
    const queue=[start],came=new Map([[idx(start.x,start.y),null]]);let head=0,found=false;
    while(head<queue.length){const p=queue[head++];if(p.x===end.x&&p.y===end.y){found=true;break;}
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,key=idx(x,y),first=p===start;if(x<0||y<0||x>=cols||y>=rows||came.has(key)||!canCross(first?sx:p.x*size+size/2,first?sy:p.y*size+size/2,x*size+size/2,y*size+size/2))continue;came.set(key,p);queue.push({x,y});}}
    if(!found)return null;
    const route=[{x:ex,y:ey}];let p=end;while(p&&!(p.x===start.x&&p.y===start.y)){route.push({x:p.x*size+size/2,y:p.y*size+size/2});p=came.get(idx(p.x,p.y));}return route.reverse();
  }
  function sendMove(force=false){const me=players.get(myId);if(!active||!me)return;const now=performance.now();if(!force&&now-lastSent<50)return;if(lastPosition&&lastPosition.x===me.x&&lastPosition.y===me.y)return;socket.emit('move',{x:me.x,y:me.y});lastPosition={x:me.x,y:me.y};lastSent=now;}
  function frame(now){
    const dt=Math.min((now-lastFrame)/1000,.045),t=now/1000;lastFrame=now;
    if(active){
      const me=players.get(myId);
      if(me){
        const wantsMove=keys.size>0||Math.hypot(joystickInput.x,joystickInput.y)>.1||!!target;
        if(me.action==='sit'&&wantsMove&&now>=localBowUntil){exitSofaLocally(me);me.action='stand';me.ritual=null;velocity.x=0;velocity.y=0;localBowUntil=now+500;socket.emit('action','stand');updatePeople();}
        let dx=0,dy=0;
        if(now>=localBowUntil){
          if(keys.has('w')||keys.has('arrowup'))dy--;if(keys.has('s')||keys.has('arrowdown'))dy++;if(keys.has('a')||keys.has('arrowleft'))dx--;if(keys.has('d')||keys.has('arrowright'))dx++;
          dx+=joystickInput.x;dy+=joystickInput.y;
          if(dx||dy){const direction=view.movement(dx,dy);dx=direction.x;dy=direction.y;}
          if(target&&target.route.length){let point=target.route[0],distance=Math.hypot(point.x-me.x,point.y-me.y);while(distance<3&&target.route.length>1){target.route.shift();point=target.route[0];distance=Math.hypot(point.x-me.x,point.y-me.y);}dx=distance>.001?(point.x-me.x)/distance:0;dy=distance>.001?(point.y-me.y)/distance:0;}
        }
        const length=Math.hypot(dx,dy),speed=(view.mode==='overhead'?100:180)*Math.min(1,length);
        velocity.x=easeVelocity(velocity.x,length?dx/length*speed:0,dt);velocity.y=easeVelocity(velocity.y,length?dy/length*speed:0,dt);
        if(now<localBowUntil||me.action!=='stand'){velocity.x=0;velocity.y=0;}
        dx=velocity.x*dt;dy=velocity.y*dt;
        const oldX=me.x,oldY=me.y;
        if(target?.route.length===1&&Math.hypot(target.x-me.x,target.y-me.y)<=Math.max(2,Math.hypot(dx,dy))){me.x=target.x;me.y=target.y;const meditate=target.meditate,sofaSeatId=target.sofaSeatId;target=null;velocity.x=0;velocity.y=0;if(meditate){sendMove(true);action('sit');}else if(sofaSeatId)requestSofa(sofaSeatId);}
        else{if(validPosition(me.x+dx,me.y))me.x+=dx;else velocity.x=0;if(validPosition(me.x,me.y+dy))me.y+=dy;else velocity.y=0;}
        me.moving=Math.hypot(me.x-oldX,me.y-oldY)>.003;if(me.x!==oldX)me.face=me.x>oldX?1:-1;
        if(me.action==='bow'&&now>=localBowUntil){me.action='stand';updatePeople();}
        sendMove();
        for(const p of players.values())if(p.id!==myId){const dx=p.tx-p.x,dy=p.ty-p.y;p.moving=Math.hypot(dx,dy)>1;p.x+=dx*Math.min(1,dt*13);p.y+=dy*Math.min(1,dt*13);if(Math.abs(dx)>.1)p.face=dx>0?1:-1;}
        sound.update(t,me.x,me.y,view.yaw);
        if(now-uiTimer>150){
          uiTimer=now;
          const near=Math.hypot(me.x-URN.x,me.y-URN.y)<=80,ownIncense=[...items.values()].filter(i=>i.owner===myId).length;
          $('incense').disabled=!near||!!me.sofaSeatId||incensePending||now<localBowUntil||ownIncense>=3||items.size>=12;
          $('sit').disabled=now<localBowUntil||sofaPending;$('bow').disabled=now<localBowUntil||!!me.sofaSeatId;
          $('incense').title=near?'Thắp một nén hương (F)':'Lại gần lư hương trong chính điện';
          const moveHint=view.mobile?'Kéo cần để di chuyển · Vuốt để nhìn quanh':'Kéo để xoay góc nhìn · WASD để đi · Chạm vào sân để bước đi';
          $('location-hint').textContent=now<localBowUntil?(me.action==='bow'?(me.ritual?.kind==='incense'?'Đang dâng hương…':'Đang cúi lạy…'):me.action==='sit'?'Đang ngồi xuống…':'Đang đứng dậy…'):window.lotusAt(me.x,me.y)?(me.action==='sit'?'Thả lỏng trên lá sen · Lắng nghe mặt hồ':'Lá sen thiền · Bấm E hoặc Ngồi thiền'):near?(ownIncense>=3?'Bạn đã cắm 3 nén · Đợi hương tàn':items.size>=12?'Lư hương đã đầy':incensePending?'Đang chuẩn bị dâng hương…':'Có thể cắm nén tiếp theo · F / Thắp nhang'):moveHint;
          $('sit-label').textContent=me.action==='sit'?'Đứng dậy':nearbySofaSeat(me)?'Ngồi sofa':'Ngồi thiền';$('sit').setAttribute('aria-pressed',String(me.action==='sit'));
          updateYardUI(me,now);
        }
      }
      view?.render(t,[...players.values()],[...items.values()],myId,target);
    }else if(!$('welcome').hidden){view?.renderCreator(customizer.value);}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('pagehide',()=>{clearInterval(statusTimer);socket?.disconnect();});
})();


