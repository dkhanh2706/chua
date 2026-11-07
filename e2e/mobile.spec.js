const {test,expect}=require('@playwright/test');
const {io}=require('socket.io-client');

test('phone mode supports five avatars and reachable broom controls without heavy overlays',async({browser})=>{
  const context=await browser.newContext({viewport:{width:320,height:640},isMobile:true,hasTouch:true,deviceScaleFactor:3}),page=await context.newPage(),clients=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await context.addInitScript(()=>localStorage.setItem('temple-battery-saver','true'));
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Dien thoai');await page.locator('#join-button').tap();
    await page.evaluate(async()=>{const{TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);TempleView.prototype.render=render;window.mobileQA=this;resolve();};});});
    const score=await page.locator('#blessing-score').boundingBox();
    await page.touchscreen.tap(score.x+5,score.y+5);await page.touchscreen.tap(score.x+5,score.y+5);
    const gestures=await page.evaluate(()=>{
      const panel=document.querySelector('.blessing-panel'),style=getComputedStyle(document.body);
      return{scale:visualViewport.scale,scrollX,scrollY,select:style.userSelect,touch:style.touchAction,
        menuBlocked:!panel.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))};
    });
    expect(gestures).toEqual({scale:1,scrollX:0,scrollY:0,select:'none',touch:'none',menuBlocked:true});
    await page.evaluate(()=>{window.settingsClicks=0;document.getElementById('settings-toggle').addEventListener('click',()=>window.settingsClicks++);});
    await page.locator('#settings-toggle').tap();await page.locator('#settings-toggle').tap();
    await expect(page.locator('#settings-toggle')).toHaveAttribute('aria-expanded','false');
    expect(await page.evaluate(()=>window.settingsClicks)).toBe(2);
    const labels=await page.evaluate(()=>{
      const label=document.getElementById('sit-label');
      return{select:getComputedStyle(label).webkitUserSelect,selectionBlocked:!label.dispatchEvent(new Event('selectstart',{bubbles:true,cancelable:true})),doubleBlocked:!label.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true})),scale:visualViewport.scale};
    });
    expect(labels).toEqual({select:'none',selectionBlocked:true,doubleBlocked:true,scale:1});
    for(let i=0;i<4;i++){
      const s=io('http://127.0.0.1:3001',{transports:['websocket'],forceNew:true});clients.push(s);
      await new Promise((resolve,reject)=>{s.on('connect',()=>s.emit('join',{name:`Ban ${i}`,character:i%2}));s.once('joined',resolve);s.once('connect_error',reject);});
    }
    await expect.poll(()=>page.evaluate(()=>window.mobileQA.models.size)).toBe(5);
    const state=await page.evaluate(()=>{const v=window.mobileQA;return{ratio:v.renderer.getPixelRatio(),antialias:v.renderer.getContext().getContextAttributes().antialias,bounds:!!v.canvasSize,shadows:v.renderer.shadowMap.enabled,quality:v.quality,fps:v.targetFPS};});
    expect(state.ratio).toBe(1.8);expect(state.antialias).toBe(true);expect(state.shadows).toBe(true);expect(state.quality).toBe('high');expect(state.fps).toBe(60);expect(state.bounds).toBe(true);
    const box=await page.locator('#joystick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-35,y,id:1}]});
    try{await expect(page.locator('#broom-pickup')).toBeEnabled();}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
    await page.locator('#broom-pickup').tap();await expect(page.locator('#broom-hit')).toBeVisible();
    for(const selector of ['#broom-hit','#broom-pickup','#sit','#bow','#incense']){
      await expect(page.locator(selector)).toBeInViewport();const rect=await page.locator(selector).boundingBox();expect(rect.width).toBeGreaterThanOrEqual(44);expect(rect.height).toBeGreaterThanOrEqual(44);
    }
    const controls=await page.evaluate(()=>{
      const stick=document.getElementById('joystick').getBoundingClientRect(),tools=document.querySelector('.yard-tools').getBoundingClientRect();
      return{overlap:stick.left<tools.right&&stick.right>tools.left&&stick.top<tools.bottom&&stick.bottom>tools.top,blur:getComputedStyle(document.querySelector('.yard-tools')).backdropFilter};
    });
    expect(controls.overlap).toBe(false);expect(controls.blur).toBe('none');
    await page.screenshot({path:'test-results/mobile-five-players-controls.png'});
    const startZ=await page.evaluate(()=>window.mobileQA.models.values().next().value.root.position.z),rotateTouch=await context.newCDPSession(page);
    const stick=await page.locator('#joystick').boundingBox(),sx=stick.x+stick.width/2,sy=stick.y+stick.height/2;
    await rotateTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy,id:1}]});
    await rotateTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx,y:sy-35,id:1}]});
    await expect.poll(()=>page.evaluate(()=>window.mobileQA.models.values().next().value.root.position.z),{intervals:[30]}).toBeLessThan(startZ-.5);
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(150);
    const stoppedZ=await page.evaluate(()=>window.mobileQA.models.values().next().value.root.position.z);await page.waitForTimeout(200);
    expect(await page.evaluate(()=>window.mobileQA.models.values().next().value.root.position.z)).toBeCloseTo(stoppedZ,2);
    await rotateTouch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await rotateTouch.detach();
    await expect(page.locator('#broom-hit')).toBeInViewport();await expect(page.locator('#leave')).toBeInViewport();
    await page.screenshot({path:'test-results/mobile-five-players-landscape.png'});expect(errors).toEqual([]);
  }finally{clients.forEach(s=>s.disconnect());await context.close();}
});
