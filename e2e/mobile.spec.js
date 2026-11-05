const {test,expect}=require('@playwright/test');
const {io}=require('socket.io-client');

test('phone mode supports five avatars and reachable broom controls without heavy overlays',async({browser})=>{
  const context=await browser.newContext({viewport:{width:320,height:640},isMobile:true,hasTouch:true,deviceScaleFactor:3}),page=await context.newPage(),clients=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#name').fill('Dien thoai');await page.locator('#join-button').tap();
    await page.evaluate(async()=>{const{TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);TempleView.prototype.render=render;window.mobileQA=this;resolve();};});});
    for(let i=0;i<4;i++){
      const s=io('http://127.0.0.1:3001',{transports:['websocket'],forceNew:true});clients.push(s);
      await new Promise((resolve,reject)=>{s.on('connect',()=>s.emit('join',{name:`Ban ${i}`,character:i%2}));s.once('joined',resolve);s.once('connect_error',reject);});
    }
    await expect.poll(()=>page.evaluate(()=>window.mobileQA.models.size)).toBe(5);
    const state=await page.evaluate(()=>{const v=window.mobileQA;return{ratio:v.renderer.getPixelRatio(),antialias:v.renderer.getContext().getContextAttributes().antialias,bounds:!!v.canvasSize};});
    expect(state.ratio).toBeLessThanOrEqual(1.2);expect(state.antialias).toBe(false);expect(state.bounds).toBe(true);
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
    await page.screenshot({path:'test-results/mobile-five-players-controls.png'});expect(errors).toEqual([]);
  }finally{clients.forEach(s=>s.disconnect());await context.close();}
});
