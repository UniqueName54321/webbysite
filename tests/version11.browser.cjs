const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const base=process.env.BEEPOS_URL||'http://127.0.0.1:8765';
const output=process.env.BEEPOS_SCREENSHOTS||path.join(require('node:os').tmpdir(),'beepos-screenshots');
fs.mkdirSync(output,{recursive:true});
let browser,passed=0;const errors=[];
const active=p=>p.locator('.os-window.is-active');
async function check(name,fn){await fn();passed++;console.log('PASS',name)}
async function open(p,id){await p.locator('.start-button').click();await p.locator(`.start-menu [data-open="${id}"]`).click();await p.locator(`#window-${id}.is-active .app-content`).waitFor()}
async function menu(p,name){await active(p).locator('summary').filter({hasText:new RegExp('^'+name+'$')}).click()}
async function effect(p,name){await menu(p,'Window');await active(p).locator(`[data-effect="${name}"]`).click()}
async function reset(p){await p.locator('.start-button').click();await p.locator('.start-menu [data-action="reset-effects"]').click()}
async function shot(p,name){await p.screenshot({path:path.join(output,name),animations:'disabled'})}
async function blankContext(p){const area=await active(p).locator('.computer-content').boundingBox();await active(p).locator('.computer-content').click({button:'right',position:{x:area.width-12,y:area.height-12}})}
async function createContext(p,type,name){await blankContext(p);await p.locator(`.explorer-context-menu [data-file-context="${type}"]`).click();await p.locator('#new-file-name').fill(name);await p.locator('#window-file-dialog [type="submit"]').click();await p.locator('#window-file-dialog').waitFor({state:'detached'})}
function file(p,name){return p.locator('.app-file').filter({has:p.locator('span').filter({hasText:new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})})}
async function selectDelete(p,item,accept){await item.click({button:'right'});p.once('dialog',d=>accept?d.accept():d.dismiss());await p.locator('.explorer-context-menu [data-file-context="delete"]').click()}
(async()=>{
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});const p=await context.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('.home-content').waitFor();await p.locator('.boot-screen').waitFor({state:'detached'});
 await check('1.1 rotation changes the real frame, survives dragging and resets',async()=>{
  await menu(p,'Window');const range=active(p).locator('[data-effect="rotation"]');await range.focus();await range.press('ArrowRight');assert.equal(await active(p).evaluate(el=>el.style.rotate),'1deg');await range.evaluate(el=>{el.value='30';el.dispatchEvent(new Event('input',{bubbles:true}))});await p.keyboard.press('Escape');
  assert.equal(await active(p).evaluate(el=>el.style.rotate),'30deg');assert.notEqual(await p.locator('#window-note').evaluate(el=>el.style.rotate),'30deg');
  const bar=await active(p).locator('.window-titlebar').boundingBox();const before=await active(p).evaluate(el=>[el.offsetLeft,el.offsetTop]);
  await p.mouse.move(bar.x+bar.width*.5,bar.y+bar.height/2);await p.mouse.down();await p.mouse.move(bar.x+bar.width*.5+24,bar.y+bar.height/2+16,{steps:4});await p.mouse.up();
  const after=await active(p).evaluate(el=>[el.offsetLeft,el.offsetTop]);assert.equal(after[0]-before[0],24);assert.equal(after[1]-before[1],16);
  await shot(p,'v11-rotated-window.png');await reset(p);assert.equal(await p.locator('#window-home').evaluate(el=>el.style.rotate),'0deg');
 });
 await check('collision solver separates overlapping items and responds to impacts',async()=>{
  const result=await p.evaluate(async()=>{const{stepBodies}=await import('/window-effects.js');const b=[{x:20,y:20,w:20,h:20,vx:100,vy:0},{x:35,y:20,w:20,h:20,vx:-100,vy:0}];stepBodies(b,200,200,0,0,1/120);const falling={x:10,y:10,w:20,h:20,vx:0,vy:0};for(let i=0;i<240;i++)stepBodies([falling],100,100,0,800,1/120);return{b,falling}});
  assert.ok(result.b[0].x+20<=result.b[1].x+.02);assert.ok(result.b[0].vx<0&&result.b[1].vx>0);assert.ok(result.falling.y>10&&result.falling.y<=80);
 });
 await check('physics moves actual icons, is isolated per window, and restores nodes',async()=>{
  await open(p,'computer');await p.evaluate(()=>window.originalFiles=[...document.querySelectorAll('#window-computer .app-file')]);
  await effect(p,'physics');assert.equal(await active(p).getAttribute('data-physics'),'true');assert.equal(await p.locator('#window-note .physics-container').count(),0);
  const first=await active(p).locator('.app-file').first().evaluate(el=>el.style.transform);
  await p.waitForFunction(initial=>document.querySelector('#window-computer .app-file').style.transform!==initial,first);
  const sizes=await active(p).locator('.physics-container').evaluate(el=>({w:el.clientWidth,h:el.clientHeight,rects:[...el.querySelectorAll('.physics-item')].map(n=>n.style.transform)}));assert.ok(sizes.rects.length===8&&sizes.rects.every(t=>t.includes('translate')));
  await effect(p,'right');assert.equal(await active(p).evaluate(el=>el.style.rotate),'15deg');await p.waitForTimeout(800);await shot(p,'v11-physics-desktop.png');
  await active(p).locator('.app-file[data-open="quotes"]').click({force:true});assert.equal(await active(p).locator('.app-file[data-open="quotes"]').getAttribute('aria-selected'),'true');
  await active(p).locator('.window-controls [data-action="minimize"]').click();
  const frozen=await p.locator('#window-computer .app-file').first().evaluate(el=>el.style.transform);await p.waitForTimeout(120);assert.equal(await p.locator('#window-computer .app-file').first().evaluate(el=>el.style.transform),frozen);
  await p.locator('.task-button[aria-controls="window-computer"]').click();await reset(p);
  assert.equal(await p.evaluate(()=>window.originalFiles.every((n,i)=>n===document.querySelectorAll('#window-computer .app-file')[i])),true);
  assert.equal(await p.locator('#window-computer .physics-item').count(),0);
  await p.locator('#window-computer .app-file[data-open="quotes"]').dblclick();await p.locator('#window-quotes.is-active blockquote').first().waitFor();
 });
 await check('app-specific menus have working commands and independent About windows',async()=>{
  await open(p,'terminal');assert.ok(await active(p).locator('summary').filter({hasText:/^Command$/}).isVisible());
  await menu(p,'Command');await active(p).locator('[data-app-command="whoami"]').click();assert.match(await active(p).locator('.terminal-output').textContent(),/Bug Hayes/);
  await menu(p,'Help');await active(p).locator('[data-effect="about"]').click();await p.locator('#window-about-terminal.is-active').waitFor();assert.match(await active(p).locator('.app-about-description').textContent(),/toy shell/);
  await open(p,'computer');assert.ok(await active(p).locator('summary').filter({hasText:/^Go$/}).isVisible());
  await menu(p,'Help');await active(p).locator('[data-effect="about"]').click();await p.locator('#window-about-computer.is-active').waitFor();assert.match(await active(p).locator('.app-about-description').textContent(),/file explorer/);
  assert.equal(await p.locator('#window-about-terminal').count(),1);await shot(p,'v11-app-about.png');
  await open(p,'settings');await menu(p,'Display');await active(p).locator('[data-app-command="sound"]').click();assert.equal(await active(p).locator('[name="desktop-sound"]').isChecked(),true);
 });
 await check('Explorer context creation and confirmed persistent deletion work',async()=>{
  await open(p,'computer');await createContext(p,'text','delete-me.txt');const entry=file(p,'delete-me.txt');await entry.waitFor();
  await selectDelete(p,entry,false);assert.equal(await entry.count(),1);await selectDelete(p,entry,true);await entry.waitFor({state:'detached'});
  await p.locator('.app-file[data-open="home"]').click({button:'right'});assert.equal(await p.locator('.explorer-context-menu [data-file-context="delete"]').isDisabled(),true);await p.keyboard.press('Escape');
  await createContext(p,'folder','Nested');await file(p,'Nested').dblclick();await createContext(p,'text','inside.txt');await p.locator('.explorer-tools [data-fs="up"]').click();await selectDelete(p,file(p,'Nested'),true);await file(p,'Nested').waitFor({state:'detached'});
  await p.reload();await p.locator('.home-content').waitFor();await open(p,'computer');assert.equal(await file(p,'delete-me.txt').count(),0);assert.equal(await file(p,'Nested').count(),0);
  await blankContext(p);await shot(p,'v11-explorer-context.png');await p.keyboard.press('Escape');
 });
 await check('deletion refuses unsaved edits, but preserves a snapshot after saved deletion',async()=>{
  await createContext(p,'text','draft.txt');await file(p,'draft.txt').dblclick();const editor=active(p);await editor.locator('textarea').fill('keep this draft');const editorId=await editor.getAttribute('id');
  await open(p,'computer');await file(p,'draft.txt').click({button:'right'});await p.locator('.explorer-context-menu [data-file-context="delete"]').click();await p.locator(`#${editorId}.is-active`).waitFor();assert.equal(await active(p).locator('textarea').inputValue(),'keep this draft');
  await active(p).locator('.editor-tools [data-fs="save"]').click();await p.waitForFunction(()=>document.querySelector('.os-window.is-active .window-status').textContent.includes('Saved to C:'));
  await open(p,'computer');await selectDelete(p,file(p,'draft.txt'),true);await file(p,'draft.txt').waitFor({state:'detached'});assert.equal(await p.locator(`#${editorId} textarea`).inputValue(),'keep this draft');assert.equal(await p.locator(`#${editorId} textarea`).evaluate(el=>el.readOnly),true);
 });
 await check('My Computer inside My Computer opens only the requested Inception page',async()=>{
  await context.route('https://www.imdb.com/**',route=>route.fulfill({contentType:'text/html',body:'<title>Inception</title>dream within a dream'}));
  const popup=context.waitForEvent('page');await p.locator('#window-computer .app-file[data-open="computer"]').dblclick();const film=await popup;await film.waitForURL('https://www.imdb.com/title/tt1375666/');assert.equal(await film.evaluate(()=>window.opener===null),true);await film.close();
  await open(p,'computer');assert.equal(await p.locator('#window-computer.is-active').count(),1);
 });
 await check('physics preserves drafts and live handlers in text editors',async()=>{
  await createContext(p,'text','gravity.txt');await file(p,'gravity.txt').dblclick();await active(p).locator('textarea').fill('I have gravity and an unsaved draft.');const id=await active(p).getAttribute('id');
  await effect(p,'physics');await p.waitForTimeout(100);await p.locator(`#${id} textarea`).press('End');await p.locator(`#${id} textarea`).type(' beep.');assert.equal(await p.locator(`#${id} textarea`).inputValue(),'I have gravity and an unsaved draft. beep.');
  await reset(p);assert.equal(await p.locator(`#${id} textarea`).inputValue(),'I have gravity and an unsaved draft. beep.');await p.locator(`#${id} .editor-tools [data-fs="save"]`).click();await p.waitForFunction(()=>document.querySelector('.os-window.is-active .window-status').textContent.includes('Saved to C:'));
 });
 await check('mobile rotation/physics has a reachable global reset',async()=>{
  await p.setViewportSize({width:390,height:844});await open(p,'computer');await effect(p,'physics');await effect(p,'right');await p.keyboard.press('Escape');const rotated=await active(p).boundingBox();assert.ok(rotated.x>=0&&rotated.y>=0&&rotated.x+rotated.width<=390&&rotated.y+rotated.height<=804);await shot(p,'v11-physics-mobile.png');await reset(p);assert.equal(await p.locator('#window-computer').evaluate(el=>el.style.rotate),'0deg');assert.equal(await p.locator('#window-computer .physics-item').count(),0);
  const box=await p.locator('#window-computer').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);await blankContext(p);await shot(p,'v11-context-mobile.png');await p.keyboard.press('Escape');
 });
 await check('1.0 disk and preferences upgrade without reseeding user data',async()=>{
  await p.setViewportSize({width:1440,height:900});
  const before=await p.evaluate(async()=>{
    localStorage.setItem('beepOS.note','a note from 1.0');localStorage.setItem('beepOS.theme','lagoon');
    return await new Promise((resolve,reject)=>{const r=indexedDB.open('beepOS-filesystem',1);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('disk','readwrite');const store=tx.objectStore('disk');let disk;const get=store.get('C');get.onsuccess=()=>{disk=get.result;disk.nodes.find(n=>n.id==='release').content='beepOS 1.0 — FINAL\nThe cupboards are real now. Well, browser-real.\nThanks for exploring my little corner of the internet.\n— Bug Hayes :3';disk.nodes.push({id:'user-migration',parent:'stuff',name:'from-1.0.txt',type:'text',locked:false,content:'keep me :3'});store.put(disk,'C')};tx.oncomplete=()=>{db.close();resolve(disk.nodes.filter(n=>n.id!=='release'))};tx.onerror=()=>reject(tx.error)}});
  });
  await p.reload();await p.locator('.home-content').waitFor();await p.locator('.boot-screen').waitFor({state:'detached'});
  assert.equal(await p.locator('#sticky-note').inputValue(),'a note from 1.0');assert.equal(await p.locator('.desktop').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(53, 102, 109)');
  const after=await p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('beepOS-filesystem',1);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('disk');let disk;tx.objectStore('disk').get('C').onsuccess=e=>disk=e.target.result;tx.oncomplete=()=>{db.close();resolve(disk)}}}));
  assert.deepEqual(after.nodes.filter(n=>n.id!=='release'),before);assert.match(after.nodes.find(n=>n.id==='release').content,/beepOS 1.1/);
  await open(p,'computer');await file(p,'from-1.0.txt').dblclick();assert.equal(await active(p).locator('textarea').inputValue(),'keep me :3');
 });
 assert.deepEqual(errors,[]);console.log(`\n${passed} version 1.1 checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>browser?.close());
