const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`warm temple interior, fans and indoor incense (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(45000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#name').fill('Vieng chua');await page.locator('#join-button').click();
    await page.evaluate(async()=>{const {TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const original=TempleView.prototype.render;TempleView.prototype.render=function(...args){original.apply(this,args);TempleView.prototype.render=original;window.interiorQA=this;resolve();};});});
    await page.locator('#canvas').focus();await page.keyboard.down('w');
    try{await expect(page.locator('#incense')).toBeEnabled({timeout:18000});}finally{await page.keyboard.up('w');}
    await expect(page.locator('#canvas')).toHaveAttribute('data-location','hall');
    await page.waitForTimeout(1200);
    const before=await page.evaluate(()=>{const v=window.interiorQA;v.yaw=-.43;v.eyePitch=-.18;return{fan:v.interior.fans[0].rotation.y,ambient:v.daylight.intensity,floor:v.interior.floor.count,sofas:v.interior.seats.children.filter(o=>o.name==='three-seat-sofa').length,urnY:v.urn.position.y};});
    expect(before.ambient).toBeLessThan(.65);expect(before.floor).toBe(171);expect(before.sofas).toBe(4);expect(before.urnY).toBe(1.2);
    await page.waitForTimeout(300);expect(await page.evaluate(()=>window.interiorQA.interior.fans[0].rotation.y)).toBeGreaterThan(before.fan);
    await page.screenshot({path:`test-results/interior-${mobile?'mobile':'desktop'}.png`});
    await page.locator('#incense').click();
    await expect.poll(()=>page.evaluate(()=>window.interiorQA.incense.size)).toBe(1);
    const stick=await page.evaluate(()=>{const v=window.interiorQA,g=[...v.incense.values()][0];return{parent:g.parent.name,sand:g.position.y,tip:g.userData.ember.position.y};});
    expect(stick.parent).toBe('indoor-incense-burner');expect(stick.sand).toBeCloseTo(1.46);expect(stick.tip).toBeGreaterThan(.9);
    await page.waitForTimeout(1600);
    if(!mobile){
      await page.evaluate(()=>{window.interiorQA.eyePitch=-.8;window.interiorQA.yaw=-.7;});await page.waitForTimeout(300);await page.screenshot({path:'test-results/interior-ceiling.png'});
      await page.evaluate(()=>{window.interiorQA.eyePitch=.65;window.interiorQA.yaw=-1.1;});await page.waitForTimeout(300);await page.screenshot({path:'test-results/interior-floor.png'});
    }
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
