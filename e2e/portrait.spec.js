const {test,expect}=require('@playwright/test');

for(const size of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:430,height:932}]){
  test(`portrait controls remain reachable at ${size.width}x${size.height}`,async({browser})=>{
    const context=await browser.newContext({viewport:size,isMobile:true,hasTouch:true});
    const page=await context.newPage();
    try{
      await page.goto('/');await page.locator('#next-button').click();await page.locator('#name').fill('Doc');await page.locator('#join-button').tap();
      await expect(page.locator('#game')).toBeVisible();
      const checkLayout=async selectors=>{
        for(const selector of selectors){
          await expect(page.locator(selector)).toBeInViewport({ratio:1});
          const box=await page.locator(selector).boundingBox();
          expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
        }
        const overlaps=await page.evaluate(selectors=>{
          const boxes=selectors.map(s=>({s,r:document.querySelector(s).getBoundingClientRect()}));
          return boxes.flatMap((a,i)=>boxes.slice(i+1).filter(b=>a.r.left<b.r.right&&a.r.right>b.r.left&&a.r.top<b.r.bottom&&a.r.bottom>b.r.top).map(b=>`${a.s} / ${b.s}`));
        },selectors);
        expect(overlaps).toEqual([]);
        expect(await page.evaluate(()=>document.body.scrollWidth)).toBe(size.width);
      };
      const actions=['#sit','#bow','#incense'];
      await checkLayout([...actions,'#joystick','#settings-toggle','#chat-toggle','#leave','#sound','#incense-guide','.blessing-panel']);
      await expect(page.locator('#share-link')).toBeHidden();await expect(page.locator('#help')).toBeHidden();
      await expect(page.locator('#location-hint')).toBeHidden();
      await page.screenshot({path:`test-results/portrait-clean-${size.width}.png`});
      // Freeze the UI timer before showing the largest contextual tool group.
      const frozenTime=Date.now();
      await page.clock.install({time:frozenTime});await page.clock.pauseAt(frozenTime+1000);
      // Exercise the largest contextual tool group, independent of world position.
      await page.evaluate(()=>{
        document.querySelector('.yard-tools').hidden=false;
        for(const id of ['broom-pickup','sweep-leaves','broom-hit'])document.getElementById(id).hidden=false;
        document.querySelector('.yard-tools').style.visibility='visible';
      });
      await checkLayout([...actions,'#joystick','#settings-toggle','.yard-tools']);
      await page.screenshot({path:`test-results/portrait-tools-${size.width}.png`});
      await page.evaluate(()=>document.querySelector('.yard-tools').style.removeProperty('visibility'));
      await page.locator('#settings-toggle').tap();
      await expect(page.locator('.yard-tools')).toBeHidden();await expect(page.locator('#joystick')).toBeHidden();
      await expect(page.locator('#toast')).toBeHidden();
      await checkLayout([...actions,'#camera-overhead','#camera-panorama','#camera-follow','#camera-in','#camera-out','#camera-reset','#time-of-day','#settings-toggle','#share-link','#help']);
      await page.screenshot({path:`test-results/portrait-settings-${size.width}.png`});
      await page.locator('#camera-follow').tap();
      await expect(page.locator('#camera-follow')).toHaveAttribute('aria-pressed','true');
      await page.locator('#chat-toggle').tap();
      await expect(page.locator('#settings-toggle')).toHaveAttribute('aria-expanded','false');
      await expect(page.locator('.camera-controls')).toBeHidden();
      await checkLayout(['#chat-close','#chat-input','#chat-send']);
      await page.locator('#chat-close').tap();await expect(page.locator('#joystick')).toBeVisible();
      await page.locator('#leave').tap();await expect(page.locator('#welcome')).toBeVisible();
    }finally{await context.close();}
  });
}
