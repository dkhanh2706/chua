const {test,expect}=require('@playwright/test');

test('human wardrobe, hair and accessories survive preview changes, reload and joining the temple',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.evaluate(async()=>{
    const {AvatarStudio}=await import('/avatar-studio.mjs');
    await new Promise(resolve=>{
      const render=AvatarStudio.prototype.render;
      AvatarStudio.prototype.render=function(...args){render.apply(this,args);AvatarStudio.prototype.render=render;window.appearanceStudio=this;resolve();};
    });
  });
  const appearance=()=>page.evaluate(()=>window.appearanceStudio.model.appearance);
  for(const gender of ['male','female']){
    await page.locator(`[data-gender="${gender}"]`).click();
    await page.getByRole('tab',{name:'Tóc',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.appearanceStudio.camera.position.z)).toBeLessThan(3);
    for(const hair of ['bald','short','side','bob','ponytail','braids','long']){
      await page.locator('#style-hair').selectOption(hair);
      await expect.poll(async()=>(await appearance()).hair).toBe(hair);
      expect(await page.evaluate(()=>!!window.appearanceStudio.model.hair.getObjectByName('hair-scalp'))).toBe(hair!=='bald');
      await page.locator('#avatar-rotation').fill('180');
      if(hair==='long')await page.locator('.avatar-pane').screenshot({path:`test-results/avatar-${gender}-hair-back.png`});
      await page.locator('#avatar-rotation').fill('0');
      if(hair==='long')await page.locator('.avatar-pane').screenshot({path:`test-results/avatar-${gender}-hair-front.png`});
    }
    for(const [shirt,pants,shoes] of [['tunic','straight','slipon'],['long','wide','sandals'],['short','shorts','sneakers']]){
      for(const [tab,part,value] of [['Áo','shirt',shirt],['Quần','pants',pants],['Giày','shoes',shoes]]){
        await page.getByRole('tab',{name:tab,exact:true}).click();
        await page.locator(`#style-${part}`).selectOption(value);
        await expect.poll(async()=>(await appearance())[part]).toBe(value);
      }
      await page.locator('.avatar-pane').screenshot({path:`test-results/avatar-${gender}-${shirt}.png`});
    }
    await page.getByRole('tab',{name:'Phụ kiện',exact:true}).click();
    await page.locator('#necklace').check();
    if(gender==='female')for(const accessory of ['bow','clip']){
      await page.locator('#style-hairAccessory').selectOption(accessory);
      expect(await page.evaluate(()=>!!window.appearanceStudio.model.head.getObjectByName('hair-accessory'))).toBe(true);
    }
  }
  await page.getByRole('tab',{name:'Áo',exact:true}).click();
  await page.getByLabel('Mã màu áo',{exact:true}).fill('#607a96');
  const selected=await appearance();
  await page.reload();
  await expect(page.locator('[data-gender="female"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#style-shirt')).toHaveValue('short');
  await expect(page.getByLabel('Mã màu áo',{exact:true})).toHaveValue('#607a96');
  await page.locator('#next-button').click();await page.locator('#name').fill('Thử nhân vật mới');await page.locator('#join-button').click();
  await expect(page.locator('#game')).toBeVisible();
  const joined=await page.evaluate(async()=>{
    const {TempleView}=await import('/scene3d.js');
    return new Promise(resolve=>{
      const render=TempleView.prototype.render;
      TempleView.prototype.render=function(...args){render.apply(this,args);const me=this.models.get(args[3]);if(me){TempleView.prototype.render=render;resolve({appearance:me.appearance,human:me.root.name==='human-avatar',height:me.rig.hipHeight});}};
    });
  });
  expect(joined.appearance).toEqual(selected);expect(joined.human).toBe(true);expect(joined.height).toBeGreaterThan(.7);
  await page.locator('#sit').click();await expect(page.locator('#sit')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:'test-results/avatar-new-in-temple.png'});
  expect(errors).toEqual([]);
});
