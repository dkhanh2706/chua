const {test,expect}=require('@playwright/test');

for(const mobile of [false,true])test(`Tom and live chat (${mobile?'mobile':'desktop'})`,async({browser})=>{
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const a=await context.newPage(),b=await context.newPage(),errors=[];
  for(const page of [a,b])page.on('pageerror',error=>errors.push(error.message));
  try{
    await a.goto('/');await a.locator('#character-code').fill(' TOM ');
    await expect(a.locator('#character-code-hint')).toContainText('Đã chọn nhân vật đặc biệt.');
    await a.screenshot({path:`test-results/tom-preview-${mobile?'mobile':'desktop'}.png`,fullPage:true});
    await a.locator('#next-button').click();await a.locator('#name').fill('Tom');await a.locator('#join-button').click();await expect(a.locator('#game')).toBeVisible();
    await b.goto('/');await b.locator('#next-button').click();await b.locator('#name').fill('Bạn An');await b.locator('#join-button').click();await expect(b.locator('#game')).toBeVisible();
    await a.locator('#chat-toggle').click();await a.locator('#chat-input').fill('Xin chào mọi người');await a.locator('#chat-send').click();
    await expect(a.locator('#chat-messages')).toContainText('Xin chào mọi người');await expect(b.locator('#chat-unread')).toHaveText('1');
    await b.locator('#chat-toggle').click();await expect(b.locator('#chat-unread')).toBeHidden();await expect(b.locator('#chat-messages')).toContainText('Xin chào mọi người');
    await b.locator('#chat-input').fill('<img src=x onerror=alert(1)>');await b.locator('#chat-input').press('Enter');
    await expect(a.locator('#chat-messages')).toContainText('<img src=x onerror=alert(1)>');await expect(a.locator('#chat-messages img')).toHaveCount(0);
    await a.locator('#chat-input').fill('wasd e f g');await a.locator('#chat-input').press('Space');await expect(a.locator('#sit-label')).toHaveText('Ngồi thiền');
    await a.screenshot({path:`test-results/chat-${mobile?'mobile':'desktop'}.png`,fullPage:true});
    await expect(a.locator('body')).toHaveJSProperty('scrollWidth',mobile?390:1280);
    await a.locator('#chat-close').click();await a.locator('#sit').click();await expect(a.locator('#sit-label')).toHaveText('Đứng dậy');
    await a.locator('#leave').click();await expect(a.locator('#welcome')).toBeVisible();expect(errors).toEqual([]);
  }finally{await context.close();}
});
