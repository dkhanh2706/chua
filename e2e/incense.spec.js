const {test,expect}=require('@playwright/test');
const {inspectPlayer,earnAndBuyIncense}=require('./helpers/incense');

for(const mobile of [false,true])test(`sweep for blessings, buy Jerry's incense and use one stick per completed ritual (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(90000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const touch=selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Dang huong');await touch('#join-button');
    await expect(page.locator('#incense-stock')).toHaveText('0');await expect(page.locator('#incense')).toBeDisabled();
    await page.locator('#canvas').focus();await page.keyboard.press('f');await expect(page.locator('#toast')).toContainText('chưa có nhang');
    await page.locator('#incense-guide').click();await expect(page.locator('#incense-shop-dialog')).toBeVisible({timeout:15000});
    await expect(page.locator('[data-incense-pack]')).toHaveCount(3);
    for(const [id,cost] of [['single',1],['triple',3],['bundle',5]]){await expect(page.locator(`[data-incense-pack="${id}"]`)).toBeDisabled();await expect(page.locator(`[data-incense-pack="${id}"] .pack-buy`)).toContainText(`${cost} phước`);}
    await expect(page.locator('#shop-message')).toContainText('chưa đủ phước');
    await page.screenshot({path:`test-results/incense-shop-empty-${mobile?'mobile':'desktop'}.png`});
    await page.locator('[data-close="incense-shop-dialog"]').click();
    await earnAndBuyIncense(page,'bundle');await expect(page.locator('#incense-stock')).toHaveText('6');
    await inspectPlayer(page);
    expect(await page.evaluate(()=>!!window.incenseQA.view.incenseCart.root.getObjectByName('jerry-incense-seller'))).toBe(true);
    await page.evaluate(()=>{
      const v=window.incenseQA.view,draw=v.renderer.render.bind(v.renderer);window.cartShot=true;
      const s=window.TempleIncense.INCENSE_SHOP,x=(s.x-500)/10,z=(s.y-350)/10,fx=Math.sin(s.heading),fz=Math.cos(s.heading);
      v.renderer.render=(scene,camera)=>{if(scene===v.scene&&window.cartShot){camera.position.set(x+fx*9+fz*2.5,4.2,z+fz*9-fx*2.5);camera.lookAt(x,2.4,z);camera.fov=v.mobile?63:43;camera.updateProjectionMatrix();}draw(scene,camera);};
    });
    await page.waitForTimeout(250);await page.screenshot({path:`test-results/jerry-incense-cart-${mobile?'mobile':'desktop'}.png`});
    await page.evaluate(()=>window.cartShot=false);
    await page.locator('#canvas').focus();await page.keyboard.down('w');
    try{await expect(page.locator('#incense')).toBeEnabled({timeout:18000});}finally{await page.keyboard.up('w');}
    await touch('#incense');
    await page.evaluate(()=>{for(let i=0;i<40;i++){document.getElementById('canvas').dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}));document.getElementById('incense').click();}});
    await expect(page.locator('#incense-count')).toHaveText(/^1\s/);await expect(page.locator('#incense-stock')).toHaveText('5');await expect(page.locator('#incense')).toBeDisabled();
    await expect(page.locator('#incense')).toBeEnabled({timeout:2400});await touch('#incense');
    await expect(page.locator('#incense-count')).toHaveText(/^2\s/);await expect(page.locator('#incense')).toBeDisabled();
    await expect(page.locator('#incense')).toBeEnabled({timeout:2400});await touch('#incense');
    await expect(page.locator('#incense-count')).toHaveText(/^3\s/);await expect(page.locator('#incense-stock')).toHaveText('3');await page.waitForTimeout(1700);
    await expect(page.locator('#incense')).toBeDisabled();await expect(page.locator('#location-hint')).toContainText('3');
    const count=await page.evaluate(async()=>{const{TempleView}=await import('/scene3d.js');return new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);TempleView.prototype.render=render;resolve(this.incenseSmoke.mesh.count);};});});
    expect(count).toBe(15);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
