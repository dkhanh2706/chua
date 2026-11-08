const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`Doraemon code, animated preview and shared character (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(70000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:950},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');
    await page.evaluate(async()=>{
      const {TempleView}=await import('/scene3d.js');
      await new Promise(resolve=>{const render=TempleView.prototype.renderCreator;TempleView.prototype.renderCreator=function(...args){render.apply(this,args);TempleView.prototype.renderCreator=render;window.doraView=this;resolve();};});
    });
    await page.locator('#character-code').fill('doraemon');await page.locator('#next-button').click();
    await expect(page.locator('#character-code')).toHaveAttribute('aria-invalid','true');
    await page.locator('#character-code').fill(' CHỒN '.normalize('NFD'));
    await expect(page.locator('#character-code-hint')).toHaveText('Đã chọn Doraemon.');
    await expect.poll(()=>page.evaluate(()=>window.doraView.studio.model.appearance.special)).toBe('doraemon');
    for(const angle of [0,90,180,270]){
      await page.evaluate(angle=>window.doraView.studio.rotate(angle*Math.PI/180),angle);await page.waitForTimeout(100);
      await page.locator('#canvas').screenshot({path:`test-results/doraemon-${angle}-${mobile?'mobile':'desktop'}.png`});
    }
    await page.evaluate(()=>window.doraView.studio.rotate(0));
    await page.locator('[data-preview-action="walk"]').click();
    await expect.poll(()=>page.evaluate(()=>window.doraView.studio.model.motionOutput.moveBlend)).toBeGreaterThan(.9);
    await page.locator('[data-preview-action="sit"]').click();
    await expect.poll(()=>page.evaluate(()=>window.doraView.studio.model.motionOutput.sit)).toBeGreaterThan(.99);
    await page.locator('#canvas').screenshot({path:`test-results/doraemon-sit-${mobile?'mobile':'desktop'}.png`});
    await page.locator('[data-preview-action="idle"]').click();
    await page.locator('#character-code').fill('tom');
    await expect.poll(()=>page.evaluate(()=>window.doraView.studio.model.appearance.special)).toBe('tom');
    await page.locator('#character-code').fill('');
    await expect.poll(()=>page.evaluate(()=>window.doraView.studio.model.appearance.special||'normal')).toBe('normal');
    await page.locator('#character-code').fill('chồn');
    await page.locator('#next-button').click();await page.locator('#name').fill('Doraemon');await page.locator('#join-button').click();
    await expect(page.locator('#game')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>[...window.doraView.models.values()].some(m=>m.appearance.special==='doraemon'))).toBe(true);
    const other=await context.newPage();other.on('pageerror',e=>errors.push(e.message));
    await other.goto('/');await other.locator('#next-button').click();await other.locator('#name').fill('Ban Doraemon');await other.locator('#join-button').click();
    const shared=await other.evaluate(async()=>{
      const {TempleView}=await import('/scene3d.js');
      return new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);TempleView.prototype.render=render;resolve([...this.models.values()].some(m=>m.appearance.special==='doraemon'&&!!m.root.getObjectByName('doraemon-pocket')));};});
    });
    expect(shared).toBe(true);
    await page.bringToFront();await page.locator('#sit').click();await expect(page.locator('#sit-label')).toHaveText('Đứng dậy');
    await page.screenshot({path:`test-results/doraemon-in-garden-${mobile?'mobile':'desktop'}.png`});
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
