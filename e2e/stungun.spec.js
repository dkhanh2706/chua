const {test,expect}=require('@playwright/test');

async function hook(page){
  await page.evaluate(async()=>{
    const {TempleView}=await import('/scene3d.js');
    await new Promise(resolve=>{
      const render=TempleView.prototype.render;
      TempleView.prototype.render=function(...args){render.apply(this,args);window.zapQA={view:this,players:args[1],self:args[1].find(p=>p.id===args[3]),other:args[1].find(p=>p.id!==args[3])};resolve();};
    });
  });
}

test('the gate carries the Phu Giao sign and a held stun gun shocks, drops and releases a visitor after two seconds',async({browser})=>{
  test.setTimeout(60000);
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const errors=[],pages=[];
  try{
    for(const name of ['An','Binh']){
      const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
      await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill(name);await page.locator('#join-button').click();await expect(page.locator('#game')).toBeVisible();
    }
    const [a,b]=pages;await expect(a.locator('#players li')).toHaveCount(2);await expect(b.locator('#players li')).toHaveCount(2);
    await a.bringToFront();await hook(a);
    // The sign is part of the gate.
    expect(await a.evaluate(()=>{let found=null;window.zapQA.view.scene.traverse(o=>{if(o.name==='phu-giao-sign-face')found=o;});return !!found&&!!found.material.map;})).toBe(true);
    // Always-available slot: hold, release, hold again.
    await expect(a.locator('#stungun-toggle')).toBeVisible();await expect(a.locator('#zap-hit')).not.toBeVisible();
    await a.locator('#stungun-toggle').click();await expect(a.locator('#stungun-toggle')).toHaveAttribute('aria-pressed','true');
    await expect(a.locator('#zap-hit')).toBeVisible();await expect(a.locator('#zap-hit')).toBeEnabled();
    await a.waitForTimeout(400);await a.screenshot({path:'test-results/stungun-held.png'});
    await a.locator('#stungun-toggle').click();await expect(a.locator('#zap-hit')).not.toBeVisible();
    await a.locator('#stungun-toggle').click();await expect(a.locator('#zap-hit')).toBeVisible();
    // Zap: the shooter pays 2 blessings, the target is shocked and lies down.
    await a.locator('#zap-hit').click();
    await expect(a.locator('#blessing-score')).toHaveText('-2');
    await expect.poll(()=>a.evaluate(()=>window.zapQA.other.shockStart>0)).toBe(true);
    const upright=()=>a.evaluate(()=>window.zapQA.view.models.get(window.zapQA.other.id).root.matrixWorld.elements[5]);
    const aura=()=>a.evaluate(()=>!!window.zapQA.view.models.get(window.zapQA.other.id).shock?.visible);
    await expect.poll(upright,{intervals:[30],timeout:1500}).toBeLessThan(.3);
    expect(await aura()).toBe(true);
    // The electricity stays on the body while it lies down.
    await a.waitForTimeout(300);
    const gap=await a.evaluate(()=>{const m=window.zapQA.view.models.get(window.zapQA.other.id),pts=m.shock.userData.lines.flatMap(l=>Array.from(l.geometry.attributes.position.array));let x=0,y=0,z=0;const n=pts.length/3;for(let i=0;i<n;i++){x+=pts[i*3];y+=pts[i*3+1];z+=pts[i*3+2];}
      const h=m.head.getWorldPosition(m.head.position.clone()),f=m.root.getWorldPosition(h.clone());return Math.hypot(x/n-(h.x+f.x)/2,y/n-(h.y+f.y)/2,z/n-(h.z+f.z)/2);});
    expect(gap).toBeLessThan(.7);
    await a.screenshot({path:'test-results/stungun-zap.png'});
    // Victim cannot act while down; the shooter cannot hit someone who is already down.
    await b.bringToFront();await expect(b.locator('#stungun-toggle')).toBeDisabled();
    await a.bringToFront();await expect(a.locator('#zap-hit')).not.toBeVisible();
    const started=Date.now();
    await expect.poll(upright,{intervals:[50],timeout:4000}).toBeGreaterThan(.999);
    const lasted=Date.now()-started;
    // Fall, lie and rise fit within the two seconds, with the aura gone once up.
    expect(lasted).toBeLessThan(2000);
    await expect.poll(aura,{timeout:1500}).toBe(false);
    await b.bringToFront();await expect(b.locator('#stungun-toggle')).toBeEnabled({timeout:2500});
    await hook(b);expect(await b.evaluate(()=>window.zapQA.other.blessings)).toBe(-2);expect(await b.evaluate(()=>window.zapQA.self.blessings)).toBe(0);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
