const{test,expect}=require('@playwright/test');
async function inspectGarden(page){await page.evaluate(async()=>{const{TempleView}=await import('/scene3d.js');await new Promise(resolve=>{const original=TempleView.prototype.render;TempleView.prototype.render=function(...args){original.apply(this,args);TempleView.prototype.render=original;window.gardenQA=this;resolve();};});});}

test('square courtyard and continuous mountain water render without graphics errors',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#name').fill('Son Thuy');await page.locator('#join-button').click();await inspectGarden(page);
    const geometry=await page.evaluate(async()=>{
      const {mountainHeight}=await import('/landscape.mjs'),landscape=window.gardenQA.landscape;
      const positions=landscape.fall.geometry.attributes.position;
      let minClearance=Infinity,maxStep=0;
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
        minClearance=Math.min(minClearance,y-mountainHeight(x,z));
        if(i>=13)maxStep=Math.max(maxStep,Math.abs(y-positions.getY(i-13)));
      }
      const i=positions.count-7,x=positions.getX(i),z=positions.getZ(i);
      const river=landscape.root.getObjectByName('connected-river').geometry.attributes.position;
      const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
      for(let j=0;j<9;j++){bounds.minX=Math.min(bounds.minX,river.getX(j));bounds.maxX=Math.max(bounds.maxX,river.getX(j));bounds.minZ=Math.min(bounds.minZ,river.getZ(j));}
      return{minClearance,maxStep,tiles:landscape.paving.count,joinsRiver:x>bounds.minX&&x<bounds.maxX&&z>bounds.minZ,endHeight:positions.getY(i),summit:positions.getY(6)};
    });
    expect(geometry.tiles).toBeGreaterThan(700);expect(geometry.minClearance).toBeGreaterThan(.05);expect(geometry.maxStep).toBeLessThan(1);
    expect(geometry.summit).toBeGreaterThan(25);expect(geometry.endHeight).toBeLessThan(.1);expect(geometry.joinsRiver).toBe(true);
    await page.locator('#camera-panorama').click();await page.waitForTimeout(600);await page.screenshot({path:'test-results/paved-courtyard.png'});
    await page.evaluate(()=>{const v=window.gardenQA,render=v.renderer.render.bind(v.renderer);v.renderer.render=(scene,camera)=>{if(scene===v.scene){camera.position.set(53,24,6);camera.lookAt(28,12,-43);}render(scene,camera);};});
    const before=await page.evaluate(()=>window.gardenQA.landscape.time.value);await page.waitForTimeout(400);
    expect(await page.evaluate(()=>window.gardenQA.landscape.time.value)).toBeGreaterThan(before);
    await page.screenshot({path:'test-results/mountain-waterfall.png'});expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('detailed garden renders veined leaves, wind, falling leaves and perched birds',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#name').fill('Ngắm cây');await page.locator('#join-button').click();await inspectGarden(page);
    await page.locator('#camera-panorama').click();await page.waitForTimeout(900);await page.screenshot({path:'test-results/garden-overview.png'});
    const before=await page.evaluate(()=>({time:window.gardenQA.garden.wind.value,fall:Array.from(window.gardenQA.garden.fallBatches[0].mesh.instanceMatrix.array)}));await page.waitForTimeout(250);
    const after=await page.evaluate(()=>({time:window.gardenQA.garden.wind.value,fall:Array.from(window.gardenQA.garden.fallBatches[0].mesh.instanceMatrix.array),trees:window.gardenQA.garden.trees.length,birds:window.gardenQA.garden.birds.length}));expect(after.time).toBeGreaterThan(before.time);expect(after.fall).not.toEqual(before.fall);expect(after.trees).toBe(21);expect(after.birds).toBe(4);
    await page.evaluate(()=>{const v=window.gardenQA,render=v.renderer.render.bind(v.renderer);v.renderer.render=(scene,camera)=>{if(scene===v.scene){camera.position.set(-19,6.6,5);camera.lookAt(-23,7,-2);}render(scene,camera);};});
    await page.waitForTimeout(200);await page.screenshot({path:'test-results/tree-detail.png'});expect(errors).toEqual([]);
  }finally{await context.close();}
});
test('mobile quality keeps tree detail, reduces particle counts, and bird audio obeys mute and cleanup',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
  try{
    await page.goto('/');await page.locator('#name').fill('Nghe chim');await page.locator('#join-button').tap();await inspectGarden(page);
    const low=await page.evaluate(()=>{const g=window.gardenQA.garden;return{leaves:g.trees.reduce((n,t)=>n+t.foliage.count,0),fall:g.fallBatches.reduce((n,b)=>n+b.mesh.count,0)};});expect(low.leaves).toBe(6720);expect(low.fall).toBe(30);
    await expect(page.locator('#quality-mode')).not.toBeVisible();await page.evaluate(()=>window.gardenQA.setQuality('high'));expect(await page.evaluate(()=>window.gardenQA.garden.fallBatches.reduce((n,b)=>n+b.mesh.count,0))).toBe(72);await page.evaluate(()=>window.gardenQA.setQuality('balanced'));
    const call=await page.evaluate(async()=>{const s=new TempleSound();await s.start(true);s.setGardenSources(window.gardenQA.garden.audioSources);s.nextBird=Infinity;s.update(performance.now()/1000,500,605,0);const calls=[];s.onBird=c=>calls.push(c);s.bird(s.sources[0]);window.birdAudioQA={s,calls};return{...calls[0],voices:s.voices.size};});
    expect(call.id).toBe('bird-0');expect(call.duration).toBeGreaterThan(.5);expect(call.gain).toBeGreaterThan(0);expect(Math.abs(call.pan)).toBeLessThanOrEqual(.85);expect(call.voices).toBe(1);
    await page.evaluate(()=>{const{s}=window.birdAudioQA;s.setEnabled(false);s.bird(s.sources[1]);});expect(await page.evaluate(()=>window.birdAudioQA.calls.length)).toBe(1);expect(await page.evaluate(()=>window.birdAudioQA.s.voices.size)).toBe(0);
    await page.evaluate(()=>{const{s}=window.birdAudioQA;s.setEnabled(true);s.bird(s.sources[2]);});await expect.poll(()=>page.evaluate(()=>window.birdAudioQA.s.voices.size)).toBe(0);await page.evaluate(()=>window.birdAudioQA.s.ctx.close());
    await page.screenshot({path:'test-results/garden-mobile.png'});
  }finally{await context.close();}
});
