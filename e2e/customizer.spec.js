const {test,expect}=require('@playwright/test');

async function inspectStudio(page){
  await page.evaluate(async()=>{const{AvatarStudio}=await import('/avatar-studio.mjs');await new Promise(resolve=>{const original=AvatarStudio.prototype.render;AvatarStudio.prototype.render=function(...args){original.apply(this,args);AvatarStudio.prototype.render=original;window.avatarQA=this;resolve();};});});
}
async function inspectGame(page){
  await page.evaluate(async()=>{const{TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const original=TempleView.prototype.render;TempleView.prototype.render=function(...args){original.apply(this,args);TempleView.prototype.render=original;window.gameQA={view:this,id:args[3]};resolve();};});});
}

test('mobile customizer has two characters, free colors for all pieces, 360 rotation, saved drafts and shared appearance',async({browser})=>{
  test.setTimeout(90000);
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/');await expect(page.locator('#gender-options button')).toHaveCount(2);await inspectStudio(page);
    await page.getByRole('button',{name:'Nữ',exact:true}).tap();
    await page.locator('#style-shirt').selectOption('short');await page.getByLabel('Mã màu áo',{exact:true}).fill('#2468ac');
    await page.getByRole('tab',{name:'Quần',exact:true}).tap();await page.locator('#style-pants').selectOption('wide');await page.getByLabel('Mã màu quần',{exact:true}).fill('#445566');
    await page.getByRole('tab',{name:'Giày',exact:true}).tap();await page.locator('#style-shoes').selectOption('sneakers');await page.getByLabel('Mã màu giày',{exact:true}).fill('#892f60');await page.getByLabel('Mã màu đế / dây giày',{exact:true}).fill('#ddee77');
    await page.getByRole('tab',{name:'Tóc',exact:true}).tap();await page.locator('#style-hair').selectOption('braids');await page.getByLabel('Mã màu tóc',{exact:true}).fill('#553322');await page.getByLabel('Mã màu dây buộc tóc',{exact:true}).fill('#40b0a0');
    await page.getByRole('tab',{name:'Phụ kiện',exact:true}).tap();await page.locator('#necklace').check();await page.getByLabel('Mã màu dây chuyền',{exact:true}).fill('#e0b040');await page.locator('#style-hairAccessory').selectOption('bow');await page.getByLabel('Mã màu nơ / kẹp tóc',{exact:true}).fill('#ee6677');
    await expect.poll(()=>page.evaluate(()=>window.avatarQA.model.appearance.hairAccessory)).toBe('bow');await page.locator('.avatar-pane').screenshot({path:'test-results/avatar-female.png'});
    await page.locator('#style-hairAccessory').selectOption('clip');
    await page.getByRole('tab',{name:'Da',exact:true}).tap();await page.getByLabel('Mã màu da',{exact:true}).fill('#c88a60');
    const expected=await page.evaluate(()=>window.avatarQA.model.appearance);
    expect(expected).toMatchObject({gender:'female',shirt:'short',pants:'wide',shoes:'sneakers',hair:'braids',necklace:true,hairAccessory:'clip',colors:{shirt:'#2468ac',pants:'#445566',shoes:'#892f60',shoeTrim:'#ddee77',hair:'#553322',hairTie:'#40b0a0',skin:'#c88a60',necklace:'#e0b040',hairAccessory:'#ee6677'}});
    for(let i=0;i<4;i++)await page.locator('#rotate-right').tap();expect(await page.evaluate(()=>window.avatarQA.model.root.rotation.y)).toBeCloseTo(Math.PI,3);await page.locator('.avatar-pane').screenshot({path:'test-results/avatar-back.png'});
    await page.locator('#avatar-rotation').focus();await page.keyboard.press('End');await expect(page.locator('#rotation-value')).toHaveText('360°');
    const box=await page.locator('#canvas').boundingBox();await page.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5,{steps:8});await page.mouse.up();expect(await page.locator('#avatar-rotation').inputValue()).not.toBe('360');
    await page.getByRole('button',{name:'Nam',exact:true}).tap();await page.getByRole('tab',{name:'Tóc',exact:true}).tap();await page.locator('#style-hair').selectOption('bald');await page.getByRole('tab',{name:'Phụ kiện',exact:true}).tap();await page.locator('#necklace').check();await expect(page.locator('#style-hairAccessory')).toHaveCount(0);await page.locator('.avatar-pane').screenshot({path:'test-results/avatar-male.png'});
    await page.getByRole('button',{name:'Nữ',exact:true}).tap();expect(await page.evaluate(()=>window.avatarQA.model.appearance)).toEqual(expected);
    await page.reload();await inspectStudio(page);expect(await page.evaluate(()=>window.avatarQA.model.appearance)).toEqual(expected);
    await page.locator('#name').fill('Tâm');await page.locator('#join-button').tap();await expect(page.locator('#game')).toBeVisible();
    const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));await other.goto('/');await other.getByRole('button',{name:'Nam',exact:true}).tap();await other.locator('#name').fill('Bạn xem');await other.locator('#join-button').tap();await inspectGame(other);
    expect(await other.evaluate(()=>[...window.gameQA.view.models.values()].find(m=>m.appearance.gender==='female').appearance)).toEqual(expected);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('mobile supports walking and looking with two touches, releasing stops movement, and quality controls remain reachable',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
  try{
    await page.goto('/');await page.locator('#name').fill('Bình An');await page.locator('#join-button').tap();await inspectGame(page);
    const snapshot=()=>page.evaluate(()=>{const v=window.gameQA.view,p=v.models.get(window.gameQA.id).root.position;return{x:p.x,z:p.z,yaw:v.yaw,battery:v.batterySaver,ratio:v.renderer.getPixelRatio(),shadow:v.renderer.shadowMap.enabled};});
    const before=await snapshot();expect(before.battery).toBe(true);expect(before.shadow).toBe(false);expect(before.ratio).toBeLessThanOrEqual(1.2);
    const pad=await page.locator('#joystick').boundingBox(),x=pad.x+pad.width/2,y=pad.y+pad.height/2;const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1},{x:250,y:390,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-35,id:1},{x:305,y:398,id:2}]});
    await expect.poll(async()=>(await snapshot()).z).toBeLessThan(before.z-1);
    expect(Math.abs((await snapshot()).yaw-before.yaw)).toBeGreaterThan(.1);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150);const stopped=await snapshot();await page.waitForTimeout(300);const after=await snapshot();expect(Math.hypot(after.x-stopped.x,after.z-stopped.z)).toBeLessThan(.08);
    await expect(page.locator('#people-panel')).not.toBeVisible();await expect(page.locator('#people-toggle')).not.toBeVisible();
    await page.locator('#settings-toggle').tap();await expect(page.locator('#battery-saver')).toBeVisible();await expect(page.locator('#camera-overhead')).toBeVisible();
    await page.locator('#battery-saver').tap();await expect(page.locator('#battery-saver')).toHaveAttribute('aria-pressed','false');expect((await snapshot()).shadow).toBe(true);
    await page.locator('#battery-saver').tap();await expect(page.locator('#battery-saver')).toHaveAttribute('aria-pressed','true');expect((await snapshot()).shadow).toBe(false);
    expect(await page.evaluate(()=>localStorage.getItem('temple-battery-saver'))).toBe('true');
    await page.locator('#settings-toggle').tap();await expect(page.locator('#camera-overhead')).not.toBeVisible();
    await page.screenshot({path:'test-results/mobile-overhead.png'});
    await context.setOffline(true);await page.waitForTimeout(100);await context.setOffline(false);
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
  }finally{await context.close();}
});

for(const viewport of [{width:320,height:640},{width:844,height:390}])test(`touch layout stays usable at ${viewport.width}×${viewport.height}`,async({browser})=>{
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true}),page=await context.newPage();
  try{await page.goto('/');await expect(page.locator('body')).toHaveJSProperty('scrollWidth',viewport.width);await page.locator('#name').fill('An');await page.locator('#join-button').tap();await expect(page.locator('#joystick')).toBeVisible();await expect(page.locator('#sit')).toBeInViewport();await expect(page.locator('#bow')).toBeInViewport();await page.locator('#settings-toggle').tap();await expect(page.locator('#camera-follow')).toBeInViewport();await expect(page.locator('#battery-saver')).toBeInViewport();await page.locator('#settings-toggle').tap();await expect(page.locator('.yard-tools')).not.toBeVisible();await expect(page.locator('.blessing-panel')).toBeInViewport();await page.screenshot({path:`test-results/layout-${viewport.width}.png`});}finally{await context.close();}
});
