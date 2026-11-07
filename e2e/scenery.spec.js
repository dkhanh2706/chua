const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`blue water, fitted paving and remembered day/night lighting (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(60000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Ngam canh');await page.locator('#join-button').click();
    await page.evaluate(async()=>{
      const {TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);TempleView.prototype.render=render;window.sceneryQA=this;resolve();};});
      const v=window.sceneryQA,draw=v.renderer.render.bind(v.renderer);v.renderer.render=(scene,camera)=>{if(scene===v.scene){camera.fov=55;camera.updateProjectionMatrix();if(window.sceneryClose){const x=(riverX(505)-500)/10;camera.position.set(x+13,12,32);camera.lookAt(x,1,15.5);}else{camera.position.set(55,48,74);camera.lookAt(0,0,-1);}}draw(scene,camera);};
    });
    expect(await page.evaluate(()=>window.sceneryQA.landscape.riverGarden.fish.length)).toBe(16);
    const before=await page.evaluate(()=>window.sceneryQA.landscape.riverGarden.fish.map(f=>f.g.position.toArray()));
    await expect.poll(()=>page.evaluate(()=>window.sceneryQA.landscape.riverGarden.fish.map(f=>f.g.position.toArray()))).not.toEqual(before);
    expect(await page.evaluate(async()=>{
      const {Raycaster,Vector3}=await import('three'),v=window.sceneryQA,ray=new Raycaster();
      const paving=[v.landscape.paving,v.worldRoot.getObjectByName('shore-and-temple-cut-paving')];v.worldRoot.updateMatrixWorld(true);
      return [[19.2,-10.2],[-15.7,10.1],[-29.6,.9],[-49.8,17],[49,27]].map(([x,z])=>{ray.set(new Vector3(x,2,z),new Vector3(0,-1,0));return ray.intersectObjects(paving).length>0;});
    })).toEqual([true,true,true,true,true]);
    await page.screenshot({path:`test-results/scenery-day-${mobile?'mobile':'desktop'}.png`});
    if(mobile)await page.locator('#settings-toggle').tap();
    await page.locator('#time-of-day').click();await expect(page.locator('#time-of-day')).toHaveAttribute('aria-pressed','true');
    await expect.poll(()=>page.evaluate(()=>window.sceneryQA.cycle.amount)).toBeGreaterThan(.98);
    expect(await page.evaluate(()=>window.sceneryQA.cycle.lights.every(l=>l.intensity>10))).toBe(true);
    expect(await page.evaluate(()=>window.sceneryQA.cycle.emitters.every(m=>m.emissiveIntensity>1))).toBe(true);
    if(mobile)await page.locator('#settings-toggle').tap();
    await page.screenshot({path:`test-results/scenery-night-${mobile?'mobile':'desktop'}.png`});
    await page.evaluate(()=>{window.sceneryClose=true;});
    // Use a dedicated close view so bridge lanterns and underwater fish can be reviewed.
    await page.waitForTimeout(250);await page.screenshot({path:`test-results/bridge-night-${mobile?'mobile':'desktop'}.png`});
    await page.reload();await expect(page.locator('#time-of-day')).toHaveAttribute('aria-pressed','true');
    await page.locator('#next-button').click();await page.locator('#name').fill('Ngay moi');await page.locator('#join-button').click();
    if(mobile)await page.locator('#settings-toggle').tap();
    await page.locator('#time-of-day').click();await expect(page.locator('#canvas')).toHaveAttribute('data-time-of-day','day');
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
