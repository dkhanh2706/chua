const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`moon garden seating and automatic fireworks (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(60000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Ngắm trăng');await page.locator('#join-button').click();
    await page.evaluate(async()=>{const {TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);window.moonQA={view:this,me:args[1].find(p=>p.id===args[3])};resolve();};});});
    expect(await page.evaluate(()=>WATCH_SEATS.length)).toBe(6);
    // Select the distant bench through the same pick + route flow as a tap.
    await page.evaluate(()=>{const v=window.moonQA.view,pick=v.pick;v.pick=function(){v.pick=pick;const s=WATCH_SEATS[1];return{x:s.x,y:s.y,sofaSeatId:s.id};};});
    const canvas=await page.locator('#canvas').boundingBox();await page.mouse.click(canvas.width*.6,canvas.height*.55);
    await expect.poll(()=>page.evaluate(()=>window.moonQA.me.sofaSeatId),{timeout:20000}).toBe('watch-bench-0-0');
    await expect(page.locator('#canvas')).toHaveAttribute('data-watching-fireworks','true');await expect(page.locator('#canvas')).toHaveAttribute('data-time-of-day','night');
    await expect(page.locator('#time-of-day')).toBeDisabled();
    await expect.poll(()=>page.evaluate(()=>window.moonQA.view.cycle.amount)).toBeGreaterThan(.95);
    const scene=await page.evaluate(()=>{const v=window.moonQA.view,moon=v.moonGarden.moon.position.clone().project(v.camera);return{moon:v.moonGarden.moon.visible,moonInView:Math.abs(moon.x)<1&&Math.abs(moon.y)<1,fireworks:v.moonGarden.fireworks.visible,glow:v.pond.bed.material.emissiveIntensity,seatHeight:v.models.get(window.moonQA.me.id).root.position.y,particles:v.moonGarden.fireworks.geometry.attributes.position.count};});
    expect(scene.moon).toBe(true);expect(scene.moonInView).toBe(true);expect(scene.fireworks).toBe(true);expect(scene.glow).toBeGreaterThan(.5);expect(scene.particles).toBe(512);expect(scene.seatHeight).toBeCloseTo(.355,1);
    await page.waitForTimeout(1200);await page.screenshot({path:`test-results/moon-garden-${mobile?'mobile':'desktop'}.png`});
    const initialCamera=await page.evaluate(()=>({position:window.moonQA.view.camera.position.toArray(),yaw:window.moonQA.view.watchYaw,rotation:window.moonQA.view.camera.quaternion.toArray()}));
    const drag=async(from,to)=>{
      const y=canvas.height*.4;
      if(mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:to,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
      else{await page.mouse.move(from,y);await page.mouse.down();await page.mouse.move(to,y,{steps:8});await page.mouse.up();}
    };
    await drag(canvas.width*.55,canvas.width*.78);
    await expect.poll(()=>page.evaluate(()=>window.moonQA.view.watchYaw)).toBeLessThan(-.1);
    await expect.poll(()=>page.evaluate(rotation=>{const q=window.moonQA.view.camera.quaternion.toArray();return 1-Math.abs(q.reduce((sum,n,i)=>sum+n*rotation[i],0));},initialCamera.rotation)).toBeGreaterThan(.001);
    await drag(canvas.width*.78,canvas.width*.40);
    await expect.poll(()=>page.evaluate(()=>window.moonQA.view.watchYaw)).toBeGreaterThan(.1);
    expect(await page.evaluate(()=>window.moonQA.me.sofaSeatId)).toBe('watch-bench-0-0');
    expect(await page.evaluate(position=>window.moonQA.view.camera.position.distanceTo({x:position[0],y:position[1],z:position[2]}),initialCamera.position)).toBeLessThan(.05);
    await page.evaluate(()=>window.moonQA.view.resetCamera());
    await expect.poll(()=>page.evaluate(()=>window.moonQA.view.watchYaw)).toBe(0);
    await page.locator('#sit').click();await expect.poll(()=>page.evaluate(()=>window.moonQA.me.sofaSeatId)).toBeNull();
    await expect(page.locator('#canvas')).toHaveAttribute('data-time-of-day','day');await expect(page.locator('#time-of-day')).toBeEnabled();
    await page.waitForTimeout(600);await page.evaluate(()=>{window.moonQA.view.setMode('overhead');window.moonQA.view.yaw=0;});await page.waitForTimeout(600);
    const point=await page.evaluate(async()=>{const {Vector3}=await import('three'),v=window.moonQA.view,s=WATCH_SEATS[1],p=new Vector3((s.x-500)/10,s.height+.02,(s.y-350)/10).project(v.camera),r=v.canvas.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};});
    expect(await page.evaluate(p=>window.moonQA.view.pick(p.x,p.y)?.sofaSeatId,point)).toBe('watch-bench-0-0');
    if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
    await expect.poll(()=>page.evaluate(()=>window.moonQA.me.sofaSeatId)).toBe('watch-bench-0-0');
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
