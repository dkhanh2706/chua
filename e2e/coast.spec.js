const {test,expect}=require('@playwright/test');
const {io}=require('socket.io-client');

for(const mobile of [false,true])test(`walk from the pond to the coast, tap sloping sand and view the sea (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(100000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];let observer,remote;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  async function walk(dx,dy,predicate){
    if(mobile){
      const rect=await page.locator('#joystick').boundingBox(),x=rect.x+rect.width/2,y=rect.y+rect.height/2,cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*35,y:y+dy*35,id:1}]});
      try{await expect.poll(()=>page.evaluate(predicate),{timeout:25000,intervals:[100]}).toBe(true);}
      finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
    }else{
      const key=dx<0?'a':dx>0?'d':dy<0?'w':'s';await page.locator('#canvas').focus();await page.keyboard.down(key);
      try{await expect.poll(()=>page.evaluate(predicate),{timeout:25000,intervals:[100]}).toBe(true);}
      finally{await page.keyboard.up(key);}
    }
    await page.waitForTimeout(150);
  }
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Dao bien');await page.locator('#join-button').click();
    await page.evaluate(async()=>{
      const {TempleView}=await import('/scene3d.js');
      await new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);TempleView.prototype.render=render;window.coastQA={view:this,me:args[1].find(p=>p.id===args[3])};resolve();};});
      window.coastQA.view.setMode('follow');window.coastQA.view.yaw=0;
    });
    const myId=await page.evaluate(()=>window.coastQA.me.id);
    observer=io('http://127.0.0.1:3001',{transports:['websocket'],forceNew:true});
    observer.on('state',state=>{remote=state.find(p=>p.id===myId)||remote;});
    await new Promise((resolve,reject)=>{observer.on('connect',()=>observer.emit('join',{name:'Observer',character:0}));observer.on('joined',resolve);observer.on('connect_error',reject);});
    await walk(-1,0,()=>window.coastQA.me.x<55);
    await walk(0,-1,()=>window.coastQA.me.y< -190);
    await expect.poll(()=>remote?.y).toBeLessThan(0);
    expect(await page.evaluate(()=>window.coastQA.view.models.get(window.coastQA.me.id).root.position.y)).toBeLessThan(-.1);
    expect(await page.evaluate(async()=>{
      const {Raycaster,Vector3}=await import('three'),ray=new Raycaster(),water=window.coastQA.view.coast.water;
      water.updateWorldMatrix(true,false);
      return [[-120,-17],[120,-17],[0,115],[0,-130]].map(([x,z])=>{
        ray.set(new Vector3(x,30,z),new Vector3(0,-1,0));return coastProgress(x,z)>1&&ray.intersectObject(water).length>0;
      });
    })).toEqual([true,true,true,true]);
    await page.evaluate(()=>{
      const v=window.coastQA.view,draw=v.renderer.render.bind(v.renderer);window.coastShot='sand';
      v.renderer.render=(scene,camera)=>{
        if(scene===v.scene){
          camera.fov=55;camera.updateProjectionMatrix();
          if(window.coastShot==='sand'){camera.position.set(-28,19,-40);camera.lookAt(-28,-1.5,-64);}
          else if(window.coastShot==='sea'){camera.position.set(-28,2.7,-60);camera.lookAt(-22,1.8,-190);}
          else{const mobile=window.innerWidth<800;camera.fov=mobile?74:55;camera.updateProjectionMatrix();camera.position.set(mobile?190:145,mobile?180:128,mobile?245:180);camera.lookAt(0,-.5,-14);}
        }
        draw(scene,camera);
      };
    });
    await page.waitForTimeout(300);
    const target=await page.evaluate(()=>{
      const x=200,y=(coastShoreZ(-30)+6)*10+350,p=window.coastQA.view.project(x,y);return{x,y,screen:p};
    });
    if(mobile)await page.touchscreen.tap(target.screen.x,target.screen.y);else await page.mouse.click(target.screen.x,target.screen.y);
    await expect.poll(()=>page.evaluate(target=>Math.hypot(window.coastQA.me.x-target.x,window.coastQA.me.y-target.y),target),{timeout:20000}).toBeLessThan(2);
    await expect.poll(()=>Math.hypot((remote?.x??10000)-target.x,(remote?.y??10000)-target.y)).toBeLessThan(2);
    await page.screenshot({path:`test-results/coast-sand-${mobile?'mobile':'desktop'}.png`});
    expect(await page.evaluate(()=>window.coastQA.view.coast.boats.length)).toBe(5);
    const before=await page.evaluate(()=>window.coastQA.view.coast.boats[0].root.position.y);
    await expect.poll(()=>page.evaluate(()=>window.coastQA.view.coast.boats[0].root.position.y)).not.toBe(before);
    for(const shot of ['sea','overview']){
      await page.evaluate(shot=>window.coastShot=shot,shot);await page.waitForTimeout(300);
      await page.screenshot({path:`test-results/coast-${shot}-day-${mobile?'mobile':'desktop'}.png`});
    }
    if(mobile)await page.locator('#settings-toggle').tap();await page.locator('#time-of-day').click();
    await expect.poll(()=>page.evaluate(()=>window.coastQA.view.cycle.amount),{timeout:20000}).toBeGreaterThan(.99);
    if(mobile)await page.locator('#settings-toggle').tap();
    for(const shot of ['sea','overview']){
      await page.evaluate(shot=>window.coastShot=shot,shot);await page.waitForTimeout(300);
      await page.screenshot({path:`test-results/coast-${shot}-night-${mobile?'mobile':'desktop'}.png`});
    }
    expect(errors).toEqual([]);
  }finally{observer?.disconnect();await context.close();}
});
