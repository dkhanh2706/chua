const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`warm temple interior, fans and indoor incense (${mobile?'mobile':'desktop'})`,async({browser})=>{
  test.setTimeout(45000);
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];
  await context.addInitScript(()=>{for(const i of [0,1])localStorage.setItem(`temple-statue-portrait-${i}`,'old-browser-upload');});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#name').fill('Vieng chua');await page.locator('#join-button').click();
    await page.evaluate(async()=>{const {TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const original=TempleView.prototype.render;TempleView.prototype.render=function(...args){
      original.apply(this,args);window.interiorQA=this;const me=args[1].find(p=>p.id===args[3]);
      if(me&&Math.abs(me.y-HALL_ENTRY.y)<45){this.entranceAngles??=[];this.entranceAngles.push(Math.atan2(this.camera.position.x-this.look.x,this.camera.position.z-this.look.z));}
      if(me&&me.y<HALL_ENTRY.y-50)TempleView.prototype.render=original;resolve();
    };});});
    await page.locator('#canvas').focus();await page.keyboard.down('w');
    try{await expect(page.locator('#incense')).toBeEnabled({timeout:18000});}finally{await page.keyboard.up('w');}
    await expect(page.locator('#canvas')).toHaveAttribute('data-location','hall');
    const entrance=await page.evaluate(()=>window.interiorQA.entranceAngles||[]);
    expect(entrance.length).toBeGreaterThan(10);expect(Math.max(...entrance.map(Math.abs))).toBeLessThan(.1);
    await page.waitForTimeout(1200);
    const before=await page.evaluate(()=>{const v=window.interiorQA;v.yaw=-.43;v.pitch=.65;return{fan:v.interior.fans[0].rotation.y,ambient:v.daylight.intensity,floor:v.interior.floor.geometry.userData.tileCount,sofas:v.interior.seats.children.filter(o=>o.name==='three-seat-sofa').length,urnY:v.urn.position.y};});
    expect(before.ambient).toBeLessThan(.65);expect(before.floor).toBeGreaterThan(200);expect(before.sofas).toBe(6);expect(before.urnY).toBe(1.2);
    expect(await page.evaluate(()=>window.interiorQA.interior.statues.length)).toBe(2);
    await expect.poll(()=>page.evaluate(()=>window.interiorQA.interior.statues.map(s=>s.getObjectByName('statue-portrait').visible))).toEqual([true,true]);
    const portraits=await page.evaluate(()=>window.interiorQA.interior.statues.map(s=>({source:s.getObjectByName('statue-portrait').userData.portraitSource,sculpted:s.getObjectByName('sculpted-face').visible,imageWidth:s.getObjectByName('statue-portrait').material.map.image.width})));
    expect(portraits.map(p=>p.source)).toEqual(['/picture/hue.jpg','/picture/ngan.jpg']);expect(portraits.every(p=>!p.sculpted&&p.imageWidth>100)).toBe(true);
    await expect(page.locator('#statue-portraits-open')).toHaveCount(0);await expect(page.locator('#statue-portraits')).toHaveCount(0);
    for(const pitch of [-.4,1.15]){
      await page.evaluate(pitch=>{const v=window.interiorQA;v.pitch=pitch;v.zoom=1.6;v.yaw=Math.PI;},pitch);
      await page.waitForTimeout(250);
      const roof=await page.evaluate(async()=>{
        const THREE=await import('three'),v=window.interiorQA;
        const ray=new THREE.Raycaster(v.camera.position,new THREE.Vector3(0,1,0));
        const hit=ray.intersectObject(v.interior.ceiling,true)[0];
        return{hit:!!hit,opaque:!!hit&&hit.object.material.opacity>.99&&hit.object.material.depthWrite,below:v.camera.position.y<14};
      });
      expect(roof).toEqual({hit:true,opaque:true,below:true});
      if(pitch<0)await page.screenshot({path:`test-results/interior-look-up-${mobile?'mobile':'desktop'}.png`});
    }
    await page.screenshot({path:`test-results/interior-roof-${mobile?'mobile':'desktop'}.png`});
    await page.evaluate(()=>{const v=window.interiorQA;v.pitch=.65;v.zoom=1;v.yaw=-.43;});
    await page.waitForTimeout(300);expect(await page.evaluate(()=>window.interiorQA.interior.fans[0].rotation.y)).toBeGreaterThan(before.fan);
    await page.screenshot({path:`test-results/interior-${mobile?'mobile':'desktop'}.png`});
    await page.locator('#incense').click();
    await expect.poll(()=>page.evaluate(()=>window.interiorQA.incense.size)).toBe(1);
    const stick=await page.evaluate(()=>{const v=window.interiorQA,g=[...v.incense.values()][0];return{parent:g.parent.name,sand:g.position.y,tip:g.userData.ember.position.y};});
    expect(stick.parent).toBe('indoor-incense-burner');expect(stick.sand).toBeCloseTo(1.46);expect(stick.tip).toBeGreaterThan(.9);
    await page.waitForTimeout(1600);
    if(!mobile){
      await page.evaluate(()=>{window.interiorQA.pitch=.5;window.interiorQA.yaw=-.7;});await page.waitForTimeout(300);await page.screenshot({path:'test-results/interior-ceiling.png'});
      await page.evaluate(()=>{window.interiorQA.pitch=1.05;window.interiorQA.yaw=-1.1;});await page.waitForTimeout(300);await page.screenshot({path:'test-results/interior-floor.png'});

    }
    await page.evaluate(mobile=>{
      const v=window.interiorQA,draw=v.renderer.render.bind(v.renderer);
      v.renderer.render=(scene,camera)=>{if(scene===v.scene){camera.fov=mobile?75:47;camera.updateProjectionMatrix();camera.position.set(0,6.8,mobile?-7:-12.5);camera.lookAt(0,5.5,-23);}draw(scene,camera);};
    },mobile);
    await page.waitForTimeout(200);await page.screenshot({path:`test-results/fixed-statue-portraits-${mobile?'mobile':'desktop'}.png`});
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
