const { test, expect } = require('@playwright/test');
const { io } = require('socket.io-client');
test('welcome, multiplayer, keyboard, incense, capacity and leaving', async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pages=[];const errors=[];
  for(let i=0;i<7;i++){
    const page=await context.newPage();pages.push(page);page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
    if(i===0){await page.screenshot({path:'test-results/welcome.png',fullPage:true});await page.getByRole('button',{name:'Nữ',exact:true}).click();await page.getByLabel('Mã màu áo',{exact:true}).fill('#87966f');}
    await page.locator('#next-button').click();await page.locator('#name').fill(`Bạn ${i+1}`);await page.locator('#join-button').click();
    if(i<6)await expect(page.locator('#game')).toBeVisible();else await expect(page.locator('#join-error')).toContainText('đủ 6 người');
  }
  const page=pages[0];await expect(page.locator('#players li')).toHaveCount(6);
  await page.bringToFront();await page.locator('#canvas').focus();await page.keyboard.press('e');await expect(page.locator('#sit-label')).toHaveText('Đứng dậy');
  await page.keyboard.down('w');try{await expect(page.locator('#incense')).toBeEnabled({timeout:20000});}finally{await page.keyboard.up('w');}await expect(page.locator('#sit')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#incense')).toBeEnabled({timeout:3000});await page.locator('#incense').click();await expect(page.locator('#incense-count')).toContainText('1');await expect(pages[1].locator('#incense-count')).toContainText('1');
  await page.waitForTimeout(450);
  expect(await page.evaluate(async()=>{const {TempleView}=await import('/scene3d.js');return new Promise(resolve=>{const original=TempleView.prototype.render;TempleView.prototype.render=function(...args){original.apply(this,args);TempleView.prototype.render=original;resolve(this.models.get(args[3]).heldIncense.visible);};});})).toBe(true);
  await page.screenshot({path:'test-results/overhead-incense.png',fullPage:true});
  await page.locator('#camera-panorama').click();await page.waitForTimeout(700);await page.screenshot({path:'test-results/courtyard.png',fullPage:true});
  await expect(page.locator('#canvas')).toHaveAttribute('data-renderer','webgl');
  await page.locator('#camera-follow').click();await expect(page.locator('#canvas')).toHaveAttribute('data-camera-mode','follow');
  await page.waitForTimeout(1700);await page.keyboard.down('w');try{await expect(page.locator('#canvas')).toHaveAttribute('data-location','hall',{timeout:20000});}finally{await page.keyboard.up('w');}
  await page.waitForTimeout(1200);await page.screenshot({path:'test-results/inside-hall.png',fullPage:true});
  await pages[5].locator('#leave').click();await expect(page.locator('#players li')).toHaveCount(5);await pages[6].locator('#join-button').click();await expect(pages[6].locator('#game')).toBeVisible();
  expect(errors).toEqual([]);await context.close();
});
test('mobile entry, touch movement, help and sound controls', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await page.goto('/');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);await page.screenshot({path:'test-results/mobile-welcome.png',fullPage:true});
  await page.locator('#next-button').click();await page.locator('#name').fill('Bình An');await page.locator('#join-button').tap();await expect(page.locator('#game')).toBeVisible();await page.locator('#sit').tap();await expect(page.locator('#sit-label')).toHaveText('Đứng dậy');
  await expect(page.locator('#camera-overhead')).toHaveAttribute('aria-pressed','true');await page.locator('#settings-toggle').tap();await page.locator('#camera-panorama').tap();await page.locator('#settings-toggle').tap();
  await page.waitForTimeout(800);const box=await page.locator('#canvas').boundingBox();await page.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.55);await expect(page.locator('#sit-label')).toHaveText('Ngồi thiền');
  await page.locator('#sit').tap();const pad=await page.locator('#joystick').boundingBox();await page.mouse.move(pad.x+pad.width/2,pad.y+pad.height/2-30);await page.mouse.down();await expect(page.locator('#sit-label')).toHaveText('Ngồi thiền');await page.mouse.up();
  await page.waitForTimeout(1200);await page.locator('#help').tap();await expect(page.locator('#help-dialog')).toBeVisible();await page.getByRole('button',{name:'Mình hiểu rồi'}).tap();await page.locator('#sound').tap();await page.screenshot({path:'test-results/mobile-game.png',fullPage:true});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);await context.close();
});
test('connection loss offers a working rejoin', async ({ browser }) => {
  const context=await browser.newContext();const page=await context.newPage();let transport;
  await page.routeWebSocket('**/socket.io/**',ws=>{transport=ws;ws.connectToServer();});
  await page.goto('/');
  // Use WebSocket from the first handshake so the closed socket is the active
  // transport, rather than Socket.IO's in-progress polling upgrade candidate.
  await page.evaluate(()=>{const original=window.io;window.io=options=>original({...options,transports:['websocket']});});
  await page.locator('#next-button').click();await page.locator('#name').fill('An Tâm');await page.locator('#join-button').click();await expect(page.locator('#game')).toBeVisible();
  await expect.poll(()=>!!transport).toBe(true);await transport.close({code:1000,reason:'Connection loss test'});
  await expect(page.locator('#connection-dialog')).toBeVisible();await page.locator('#rejoin').click();await expect(page.locator('#connection-dialog')).not.toBeVisible();await expect(page.locator('#players li')).toHaveCount(1);await context.close();
});
test('drag rotates camera and keyboard movement follows the new view', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  let observer;
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Thử camera');await page.locator('#join-button').click();await expect(page.locator('#game')).toBeVisible();
    observer=io('http://127.0.0.1:3001',{transports:['websocket'],forceNew:true});await new Promise(resolve=>observer.once('connect',resolve));
    const joined=new Promise(resolve=>observer.once('joined',resolve));observer.emit('join',{name:'Quan sát',character:1});const initial=(await joined).players.find(p=>p.name==='Thử camera');let latest=initial;
    observer.on('state',state=>{const p=state.find(p=>p.id===initial.id);if(p)latest=p;});
    const canvas=await page.locator('#canvas').boundingBox();
    await page.mouse.move(canvas.width*.48,canvas.height*.53);await page.mouse.down();await page.mouse.move(canvas.width*.62,canvas.height*.53,{steps:12});await page.mouse.up();
    await page.locator('#canvas').focus();await page.keyboard.down('w');try{await expect.poll(()=>latest.x-initial.x,{timeout:5000}).toBeGreaterThan(25);}finally{await page.keyboard.up('w');}
    expect(latest.y).toBeLessThan(initial.y);
    await page.keyboard.press('v');await expect(page.locator('#camera-panorama')).toHaveAttribute('aria-pressed','true');await page.keyboard.press('v');await expect(page.locator('#camera-follow')).toHaveAttribute('aria-pressed','true');await page.keyboard.press('v');await expect(page.locator('#camera-overhead')).toHaveAttribute('aria-pressed','true');await page.locator('#camera-in').click();await page.locator('#camera-out').click();await page.locator('#camera-reset').click();
  }finally{observer?.disconnect();await context.close();}
});
for(const mobile of [false,true])test(`close overhead camera shows the complete body and seated pose (${mobile?'mobile':'desktop'})`,async({browser})=>{
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Camera');await page.locator('#join-button').click();
    await expect(page.locator('#canvas')).toHaveAttribute('data-camera-mode','overhead');await expect(page.locator('#camera-first')).toHaveCount(0);
    await page.evaluate(async()=>{const{TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);window.cameraQA={view:this,id:args[3],players:args[1]};resolve();};});});
    const state=()=>page.evaluate(()=>{
      const{view:v,id}=window.cameraQA,m=v.models.get(id),bounds=[];
      for(const y of [0,2.8]){const point=m.root.position.clone();point.y+=y;point.project(v.camera);bounds.push({x:point.x,y:point.y,z:point.z});}
      return{height:v.camera.position.y,visible:m.root.visible,offset:m.postureOffset,sit:m.motionOutput.sit,bounds};
    });
    const standing=await state();expect(standing.visible).toBe(true);expect(standing.height).toBeGreaterThan(4);expect(standing.height).toBeLessThan(6);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedInvite=text;}}}));
    await page.locator('#share-link').click();expect(await page.evaluate(()=>window.copiedInvite)).toBe('http://127.0.0.1:3001/');
    for(const p of standing.bounds){expect(Math.abs(p.x)).toBeLessThan(.95);expect(Math.abs(p.y)).toBeLessThan(.95);expect(p.z).toBeLessThan(1);}
    const turns=await page.evaluate(()=>{
      const {view:v,id,players}=window.cameraQA,model=v.models.get(id),results=[];
      let time=performance.now()/1000;
      for(const heading of [0,.73,-1.8,Math.PI]){
        model.root.rotation.y=heading;model.lastPoseAction='stand';model.motion.heading=heading+.3;
        for(const action of ['sit','bow','stand']){
          const poses=players.map(p=>p.id===id?{...p,action,ritual:null}:p);
          for(let i=0;i<100;i++){time+=1/60;v.syncPlayers(poses,id,time,1/60);}
          results.push(Math.abs(Math.atan2(Math.sin(model.root.rotation.y-heading),Math.cos(model.root.rotation.y-heading))));
        }
      }
      return results;
    });
    for(const turn of turns)expect(turn).toBeLessThan(.001);
    const wallClearance=await page.evaluate(()=>{
      const {view:v}=window.cameraQA,centerZ=(HALL.y-350)/10,radius=HALL.radius/10,results=[];
      for(const angle of [Math.PI/2,Math.PI,Math.PI*1.5]){
        const target=v.look.clone().set(Math.sin(angle)*(radius+2),2.2,centerZ+Math.cos(angle)*(radius+2));
        const camera=target.clone();camera.x-=Math.sin(angle)*8;camera.z-=Math.cos(angle)*8;camera.y+=3;
        v.cameraObstacles.constrain(target,camera);
        results.push(Math.hypot(camera.x,camera.z-centerZ)-radius);
      }
      return results;
    });
    for(const clearance of wallClearance)expect(clearance).toBeGreaterThan(.3);
    await page.screenshot({path:`test-results/overhead-standing-${mobile?'mobile':'desktop'}.png`});
    await page.locator('#sit').click();await expect.poll(async()=>(await state()).sit).toBe(1);expect((await state()).offset).toBeLessThan(-.5);
    await page.evaluate(()=>window.cameraQA.view.yaw=Math.PI);await page.waitForTimeout(500);
    await page.screenshot({path:`test-results/overhead-meditation-${mobile?'mobile':'desktop'}.png`});
    await page.locator('#sit').click();await expect.poll(async()=>(await state()).sit).toBe(0);
    await page.locator('#canvas').focus();await page.keyboard.press('v');await expect(page.locator('#canvas')).toHaveAttribute('data-camera-mode','panorama');
    await page.keyboard.press('v');await expect(page.locator('#canvas')).toHaveAttribute('data-camera-mode','follow');await page.keyboard.press('v');await expect(page.locator('#canvas')).toHaveAttribute('data-camera-mode','overhead');
    await page.evaluate(()=>window.cameraQA.view.orbit(0,-300));await page.waitForTimeout(450);
    const upward=await page.evaluate(()=>{const v=window.cameraQA.view;return{lookingUp:v.look.y>v.camera.position.y,height:v.camera.position.y};});
    expect(upward.lookingUp).toBe(true);expect(upward.height).toBeGreaterThan(3);
    await page.screenshot({path:`test-results/overhead-looking-up-${mobile?'mobile':'desktop'}.png`});
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
