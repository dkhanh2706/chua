const{test,expect}=require('@playwright/test');

test('character preview shows distance-driven walking, smooth meditation, bow and incense with grounded feet',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/');await page.getByRole('tab',{name:'Tóc',exact:true}).tap();await page.locator('#style-hair').selectOption('bald');await page.getByRole('tab',{name:'Áo',exact:true}).tap();await page.getByLabel('Mã màu áo',{exact:true}).fill('#a87957');
    await page.evaluate(async()=>{const{AvatarStudio}=await import('/avatar-studio.mjs');await new Promise(resolve=>{const original=AvatarStudio.prototype.render;AvatarStudio.prototype.render=function(...args){original.apply(this,args);AvatarStudio.prototype.render=original;window.motionPreview=this;resolve();};});});
    const pose=()=>page.evaluate(()=>{const m=window.motionPreview.model;return{...m.motionOutput,rootY:m.root.position.y,shadowY:m.root.position.y+m.shadow.position.y,stick:m.heldIncense.visible,blink:m.eyes[0].scale.y};});
    await page.locator('.avatar-pane').screenshot({path:'test-results/redesign-standing.png'});
    await page.getByRole('button',{name:'Đi',exact:true}).tap();await expect.poll(async()=>(await pose()).name).toBe('walk');const phase=(await pose()).phase;await page.waitForTimeout(180);expect((await pose()).phase).toBeGreaterThan(phase);
    await page.getByRole('button',{name:'Đứng',exact:true}).tap();await expect.poll(async()=>(await pose()).name).toBe('idle');const stopped=(await pose()).phase;await page.waitForTimeout(130);expect((await pose()).phase).toBe(stopped);
    await page.getByRole('button',{name:'Thiền',exact:true}).tap();await expect.poll(async()=>(await pose()).name).toBe('sit_down');await expect.poll(async()=>(await pose()).name).toBe('sit_idle');expect((await pose()).rootY).toBeLessThan(-.2);expect((await pose()).shadowY).toBeCloseTo(.012,3);await page.locator('.avatar-pane').screenshot({path:'test-results/redesign-meditation.png'});
    await page.getByRole('button',{name:'Đứng',exact:true}).tap();await expect.poll(async()=>(await pose()).name).toBe('sit_up');await expect.poll(async()=>(await pose()).name).toBe('idle');
    await page.getByRole('button',{name:'Lạy',exact:true}).tap();await expect.poll(async()=>(await pose()).bow,{intervals:[30]}).toBeGreaterThan(.85);expect((await pose()).locked).toBe(true);await page.locator('.avatar-pane').screenshot({path:'test-results/redesign-bow.png'});await expect.poll(async()=>(await pose()).name).toBe('idle');
    await page.getByRole('button',{name:'Hương',exact:true}).tap();await expect.poll(async()=>(await pose()).stick,{intervals:[30]}).toBe(true);await page.waitForTimeout(300);await page.locator('.avatar-pane').screenshot({path:'test-results/redesign-incense.png'});await expect.poll(async()=>(await pose()).name).toBe('idle');expect((await pose()).stick).toBe(false);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
