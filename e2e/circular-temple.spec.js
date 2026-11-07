const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`three circular roof tiers and a symmetrical entrance (${mobile?'mobile':'desktop'})`,async({browser})=>{
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Chua tron');await page.locator('#join-button').click();
    const state=await page.evaluate(async mobile=>{
      const{TempleView}=await import('/scene3d.js');return new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);TempleView.prototype.render=render;
        const v=this,draw=v.renderer.render.bind(v.renderer),tiers=v.roofs.filter(o=>o.name.startsWith('circular-roof-tier'));
        v.renderer.render=(scene,camera)=>{if(scene===v.scene){camera.fov=mobile?55:47;camera.updateProjectionMatrix();camera.position.set(mobile?42:44,mobile?30:25,mobile?66:54);camera.lookAt(0,15,-13);}draw(scene,camera);};
        resolve({tiers:tiers.length,radii:tiers.map(o=>{const p=o.getObjectByName('curved-circular-tile-roof').geometry;p.computeBoundingBox();return p.boundingBox.max.x;}),columns:HALL_COLUMNS.length,walls:v.interior.root.getObjectByName('curved-hall-walls').children.length,doorCenter:(HALL_ENTRY.left+HALL_ENTRY.right)/2,doorWidth:HALL_ENTRY.right-HALL_ENTRY.left,leaves:!!v.interior.doorway.getObjectByName('open-left-door')||!!v.interior.doorway.getObjectByName('open-right-door')});
      };});
    },mobile);
    expect(state.tiers).toBe(3);expect(state.radii[0]).toBeGreaterThan(state.radii[1]);expect(state.radii[1]).toBeGreaterThan(state.radii[2]);expect(state.columns).toBe(22);expect(state.walls).toBe(21);expect(state.doorCenter).toBe(500);
    expect(state.doorWidth).toBeLessThan(115);expect(state.leaves).toBe(false);
    await page.waitForTimeout(350);await page.screenshot({path:`test-results/circular-temple-${mobile?'mobile':'desktop'}.png`});expect(errors).toEqual([]);
  }finally{await context.close();}
});
