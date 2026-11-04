const { test, expect } = require('@playwright/test');
const { io } = require('socket.io-client');
test('welcome, multiplayer, keyboard, incense, capacity and leaving', async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pages=[];const errors=[];
  for(let i=0;i<6;i++){
    const page=await context.newPage();pages.push(page);page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
    if(i===0){await page.screenshot({path:'test-results/welcome.png',fullPage:true});await page.getByRole('button',{name:'Nữ',exact:true}).click();await page.getByLabel('Mã màu áo',{exact:true}).fill('#87966f');}
    await page.locator('#name').fill(`Bạn ${i+1}`);await page.locator('#join-button').click();
    if(i<5)await expect(page.locator('#game')).toBeVisible();else await expect(page.locator('#join-error')).toContainText('đủ 5 người');
  }
  const page=pages[0];await expect(page.locator('#players li')).toHaveCount(5);
  await page.bringToFront();await page.locator('#canvas').focus();await page.keyboard.press('e');await expect(page.locator('#sit-label')).toHaveText('Đứng dậy');
  await page.keyboard.down('w');try{await expect(page.locator('#incense')).toBeEnabled({timeout:20000});}finally{await page.keyboard.up('w');}await expect(page.locator('#sit-label')).toHaveText('Ngồi thiền');
  await expect(page.locator('#incense')).toBeEnabled({timeout:3000});await page.locator('#incense').click();await expect(page.locator('#incense-count')).toContainText('1');await expect(pages[1].locator('#incense-count')).toContainText('1');
  await page.waitForTimeout(450);
  expect(await page.evaluate(async()=>{const {TempleView}=await import('/scene3d.js');return new Promise(resolve=>{const original=TempleView.prototype.render;TempleView.prototype.render=function(...args){original.apply(this,args);TempleView.prototype.render=original;resolve(this.heldIncense.visible);};});})).toBe(true);
  await page.screenshot({path:'test-results/first-person-incense.png',fullPage:true});
  await page.locator('#camera-panorama').click();await page.waitForTimeout(700);await page.screenshot({path:'test-results/courtyard.png',fullPage:true});
  await expect(page.locator('#canvas')).toHaveAttribute('data-renderer','webgl');
  await page.locator('#camera-follow').click();await expect(page.locator('#canvas')).toHaveAttribute('data-camera-mode','follow');
  await page.waitForTimeout(1700);await page.keyboard.down('w');try{await expect(page.locator('#canvas')).toHaveAttribute('data-location','hall',{timeout:20000});}finally{await page.keyboard.up('w');}
  await page.waitForTimeout(1200);await page.screenshot({path:'test-results/inside-hall.png',fullPage:true});
  await pages[4].locator('#leave').click();await expect(page.locator('#players li')).toHaveCount(4);await pages[5].locator('#join-button').click();await expect(pages[5].locator('#game')).toBeVisible();
  expect(errors).toEqual([]);await context.close();
});
test('mobile entry, touch movement, help and sound controls', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await page.goto('/');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);await page.screenshot({path:'test-results/mobile-welcome.png',fullPage:true});
  await page.locator('#name').fill('Bình An');await page.locator('#join-button').tap();await expect(page.locator('#game')).toBeVisible();await page.locator('#sit').tap();await expect(page.locator('#sit-label')).toHaveText('Đứng dậy');
  await expect(page.locator('#camera-first')).toHaveAttribute('aria-pressed','true');await page.locator('#settings-toggle').tap();await page.locator('#camera-panorama').tap();await page.locator('#settings-toggle').tap();
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
  await page.locator('#name').fill('An Tâm');await page.locator('#join-button').click();await expect(page.locator('#game')).toBeVisible();
  await expect.poll(()=>!!transport).toBe(true);await transport.close({code:1000,reason:'Connection loss test'});
  await expect(page.locator('#connection-dialog')).toBeVisible();await page.locator('#rejoin').click();await expect(page.locator('#connection-dialog')).not.toBeVisible();await expect(page.locator('#players li')).toHaveCount(1);await context.close();
});
test('drag rotates camera and keyboard movement follows the new view', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  let observer;
  try{
    await page.goto('/');await page.locator('#name').fill('Thử camera');await page.locator('#join-button').click();await expect(page.locator('#game')).toBeVisible();
    observer=io('http://127.0.0.1:3001',{transports:['websocket'],forceNew:true});await new Promise(resolve=>observer.once('connect',resolve));
    const joined=new Promise(resolve=>observer.once('joined',resolve));observer.emit('join',{name:'Quan sát',character:1});const initial=(await joined).players.find(p=>p.name==='Thử camera');let latest=initial;
    observer.on('state',state=>{const p=state.find(p=>p.id===initial.id);if(p)latest=p;});
    const canvas=await page.locator('#canvas').boundingBox();
    await page.mouse.move(canvas.width*.48,canvas.height*.53);await page.mouse.down();await page.mouse.move(canvas.width*.62,canvas.height*.53,{steps:12});await page.mouse.up();
    await page.locator('#canvas').focus();await page.keyboard.down('w');try{await expect.poll(()=>latest.x-initial.x,{timeout:5000}).toBeGreaterThan(25);}finally{await page.keyboard.up('w');}
    expect(latest.y).toBeLessThan(initial.y);
    await page.keyboard.press('v');await expect(page.locator('#camera-panorama')).toHaveAttribute('aria-pressed','true');await page.keyboard.press('v');await expect(page.locator('#camera-follow')).toHaveAttribute('aria-pressed','true');await page.keyboard.press('v');await expect(page.locator('#camera-first')).toHaveAttribute('aria-pressed','true');await page.locator('#camera-in').click();await page.locator('#camera-out').click();await page.locator('#camera-reset').click();
  }finally{observer?.disconnect();await context.close();}
});
test('first-person eyes follow posture, hands animate, and the own head is hidden', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto('/');await page.locator('#name').fill('Mắt nhân vật');await page.locator('#join-button').click();await expect(page.locator('#canvas')).toHaveAttribute('data-camera-mode','first');
    // Inspect the live renderer, without adding debug APIs to the application.
    await page.evaluate(async()=>{const {TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const original=TempleView.prototype.render;TempleView.prototype.render=function(...args){original.apply(this,args);TempleView.prototype.render=original;window.cameraQA={view:this,id:args[3]};resolve();};});});
    const state=()=>page.evaluate(()=>{const v=window.cameraQA.view,m=v.models.get(window.cameraQA.id);return{y:v.camera.position.y,x:v.camera.position.x,z:v.camera.position.z,pitch:v.camera.rotation.x,head:m.root.visible,hands:v.hands.visible,incense:v.heldIncense.visible,arms:v.handArms.map(a=>a.position.y)};});
    const stand=await state();expect(stand.y).toBeCloseTo(2.02,1);expect(stand.x).toBeCloseTo(-5,1);expect(stand.z).toBeCloseTo(25.5,1);expect(stand.head).toBe(false);expect(stand.hands).toBe(true);
    await page.screenshot({path:'test-results/first-person-standing.png'});
    await expect(page.locator('#mouse-look')).not.toBeVisible();
    await page.locator('#sit').click();await expect.poll(async()=>(await state()).y).toBeLessThan(stand.y-.4);const seated=await state();expect(seated.x).toBeCloseTo(stand.x,3);expect(seated.z).toBeCloseTo(stand.z,3);await page.screenshot({path:'test-results/first-person-seated.png'});
    await page.locator('#sit').click();await expect.poll(async()=>(await state()).y).toBeGreaterThan(stand.y-.05);
    await page.locator('#bow').click();await expect.poll(async()=>(await state()).pitch,{intervals:[50]}).toBeLessThan(-.4);const bowed=await state();expect(bowed.y).toBeLessThan(stand.y-.3);expect(bowed.arms[0]).toBeGreaterThan(stand.arms[0]+.1);await page.screenshot({path:'test-results/first-person-bow.png'});
    await expect.poll(async()=>(await state()).y).toBeGreaterThan(stand.y-.05);await expect.poll(async()=>(await state()).pitch).toBeGreaterThan(-.1);
    await expect(page.locator('#gentle-motion')).not.toBeVisible();
    await page.locator('#camera-panorama').click();await expect.poll(async()=>(await state()).head).toBe(true);await expect.poll(async()=>(await state()).hands).toBe(false);await page.locator('#camera-first').click();await expect.poll(async()=>(await state()).head).toBe(false);
    expect(errors).toEqual([]);
    await page.reload();await page.locator('#name').fill('Nhớ lựa chọn');await page.locator('#join-button').click();await expect(page.locator('#gentle-motion')).not.toBeVisible();
  }finally{await context.close();}
});

