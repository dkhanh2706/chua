const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`lotus pond swims and supports meditation (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(60000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Ho sen');await page.locator('#join-button').click();
    await page.evaluate(async mobile=>{
      const {TempleView}=await import('/scene3d.js');
      await new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);window.pondQA=this;window.pondPlayer=args[1].find(p=>p.id===args[3]);if(window.pondPlayer.action==='sit'&&window.pondPreviousAction!=='sit')window.pondSitHeading=this.models.get(args[3]).motionOutput.heading;window.pondPreviousAction=window.pondPlayer.action;resolve();};});
      window.pondQA.setMode('panorama');
      if(mobile)window.pondQA.zoomBy(1.5);
    },mobile);
    await page.waitForTimeout(1200);
    expect(await page.evaluate(()=>window.pondQA.pond.pads.length)).toBe(3);
    const before=await page.evaluate(()=>window.pondQA.pond.fish.map(f=>f.g.position.toArray()));
    await page.waitForTimeout(250);
    expect(await page.evaluate(()=>window.pondQA.pond.fish.map(f=>f.g.position.toArray()))).not.toEqual(before);
    for(const {x,y} of [{x:262,y:451},{x:175,y:401},{x:175,y:501}]){
      const point=await page.evaluate(({x,y})=>window.pondQA.project(x,y),{x,y});
      if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
      await expect.poll(()=>page.evaluate(()=>({x:Math.round(window.pondPlayer.x),y:Math.round(window.pondPlayer.y),action:window.pondPlayer.action})),{timeout:18000}).toEqual({x,y,action:'sit'});
      await expect(page.locator('#sit')).toHaveAttribute('aria-pressed','true');
      await expect.poll(()=>page.evaluate(()=>window.pondQA.models.get(window.pondPlayer.id).motionOutput.sit)).toBe(1);
      await expect.poll(()=>page.evaluate(()=>{const model=window.pondQA.models.get(window.pondPlayer.id),delta=model.root.rotation.y-window.pondSitHeading;return Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)));})).toBeLessThan(.03);
    }
    await expect.poll(()=>page.evaluate(()=>window.pondQA.models.get(window.pondPlayer.id).motionOutput.sit)).toBe(1);
    await page.evaluate(()=>{window.pondQA.setMode('overhead');window.pondQA.yaw=Math.PI;});
    await page.waitForTimeout(500);await page.screenshot({path:`test-results/lotus-meditation-${mobile?'mobile':'desktop'}.png`});
    await page.evaluate(mobile=>{
      const v=window.pondQA,draw=v.renderer.render.bind(v.renderer);
      v.renderer.render=(scene,camera)=>{if(scene===v.scene){camera.fov=mobile?66:50;camera.updateProjectionMatrix();camera.position.set(-13,22,34);camera.lookAt(-29,.2,10);}draw(scene,camera);};
    },mobile);
    await page.waitForTimeout(300);await page.screenshot({path:`test-results/lotus-pond-${mobile?'mobile':'desktop'}.png`});
    await page.locator('#sit').click();
    await expect.poll(()=>page.evaluate(()=>window.pondPlayer.action)).toBe('stand');
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
