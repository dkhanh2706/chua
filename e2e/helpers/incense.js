const {expect}=require('@playwright/test');
const {INCENSE_PACKS}=require('../../public/incense-shop');

async function inspectPlayer(page){
  await page.evaluate(async()=>{
    if(window.incenseQA)return;
    const {TempleView}=await import('/scene3d.js');
    await new Promise(resolve=>{const render=TempleView.prototype.render;TempleView.prototype.render=function(...args){render.apply(this,args);TempleView.prototype.render=render;window.incenseQA={view:this,me:args[1].find(p=>p.id===args[3])};resolve();};});
  });
}

async function walkToPoint(page,x,y){
  await inspectPlayer(page);
  await expect(page.locator('#sit')).toBeEnabled({timeout:4000});
  // Select an offscreen destination through the normal tap -> route -> move flow.
  await page.evaluate(({x,y})=>{const v=window.incenseQA.view,pick=v.pick;v.pick=function(){v.pick=pick;return{x,y};};},{x,y});
  const canvas=await page.locator('#canvas').boundingBox();await page.mouse.click(canvas.x+canvas.width*.5,canvas.y+canvas.height*.38);
  await expect.poll(()=>page.evaluate(({x,y})=>Math.hypot(window.incenseQA.me.x-x,window.incenseQA.me.y-y),{x,y}),{timeout:20000}).toBeLessThan(3);
}

async function earnAndBuyIncense(page,packId='triple'){
  const pack=INCENSE_PACKS.find(p=>p.id===packId);
  await walkToPoint(page,380,605);
  if(!await page.evaluate(()=>window.incenseQA.me.hasBroom))await page.locator('#broom-pickup').click();
  await expect.poll(()=>page.evaluate(()=>window.incenseQA.me.hasBroom)).toBe(true);
  await walkToPoint(page,301,615);
  for(let i=0;i<pack.cost;i++){
    const before=Number(await page.locator('#blessing-score').textContent());
    await expect(page.locator('#sweep-leaves')).toBeEnabled({timeout:6500});await page.locator('#sweep-leaves').click();
    await expect(page.locator('#blessing-score')).toHaveText(String(before+1));
  }
  await expect(page.locator('#sit')).toBeEnabled();await page.locator('#incense-guide').click();
  await expect(page.locator('#incense-shop-dialog')).toBeVisible({timeout:15000});
  const before=Number(await page.locator('#incense-stock').textContent());
  await page.locator(`[data-incense-pack="${packId}"]`).click();
  await expect(page.locator('#incense-stock')).toHaveText(String(before+pack.sticks));
  await expect(page.locator('#blessing-score')).toHaveText('0');
  await page.locator('[data-close="incense-shop-dialog"]').click();
  await walkToPoint(page,450,605);
}

module.exports={inspectPlayer,walkToPoint,earnAndBuyIncense};
