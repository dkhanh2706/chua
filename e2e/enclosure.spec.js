const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`complete garden boundary on the island (${mobile?'mobile':'desktop'})`,async({browser})=>{
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Vuon xanh');await page.locator('#join-button').click();
    const state=await page.evaluate(async mobile=>{
      const{TempleView}=await import('/scene3d.js');return new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);TempleView.prototype.render=render;
        const v=this,draw=v.renderer.render.bind(v.renderer);v.scene.fog.near=2300;v.scene.fog.far=2700;v.renderer.render=(scene,camera)=>{if(scene===v.scene){camera.fov=mobile?80:53;camera.updateProjectionMatrix();camera.position.set(0,144,96);camera.lookAt(0,0,-20);}draw(scene,camera);};
        const river=v.landscape.riverGarden.water.geometry.attributes.position;let end=-Infinity;for(let i=0;i<river.count;i++)end=Math.max(end,river.getZ(i));
        const endpoints=new Map();for(const segment of v.boundary.segments)for(const p of segment){const key=p.join(',');endpoints.set(key,(endpoints.get(key)||0)+1);}
        resolve({openEnds:[...endpoints.values()].filter(n=>n===1).length,crowns:v.garden.crowns.count,portal:!!v.boundary.root.getObjectByName('arched-stream-outlet'),riverEnd:end});
      };});
    },mobile);
    expect(state.openEnds).toBe(4);expect(state.crowns).toBe(504);expect(state.portal).toBe(true);expect(state.riverEnd).toBeCloseTo(44.4,3);await page.waitForTimeout(300);
    await page.screenshot({path:`test-results/green-enclosure-${mobile?'mobile':'desktop'}.png`});expect(errors).toEqual([]);
  }finally{await context.close();}
});
