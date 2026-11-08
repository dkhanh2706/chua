const {test,expect}=require('@playwright/test');
const {io}=require('socket.io-client');

for(const mobile of [false,true])test(`take a broom, sweep shared leaves and earn blessings (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(65000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];let observer;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  async function moveUntil(direction,selector){
    if(mobile){
      const pad=await page.locator('#joystick').boundingBox(),x=pad.x+pad.width/2,y=pad.y+pad.height/2,cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+direction*32,y,id:1}]});
      try{await expect(page.locator(selector)).toBeEnabled({timeout:5000});}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
    }else{
      const key=direction<0?'a':'d';await page.locator('#canvas').focus();await page.keyboard.down(key);try{await expect(page.locator(selector)).toBeEnabled({timeout:5000});}finally{await page.keyboard.up(key);}
    }
    await page.waitForTimeout(150);
  }
  const touch=selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Quet san');await page.locator('#join-button').click();
    await page.evaluate(async()=>{const {TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const original=TempleView.prototype.render;TempleView.prototype.render=function(...args){original.apply(this,args);TempleView.prototype.render=original;window.yardQA=this;resolve();};});});
    await expect(page.locator('.blessing-panel')).toBeVisible();await expect(page.locator('#blessing-score')).toHaveText('0');await expect(page.locator('.yard-tools')).not.toBeVisible();
    const models=await page.evaluate(()=>({lamps:window.yardQA.yardCare.lights.length,racks:window.yardQA.yardCare.racks.length,leaves:window.yardQA.yardCare.patches.size}));expect(models).toEqual({lamps:4,racks:3,leaves:10});
    const stream=await page.evaluate(()=>Array.from(window.yardQA.yardCare.leafStream.instanceMatrix.array));await page.waitForTimeout(200);
    expect(await page.evaluate(()=>window.yardQA.yardCare.leafStream.count)).toBe(60);expect(await page.evaluate(()=>Array.from(window.yardQA.yardCare.leafStream.instanceMatrix.array))).not.toEqual(stream);
    await moveUntil(-1,'#broom-pickup');await expect(page.locator('#broom-pickup')).toBeVisible();
    await expect(page.locator('#broom-label')).toHaveText('Lấy chổi');await expect(page.locator('#sweep-leaves')).not.toBeVisible();await touch('#broom-pickup');
    await expect(page.locator('#broom-pickup')).toHaveAttribute('aria-pressed','true');
    await expect.poll(()=>page.evaluate(()=>[...window.yardQA.yardCare.carried.values()].some(b=>b.visible))).toBe(true);
    await moveUntil(-1,'#sweep-leaves');await expect(page.locator('#sweep-leaves')).toBeVisible();
    await page.evaluate(()=>{const v=window.yardQA,p=v.yardCare.patches.get('leaves-0').patch;v.yaw=Math.atan2(v.camera.position.x-(p.x-500)/10,v.camera.position.z-(p.y-350)/10);v.pitch=.65;});
    await page.waitForTimeout(250);await page.screenshot({path:`test-results/sweeping-${mobile?'mobile':'desktop'}.png`});
    await touch('#sweep-leaves');
    await expect(page.locator('#blessing-score')).toHaveText('1');await expect.poll(()=>page.evaluate(()=>window.yardQA.yardCare.patches.get('leaves-0').mesh.visible)).toBe(false);
    await page.waitForTimeout(1100);await expect(page.locator('#blessing-score')).toHaveText('1');await expect(page.locator('#sweep-leaves')).not.toBeVisible();
    const lateJoin=await new Promise((resolve,reject)=>{observer=io('http://127.0.0.1:3001',{transports:['websocket'],forceNew:true});observer.on('connect',()=>observer.emit('join',{name:'Watching',character:0}));observer.on('joined',resolve);observer.on('connect_error',reject);});
    expect(lateJoin.leaves.find(p=>p.id==='leaves-0').readyIn).toBeGreaterThan(0);expect(lateJoin.players.find(p=>p.name==='Quet san').blessings).toBe(1);
    if(!mobile){
      // The same pile returns by falling from its own tree, then becomes sweepable.
      await expect.poll(()=>page.evaluate(()=>window.yardQA.yardCare.patches.get('leaves-0').mesh.visible),{timeout:2500}).toBe(true);
      const falling=await page.evaluate(()=>{const e=window.yardQA.yardCare.patches.get('leaves-0');return Math.max(...Array.from({length:e.mesh.count},(_,i)=>e.mesh.instanceMatrix.array[i*16+13]));});expect(falling).toBeGreaterThan(1);
      await expect(page.locator('#sweep-leaves')).toBeEnabled({timeout:4000});await touch('#sweep-leaves');await expect(page.locator('#blessing-score')).toHaveText('2');
      await page.waitForTimeout(1000);await page.locator('#camera-panorama').click();await page.locator('#camera-reset').click();await page.waitForTimeout(900);await page.screenshot({path:'test-results/street-lights-overview.png'});
    }
    await page.evaluate(()=>window.yardQA.resetCamera());await moveUntil(1,'#broom-pickup');await expect(page.locator('#broom-label')).toHaveText('Trả chổi');await touch('#broom-pickup');
    await expect(page.locator('#broom-label')).toHaveText('Lấy chổi');await expect.poll(()=>page.evaluate(()=>[...window.yardQA.yardCare.carried.values()].some(b=>b.visible))).toBe(false);
    expect(errors).toEqual([]);
  }finally{observer?.disconnect();await context.close();}
});
