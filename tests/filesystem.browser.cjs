const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const base = process.env.BEEPOS_URL || 'http://127.0.0.1:8765';
const output = process.env.BEEPOS_SCREENSHOTS || path.join(require('node:os').tmpdir(), 'beepos-screenshots');
fs.mkdirSync(output, { recursive: true });
let browser;
const errors = [];
let passed = 0;
const active = p => p.locator('.os-window.is-active');
async function check(label, fn) { await fn(); passed++; console.log('PASS', label); }
async function start(p) { p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message)); await p.goto(base); await p.locator('.home-content').waitFor(); await p.locator('.boot-screen').waitFor({state:'detached'}); }
async function explorer(p) { await p.locator('.start-button').click(); await p.locator('.start-menu [data-open="computer"]').click(); await p.locator('.app-grid').waitFor(); }
async function go(p, value) { await explorer(p); await p.locator('.disk-address').fill(value); await p.locator('.disk-address').press('Enter'); await p.waitForFunction(v=>document.querySelector('.disk-address').value===v,value); }
async function create(p, type, name) { await p.locator(`.explorer-tools [data-fs="${type}"]`).click(); await p.locator('#new-file-name').fill(name); await p.locator('#window-file-dialog [type="submit"]').click(); await p.locator('#window-file-dialog').waitFor({state:'detached'}); }
function file(p,name) { return p.locator('.app-file').filter({has:p.locator('span').filter({hasText:new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})}); }
async function screenshot(p, name) { await p.screenshot({path:path.join(output,name),animations:'disabled'}); }
async function diskHandle(p) {
  return p.evaluate(async()=>{
    const {createFilesystem}=await import('/filesystem.js');
    const ids=['home','computer','quotes','inactive','nouveau','terminal','readme','note','settings','about','find'];
    window.testDisk=await createFilesystem(Object.fromEntries(ids.map(id=>[id,{name:id}])));
    return window.testDisk.persistent;
  });
}
async function rawDisk(p, replacement) {
  return p.evaluate(value=>new Promise((resolve,reject)=>{
    const req=indexedDB.open('beepOS-filesystem',1);
    req.onsuccess=()=>{const db=req.result;const tx=db.transaction('disk',value?'readwrite':'readonly');const store=tx.objectStore('disk');let result;const r=value?store.put(value,'C'):store.get('C');r.onsuccess=()=>result=r.result;tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>reject(tx.error)};
    req.onerror=()=>reject(req.error);
  }),replacement);
}
(async()=>{
  browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const p=await context.newPage();
  await check('boot screen waits for actual filesystem initialization', async()=>{
    let release;const gate=new Promise(resolve=>release=resolve);
    await p.route('**/filesystem.js',async route=>{await gate;await route.continue()});
    await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('.boot-screen').waitFor();
    assert.equal(await p.locator('.desktop').evaluate(el=>el.inert),true);
    assert.match(await p.locator('.boot-screen').textContent(),/1.0.*FINAL RELEASE/s);
    await screenshot(p,'boot-1.0.png');release();
    await p.locator('.home-content').waitFor();await p.locator('.boot-screen').waitFor({state:'detached'});
    await p.unroute('**/filesystem.js');
  });
  await check('Explorer mounts all desktop entries, navigates up and back to C:',async()=>{
    await explorer(p);assert.equal(await p.locator('.disk-address').inputValue(),'C:\\beepOS\\my stuff');
    for(const id of ['home','computer','quotes','inactive','nouveau','terminal','readme','note']) assert.equal(await p.locator(`.app-file[data-open="${id}"]`).count(),1);
    await p.locator('[data-fs="up"]').click(); assert.equal(await p.locator('.disk-address').inputValue(),'C:\\beepOS');
    await p.locator('[data-fs="up"]').click(); assert.equal(await p.locator('.disk-address').inputValue(),'C:\\');
    assert.equal(await p.locator('[data-fs="up"]').isDisabled(),true);
    assert.ok(await file(p,'WINDOWS').isVisible());await screenshot(p,'filesystem-root.png');
    await p.locator('[data-fs="back"]').click(); assert.equal(await p.locator('.disk-address').inputValue(),'C:\\beepOS');
    await p.locator('[data-fs="back"]').click(); assert.equal(await p.locator('.disk-address').inputValue(),'C:\\beepOS\\my stuff');
  });
  const content='<img src=x onerror=alert(1)>\nhello, persistent cupboard :3\n<script>bad()</script>';
  await check('new folders and editable text survive a complete reload',async()=>{
    await create(p,'folder','Plans');await file(p,'Plans').dblclick();
    assert.equal(await p.locator('.disk-address').inputValue(),'C:\\beepOS\\my stuff\\Plans');
    await create(p,'text','hello.txt');await file(p,'hello.txt').dblclick();
    const input=active(p).locator('textarea');await input.fill(content);await input.press('Control+s');
    await p.waitForFunction(()=>document.querySelector('.os-window.is-active .window-status').textContent.includes('Saved to C:'));
    assert.equal(await active(p).locator('img,script').count(),0);
    await screenshot(p,'filesystem-editor.png');
    await p.reload();await p.locator('.home-content').waitFor();await p.locator('.boot-screen').waitFor({state:'detached'});
    await go(p,'C:\\beepOS\\my stuff\\Plans');await file(p,'hello.txt').dblclick();
    assert.equal(await active(p).locator('textarea').inputValue(),content);
  });
  await check('rename preserves contents and open editor identity',async()=>{
    await explorer(p);await file(p,'hello.txt').click();await active(p).locator('summary').filter({hasText:/^File$/}).click();
    await p.locator('[data-fs="rename"]').click();await p.locator('#new-file-name').fill('renamed.md');await p.locator('#window-file-dialog [type="submit"]').click();await p.locator('#window-file-dialog').waitFor({state:'detached'});
    assert.equal(await file(p,'hello.txt').count(),0);assert.equal(await file(p,'renamed.md').count(),1);
    await file(p,'renamed.md').dblclick();assert.equal(await active(p).locator('textarea').inputValue(),content);
    assert.equal(await active(p).locator('.window-title').textContent(),'renamed.md');
    await explorer(p);await screenshot(p,'filesystem-folders.png');
  });
  await check('invalid and case-colliding names do not create entries',async()=>{
    await p.locator('.explorer-tools [data-fs="text"]').click();
    for(const name of ['RENAMED.MD','../bad','CON','trailing.']){
      await p.locator('#new-file-name').fill(name);await p.locator('#window-file-dialog [type="submit"]').click();
      await p.waitForFunction(()=>document.querySelector('#window-file-dialog [role="alert"]').textContent.length>0);
      assert.ok(await p.locator('#window-file-dialog').isVisible());
    }
    await p.locator('#window-file-dialog').getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await p.locator('.app-file').count(),1);
  });
  await check('unsaved close is cancellable and failed writes preserve the saved file',async()=>{
    await file(p,'renamed.md').dblclick();await active(p).locator('textarea').fill('not committed');
    p.once('dialog',d=>d.dismiss());await active(p).locator('.window-controls [data-action="close"]').click();assert.ok(await active(p).locator('textarea').isVisible());
    await p.evaluate(()=>{window.oldPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Full','QuotaExceededError')}});
    await active(p).locator('.editor-tools [data-fs="save"]').click();
    await p.waitForFunction(()=>document.querySelector('.os-window.is-active .window-status').textContent.includes('Not saved'));
    assert.equal(await active(p).locator('textarea').inputValue(),'not committed');
    await p.evaluate(()=>{IDBObjectStore.prototype.put=window.oldPut});
    const stored=await rawDisk(p);assert.equal(stored.nodes.find(n=>n.name==='renamed.md').content,content);
    p.once('dialog',d=>d.accept());await active(p).locator('.window-controls [data-action="close"]').click();
  });
  await check('cross-tab writes serialize and notify the live Explorer',async()=>{
    await go(p,'C:\\beepOS\\my stuff');assert.equal(await diskHandle(p),true);
    const other=await context.newPage();await start(other);assert.equal(await diskHandle(other),true);
    await Promise.all([p.evaluate(()=>window.testDisk.create('stuff','Tab A','folder')),other.evaluate(()=>window.testDisk.create('stuff','Tab B','folder'))]);
    await file(p,'Tab A').waitFor();await file(p,'Tab B').waitFor();
    const results=await Promise.allSettled([p.evaluate(()=>window.testDisk.create('stuff','Only One','folder')),other.evaluate(()=>window.testDisk.create('stuff','Only One','folder'))]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const disk=await rawDisk(p);assert.equal(disk.nodes.filter(n=>n.name==='Only One').length,1);
    // A stale editor cannot silently overwrite a newer saved version.
    const id=await p.evaluate(()=>window.testDisk.create('stuff','shared.txt','text'));
    await p.evaluate(id=>window.testDisk.write(id,'first',''),id);
    await assert.rejects(other.evaluate(id=>window.testDisk.write(id,'stale',''),id),/changed in another window/);
    assert.equal((await rawDisk(p)).nodes.find(n=>n.id===id).content,'first');
    await other.close();
  });
  await check('system files stay read-only and folders contain discoverable eggs',async()=>{
    await go(p,'C:\\beepOS\\definitely not secrets');await file(p,'do not read.txt').dblclick();
    assert.equal(await active(p).locator('textarea').evaluate(el=>el.readOnly),true);
    assert.match(await active(p).locator('textarea').inputValue(),/green toaster/);
    assert.equal(await active(p).locator('.editor-tools [data-fs="save"]').isDisabled(),true);
    await go(p,'C:\\beepOS');await file(p,'VERSION.txt').dblclick();assert.match(await active(p).locator('textarea').inputValue(),/1.0.*FINAL/);
  });
  await check('prompt navigates and creates real disk entries while dangerous commands remain jokes',async()=>{
    await p.locator('.start-button').click();await p.locator('.start-menu [data-open="terminal"]').click();
    const input=active(p).locator('input');
    async function command(text){await input.fill(text);await input.press('Enter');await p.waitForFunction(()=>!document.querySelector('.terminal-content input').disabled)}
    await command('mkdir "Prompt Stuff"');await command('cd "Prompt Stuff"');await command('touch diary.txt');await command('pwd');
    assert.match(await active(p).locator('.terminal-output').textContent(),/my stuff\\Prompt Stuff/);
    await command('sudo rm -rf /');assert.match(await active(p).locator('.terminal-output').textContent(),/flamethrower/);
    await command('cd ..');await command('open "Prompt Stuff"');await p.locator('#window-computer.is-active').waitFor();
    await file(p,'diary.txt').waitFor();
  });
  await check('mobile disk controls, creation dialog and text editor fit',async()=>{
    await p.setViewportSize({width:390,height:844});await explorer(p);await create(p,'folder','Phone folder');await file(p,'Phone folder').dblclick();await create(p,'text','Phone.txt');await file(p,'Phone.txt').dblclick();
    await active(p).locator('textarea').fill('beep from a phone');await active(p).locator('.editor-tools [data-fs="save"]').click();
    await p.waitForFunction(()=>document.querySelector('.os-window.is-active .window-status').textContent.includes('Saved to C:'));
    assert.equal(await active(p).locator('.window-body').evaluate(el=>el.scrollWidth>el.clientWidth),false);
    await p.keyboard.press('Escape');await screenshot(p,'filesystem-mobile-editor.png');await explorer(p);await screenshot(p,'filesystem-mobile.png');
  });
  await check('unavailable storage gives an honest temporary session without touching legacy notes',async()=>{
    const c=await browser.newContext({viewport:{width:1440,height:900}});
    await c.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('Blocked','SecurityError')}});localStorage.setItem('beepOS.note','legacy note survives')});
    const q=await c.newPage();await start(q);assert.equal(await q.locator('#sticky-note').inputValue(),'legacy note survives');await explorer(q);assert.match(await q.locator('.disk-notice').textContent(),/Temporary disk/);
    await create(q,'folder','Temporary');await file(q,'Temporary').waitFor();await q.reload();await q.locator('.home-content').waitFor();await explorer(q);assert.equal(await file(q,'Temporary').count(),0);await c.close();
  });
  await check('damaged saved disks are never silently reset',async()=>{
    const c=await browser.newContext();const q=await c.newPage();await start(q);
    const damaged={version:999,userData:'do not overwrite me'};await rawDisk(q,damaged);
    await q.reload();await q.locator('.home-content').waitFor();await explorer(q);assert.match(await q.locator('.disk-notice').textContent(),/left untouched/);
    await create(q,'text','temporary.txt');assert.deepEqual(await rawDisk(q),damaged);await c.close();
  });
  assert.deepEqual(errors,[]);console.log(`\n${passed} filesystem checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>browser?.close());
