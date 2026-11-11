const {test,expect}=require('@playwright/test');
const {inspectPlayer}=require('./helpers/incense');

for(const mobile of [false,true])test(`tap Jerry's cart, inspect prices and close the shop (${mobile?'small phone':'desktop'})`,async({browser})=>{
  const context=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Gap Jerry');await page.locator('#join-button').click();
    await inspectPlayer(page);
    await page.evaluate(()=>{
      const v=window.incenseQA.view,draw=v.renderer.render.bind(v.renderer);
      // Stand on the pond side, where the counter and Jerry face.
      const s=window.TempleIncense.INCENSE_SHOP,x=(s.x-500)/10,z=(s.y-350)/10,fx=Math.sin(s.heading),fz=Math.cos(s.heading);
      v.renderer.render=(scene,camera)=>{if(scene===v.scene){camera.position.set(x+fx*9+fz*2.5,4.2,z+fz*9-fx*2.5);camera.lookAt(x,2.4,z);camera.fov=v.mobile?68:43;camera.updateProjectionMatrix();}draw(scene,camera);};
    });
    await expect.poll(()=>page.evaluate(()=>window.incenseQA.view.camera.position.y)).toBe(4.2);
    const point=await page.evaluate(async()=>{
      const {Vector3}=await import('three'),v=window.incenseQA.view,r=v.canvas.getBoundingClientRect();
      const cart=v.incenseCart.root.position,p=new Vector3(cart.x,2.35,cart.z).project(v.camera),x=r.left+(p.x+1)*r.width/2,y=r.top+(1-p.y)*r.height/2;
      return{x,y,shop:v.pick(x,y)?.incenseShop};
    });
    expect(point.shop).toBe(true);
    if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
    await expect(page.locator('#incense-shop-dialog')).toBeVisible({timeout:15000});
    await expect(page.locator('#shop-blessings')).toHaveText('0');await expect(page.locator('#shop-stock')).toHaveText('0');
    for(const id of ['single','triple','bundle'])await expect(page.locator(`[data-incense-pack="${id}"]`)).toBeDisabled();
    const before=await page.evaluate(()=>({x:window.incenseQA.me.x,y:window.incenseQA.me.y}));
    await page.keyboard.press('w');
    expect(await page.evaluate(()=>({x:window.incenseQA.me.x,y:window.incenseQA.me.y}))).toEqual(before);
    expect(await page.evaluate(()=>document.body.scrollWidth)).toBe(mobile?320:1280);
    await page.screenshot({path:`test-results/jerry-shop-${mobile?'small-phone':'desktop'}.png`});
    await page.keyboard.press('Escape');await expect(page.locator('#incense-shop-dialog')).toBeHidden();
    await expect(page.locator('#open-incense-shop')).toBeVisible();
    const close=await page.locator('#open-incense-shop').boundingBox();expect(close.height).toBeGreaterThanOrEqual(44);
    await page.evaluate(()=>window.incenseQA.view.setTimeOfDay('night'));
    await expect.poll(()=>page.evaluate(()=>window.incenseQA.view.cycle.amount),{timeout:15000}).toBeGreaterThan(.98);
    await page.screenshot({path:`test-results/jerry-cart-night-${mobile?'small-phone':'desktop'}.png`});
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
