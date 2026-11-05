const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
let browser;
(async()=>{
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true,reducedMotion:'reduce'});
  const errors=[],thumbnailRequests=new Set(),batches=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://upload.wikimedia.org/**',route=>{
    thumbnailRequests.add(new URL(route.request().url()).pathname);
    return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#326b52"/><text x="12" y="55" fill="white">beep! preview</text></svg>'});
  });
  await page.route('https://commons.wikimedia.org/w/api.php**',route=>{
    const q=new URL(route.request().url()).searchParams;
    const image=id=>({pageid:id,imageinfo:[{mime:'image/jpeg',url:`https://upload.wikimedia.org/original-${id}.jpg`,thumburl:`https://upload.wikimedia.org/thumb-${id}.jpg`,extmetadata:{Artist:{value:'Fixture creator'}}}]});
    let data;
    if(q.get('list'))data={query:{categorymembers:Array.from({length:q.has('cmcontinue')?5:40},(_,i)=>({ns:6,pageid:i+(q.has('cmcontinue')?41:1),title:`File:Image ${i+(q.has('cmcontinue')?41:1)}.jpg`}))},...(!q.has('cmcontinue')?{continue:{continue:'-||',cmcontinue:'next'}}:{})};
    else if(q.get('prop')==='categories')data={query:{pages:[{}]}};
    else if(q.get('iiurlwidth')==='1280')data={query:{pages:[image(Number(q.get('pageids')))]}};
    else {
      const ids=q.get('pageids').split('|').map(Number);batches.push(ids.length);
      // Model partial imageinfo results: the rest arrive via continuation.
      data={query:{pages:(q.has('iicontinue')?ids.slice(3):ids.slice(0,3)).map(image)},...(!q.has('iicontinue')&&ids.length>3?{continue:{continue:'||',iicontinue:'remaining'}}:{})};
    }
    return route.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:8765');await page.locator('.home-content').waitFor();await page.locator('.boot-screen').waitFor({state:'detached'});
  await page.locator('.start-button').click();await page.locator('.start-menu [data-open=computer]').click();await page.locator('.disk-address').fill('C:\\Media');await page.locator('.disk-address').press('Enter');await page.locator('[data-node=media-images]').dblclick();
  await page.waitForFunction(()=>document.querySelectorAll('.commons-image img').length===40&&[...document.querySelectorAll('.commons-image img')].every(i=>i.complete&&i.naturalWidth));
  assert.equal(thumbnailRequests.size,40);assert(batches.every(n=>n<=10));
  await page.locator('[data-more]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.commons-image img').length===45&&[...document.querySelectorAll('.commons-image img')].every(i=>i.complete&&i.naturalWidth));
  assert.equal(thumbnailRequests.size,45);assert(await page.locator('[data-more]').isHidden());
  await page.screenshot({path:'/tmp/images-every-thumbnail-desktop.png',animations:'disabled'});
  console.log('PASS all 45 thumbnails requested and loaded across small batches, partial API responses and category pagination');
  await page.locator('.commons-image').last().focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.media-stage img')?.naturalWidth>0);
  assert.equal(await page.locator('.media-info strong').textContent(),'Image 45.jpg');assert.match(await page.locator('.media-info a').getAttribute('href'),/File%3AImage_45.jpg/);assert.equal(page.context().pages().length,1);
  await page.locator('#window-media .close').click();await page.locator('.commons-image').first().click({modifiers:['Control']});
  await page.waitForFunction(()=>document.querySelector('.media-info strong')?.textContent==='Image 1.jpg');assert.equal(page.context().pages().length,1);
  console.log('PASS mouse, keyboard and modified activation open Media Viewer, including images without description URLs');
  await page.locator('#window-media .close').click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/images-every-thumbnail-mobile.png',animations:'disabled'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.commons-image').nth(20).tap();await page.waitForFunction(()=>document.querySelector('.media-info strong')?.textContent==='Image 21.jpg');assert.equal(page.context().pages().length,1);
  assert.deepEqual(errors,[]);console.log('PASS mobile thumbnails and touch activation, no uncaught browser errors');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>browser?.close());
