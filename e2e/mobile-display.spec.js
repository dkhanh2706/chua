const {test,expect}=require('@playwright/test');
const {inspectPlayer}=require('./helpers/incense');

for(const size of [{width:568,height:320},{width:844,height:390}])test(`landscape phone keeps controls separate and the shop readable at ${size.width}x${size.height}`,async({browser})=>{
  test.setTimeout(45000);
  const context=await browser.newContext({viewport:size,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const checkLayout=async selectors=>{
    for(const selector of selectors){
      await expect(page.locator(selector)).toBeInViewport({ratio:1});
      const box=await page.locator(selector).boundingBox();expect(box.width,selector).toBeGreaterThanOrEqual(44);expect(box.height,selector).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(selectors=>{
      const boxes=selectors.map(selector=>({selector,r:document.querySelector(selector).getBoundingClientRect()}));
      return boxes.flatMap((a,i)=>boxes.slice(i+1).filter(b=>a.r.left<b.r.right&&a.r.right>b.r.left&&a.r.top<b.r.bottom&&a.r.bottom>b.r.top).map(b=>`${a.selector} / ${b.selector}`));
    },selectors)).toEqual([]);
    expect(await page.evaluate(()=>document.body.scrollWidth)).toBe(size.width);
  };
  try{
    await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Man hinh');await page.locator('#join-button').tap();
    await inspectPlayer(page);
    const main=['#sit','#bow','#incense','#joystick','#settings-toggle','#sound','#chat-toggle','#leave'];
    await checkLayout([...main,'.brand','.blessing-panel','#incense-guide']);await expect(page.locator('#location-hint')).toBeHidden();
    await page.screenshot({path:`test-results/landscape-clean-${size.width}.png`});
    await page.locator('#settings-toggle').tap();await expect(page.locator('.player-supplies')).toBeHidden();
    await expect(page.locator('#toast')).toBeHidden();
    await checkLayout(['#sit','#bow','#incense','#settings-toggle','#camera-overhead','#camera-panorama','#camera-follow','#camera-in','#camera-out','#camera-reset','#time-of-day','#share-link','#help','#sound','#chat-toggle','#leave']);
    await page.screenshot({path:`test-results/landscape-settings-${size.width}.png`});
    await page.locator('#help').tap();await expect(page.locator('#help-dialog')).toBeVisible();await expect(page.locator('#settings-toggle')).toHaveAttribute('aria-expanded','false');await page.keyboard.press('Escape');
    await page.locator('#incense-guide').tap();await expect(page.locator('#incense-shop-dialog')).toBeVisible({timeout:15000});
    for(const id of ['single','triple','bundle']){
      const button=page.locator(`[data-incense-pack="${id}"]`);await expect(button).toBeInViewport({ratio:1});
      const text=await button.locator('.pack-buy').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),wrapped:el.scrollWidth>el.clientWidth}));
      expect(text.font).toBeGreaterThanOrEqual(12);expect(text.wrapped).toBe(false);
    }
    await expect(page.locator('[data-close="incense-shop-dialog"]')).toBeInViewport({ratio:1});
    await page.screenshot({path:`test-results/landscape-shop-${size.width}.png`});
    const quality=await page.evaluate(()=>{const v=window.incenseQA.view;return{quality:v.quality,fps:v.targetFPS,antialias:v.renderer.getContext().getContextAttributes().antialias,shadows:v.renderer.shadowMap.enabled};});
    expect(quality).toEqual({quality:'high',fps:60,antialias:true,shadows:true});
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
