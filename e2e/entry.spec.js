const {test,expect}=require('@playwright/test');
for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:900}]){
  test(`two-step entry at ${viewport.width}x${viewport.height}`,async({browser})=>{
    const context=await browser.newContext({viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try{
      await page.goto('/');
      await expect(page.locator('#entry-dialog')).toBeHidden();await expect(page.locator('#name')).toBeHidden();
      await expect(page.locator('#character-code')).toBeInViewport();
      const code=await page.locator('#character-code').boundingBox(),avatar=await page.locator('.avatar-pane').boundingBox();
      expect(code.y+code.height).toBeLessThan(avatar.y);
      if(viewport.width<800){
        await expect(page.locator('#next-button')).toBeInViewport({ratio:1});
        // A vertical swipe over the avatar should scroll the page, while
        // horizontal gestures remain available to rotate the character.
        const canvas=await page.locator('#canvas').boundingBox(),cdp=await context.newCDPSession(page);
        const x=canvas.x+canvas.width/2,y=canvas.y+canvas.height*.8;
        try{
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
          for(let step=1;step<=8;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*15,id:1}]});
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(30);
        }finally{await cdp.detach();}
        await page.locator('#tab-accessories').scrollIntoViewIfNeeded();
        await page.locator('#tab-accessories').click();
        await expect(page.locator('#next-button')).toBeInViewport({ratio:1});
        await page.mouse.wheel(0,-3000);await page.locator('#character-code').scrollIntoViewIfNeeded();
      }
      await page.locator('#character-code').fill('unknown');await page.locator('#next-button').click();
      await expect(page.locator('#entry-dialog')).toBeHidden();await expect(page.locator('#character-code')).toHaveAttribute('aria-invalid','true');
      await page.locator('#character-code').fill('tom');
      await expect(page.locator('#character-code-hint')).toContainText('Đã chọn');
      await page.screenshot({path:`test-results/entry-character-${viewport.width}.png`,fullPage:true});
      await page.locator('#next-button').click();
      await expect(page.locator('#entry-dialog')).toBeVisible();await expect(page.locator('#name')).toBeFocused();
      await page.locator('#name').fill('An Nhiên');
      await page.locator('#edit-character').click();await expect(page.locator('#entry-dialog')).toBeHidden();
      await expect(page.locator('#character-code')).toHaveValue('tom');
      await page.locator('#next-button').click();await expect(page.locator('#name')).toHaveValue('An Nhiên');
      await page.screenshot({path:`test-results/entry-name-${viewport.width}.png`});
      if(viewport.width<800){
        // Chrome emulation does not open a software keyboard. Model its reduced
        // visible viewport and verify that typing and submitting stay in view.
        await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:300});visualViewport.dispatchEvent(new Event('resize'));});
        for(const selector of ['#name','#join-button','#entry-back']){
          const bounds=await page.locator(selector).boundingBox();
          expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(300);
        }
        await page.screenshot({path:`test-results/entry-keyboard-${viewport.width}.png`});
        await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
      }
      await page.locator('#name').press('Escape');await expect(page.locator('#entry-dialog')).toBeHidden();
      await page.locator('#next-button').click();await page.locator('#name').press('Enter');
      await expect(page.locator('#game')).toBeVisible();await expect(page.locator('#entry-dialog')).toBeHidden();
      await page.locator('#leave').click();await expect(page.locator('#next-button')).toBeVisible();
      expect(errors).toEqual([]);
    }finally{await context.close();}
  });
}
