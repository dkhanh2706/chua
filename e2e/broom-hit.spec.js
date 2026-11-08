const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`a held broom always offers a forward swing, misses are free and front hits share a penalty (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(60000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const pages=[],errors=[];
  const touch=async(page,selector)=>mobile?page.locator(selector).tap():page.locator(selector).click();
  async function approachRack(page){
    await page.bringToFront();
    if(mobile){
      const box=await page.locator('#joystick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-35,y,id:1}]});
      try{await expect(page.locator('#broom-pickup')).toBeEnabled({timeout:6000});}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
    }else{
      await page.locator('#canvas').focus();await page.keyboard.down('a');
      try{await expect(page.locator('#broom-pickup')).toBeEnabled({timeout:6000});}finally{await page.keyboard.up('a');}
    }
    await page.waitForTimeout(200);await touch(page,'#broom-pickup');
  }
  try{
    for(const name of ['An','Binh']){
      const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
      await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill(name);await touch(page,'#join-button');await expect(page.locator('#game')).toBeVisible();
    }
    const [a,b]=pages;await expect(a.locator('#players li')).toHaveCount(2);await expect(b.locator('#players li')).toHaveCount(2);
    await approachRack(a);await expect(a.locator('#broom-hit')).toBeEnabled();
    await expect(a.locator('#hit-label')).toHaveText('Var nhau');
    await pageHook(a);await touch(a,'#broom-hit');
    await expect.poll(()=>a.evaluate(()=>window.hitQA.self.hitStart>0)).toBe(true);
    await expect.poll(()=>a.evaluate(()=>window.hitQA.samples.some(s=>s.age>.43)),{intervals:[30],timeout:2000}).toBe(true);
    const samples=await a.evaluate(()=>window.hitQA.samples),high=samples.find(s=>s.age>=.12&&s.age<.24),low=samples.findLast(s=>s.age>.40);
    const contact=samples.reduce((a,b)=>Math.abs(a.age-.30)<Math.abs(b.age-.30)?a:b);
    expect(high).toBeTruthy();expect(low).toBeTruthy();
    expect(high.x).toBeLessThan(-.35);expect(high.y).toBeGreaterThan(.35);
    expect(contact.z).toBeGreaterThan(.88);expect(Math.abs(contact.y)).toBeLessThan(.3);
    expect(low.x).toBeGreaterThan(.35);expect(low.y).toBeLessThan(-.35);
    expect(samples.every(s=>s.gripDistance<.01)).toBe(true);
    await expect(a.locator('#broom-hit')).toBeDisabled();
    await expect(a.locator('#toast')).toContainText('hụt');await expect(a.locator('#blessing-score')).toHaveText('0');
    // Turn by walking east. The other visitor is in front and carries no broom.
    await expect(a.locator('#broom-hit')).toBeEnabled();
    const inFront=()=>a.evaluate(()=>window.hitQA.self.x>=window.hitQA.other.x-28);
    if(mobile){
      const box=await a.locator('#joystick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,cdp=await context.newCDPSession(a);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y,id:1}]});
      try{await expect.poll(inFront,{intervals:[30],timeout:8000}).toBe(true);}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
    }else{
      await a.locator('#canvas').focus();await a.keyboard.down('d');
      try{await expect.poll(inFront,{intervals:[30],timeout:8000}).toBe(true);}finally{await a.keyboard.up('d');}
    }
    await a.waitForTimeout(300);await expect(a.locator('#broom-hit')).toBeEnabled();
    const approach=await a.evaluate(()=>{const{self,other,view}=window.hitQA;return{dx:other.x-self.x,dy:other.y-self.y,heading:view.models.get(self.id).root.rotation.y};});
    expect(approach.dx,JSON.stringify(approach)).toBeGreaterThan(5);expect(approach.dx,JSON.stringify(approach)).toBeLessThan(40);
    expect(Math.sin(approach.heading),JSON.stringify(approach)).toBeGreaterThan(.9);
    await touch(a,'#broom-hit');
    await expect(a.locator('#blessing-score')).toHaveText('-1');
    await expect.poll(()=>a.evaluate(()=>window.hitQA.other.struckStart>0)).toBe(true);
    await a.screenshot({path:`test-results/broom-hit-${mobile?'mobile':'desktop'}.png`});
    await b.bringToFront();await expect(b.locator('#blessing-score')).toHaveText('0');await expect(b.locator('#broom-hit')).not.toBeVisible();
    await pageHook(b);expect(await b.evaluate(()=>window.hitQA.other.blessings)).toBe(-1);
    const c=await context.newPage();pages.push(c);await c.goto('/');await c.locator('#next-button').click();await c.locator('#name').fill('Late');await touch(c,'#join-button');await pageHook(c);
    expect(await c.evaluate(()=>window.hitQA.players.filter(p=>p.name!=='Late').map(p=>p.blessings))).toEqual([-1,0]);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});

async function pageHook(page){
  await page.evaluate(async()=>{
    const[{TempleView},{Vector3}]=await Promise.all([import('/scene3d.js'),import('three')]);await new Promise(resolve=>{
      const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){
        render.apply(this,args);
        const self=args[1].find(p=>p.id===args[3]),previous=window.hitQA,samples=previous&&previous.strokeStart===self.hitStart?previous.samples:[];
        window.hitQA={view:this,players:args[1],self,other:args[1].find(p=>p.id!==args[3]),strokeStart:self.hitStart,samples};
        const age=args[0]-(self.hitStart??-100),broom=this.yardCare.carried.get(self.id),m=this.models.get(self.id);
        if(broom&&m&&age>=.1&&age<=.5){
          const grip=broom.localToWorld(new Vector3(0,1.35,0)),hand=m.wrists[0].localToWorld(new Vector3(0,-.08,.018));
          const direction=new Vector3(0,-1,0).applyQuaternion(broom.quaternion).applyAxisAngle(new Vector3(0,1,0),-self.hitHeading);
          samples.push({age,x:direction.x,y:direction.y,z:direction.z,gripDistance:grip.distanceTo(hand)});
        }
        resolve();
      };
    });
  });
}
