const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`incense can follow the finished ritual immediately while repeated input cannot spam (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(45000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const touch=selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
  try{
    await page.goto('/');await page.locator('#name').fill('Dang huong');await touch('#join-button');
    await page.locator('#canvas').focus();await page.keyboard.down('w');
    try{await expect(page.locator('#incense')).toBeEnabled({timeout:18000});}finally{await page.keyboard.up('w');}
    await touch('#incense');
    await page.evaluate(()=>{for(let i=0;i<40;i++){document.getElementById('canvas').dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}));document.getElementById('incense').click();}});
    await expect(page.locator('#incense-count')).toHaveText(/^1\s/);await expect(page.locator('#incense')).toBeDisabled();
    await expect(page.locator('#incense')).toBeEnabled({timeout:2400});await touch('#incense');
    await expect(page.locator('#incense-count')).toHaveText(/^2\s/);await expect(page.locator('#incense')).toBeDisabled();
    await expect(page.locator('#incense')).toBeEnabled({timeout:2400});await touch('#incense');
    await expect(page.locator('#incense-count')).toHaveText(/^3\s/);await page.waitForTimeout(1700);
    await expect(page.locator('#incense')).toBeDisabled();await expect(page.locator('#location-hint')).toContainText('3');
    const count=await page.evaluate(async()=>{const{TempleView}=await import('/scene3d.js');return new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);TempleView.prototype.render=render;resolve(this.incenseSmoke.mesh.count);};});});
    expect(count).toBe(15);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
