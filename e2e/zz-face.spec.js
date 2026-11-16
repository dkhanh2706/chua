const {test}=require('@playwright/test');
test('face',async({browser})=>{
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});const pages=[];
  for(const n of ['An','Binh']){const pg=await ctx.newPage();pages.push(pg);await pg.goto('/');await pg.locator('#next-button').click();await pg.locator('#name').fill(n);await pg.locator('#join-button').click();await pg.waitForTimeout(800);}
  const [a,b]=pages;await a.bringToFront();
  await a.evaluate(async()=>{const {TempleView}=await import('/scene3d.js');const T=await import('three');await new Promise(r=>{const o=TempleView.prototype.render;TempleView.prototype.render=function(...x){o.apply(this,x);window.V=this;const other=x[1].find(p=>p.id!==x[3]);window.OT=other;
    if(window.CLOSE){const m=this.models.get(other.id),h=m.head.getWorldPosition(new T.Vector3());this.camera.position.set(h.x+.1,h.y+.9,h.z+1.3);this.camera.lookAt(h);this.camera.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);}r();};});});
  await a.locator('#stungun-toggle').click();await a.waitForTimeout(300);await a.locator('#zap-hit').click();
  await a.waitForTimeout(100);
  await a.evaluate(()=>{window.CLOSE=true;});
  for(const i of [0,1]){await a.waitForTimeout(450);await a.screenshot({path:`test-results/face-${i}.png`});}
});
