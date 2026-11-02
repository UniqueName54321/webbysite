/* beepOS virtual disk. IndexedDB transactions serialize writes across tabs.
   User text is data, never executable HTML or JavaScript. */
const MAX_NODES = 2048;
const MAX_TEXT = 262144;
export function validName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 120 &&
    name === name.trim() && !/[<>:"/\\|?*\x00-\x1f]/.test(name) && !/[. ]$/.test(name) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name);
}
export function seedDisk(apps) {
  const nodes = [];
  const add = (id, parent, name, type, extra = {}) => nodes.push({ id, parent, name, type, locked: true, ...extra });
  add('root', null, 'C:', 'folder');
  add('os', 'root', 'beepOS', 'folder');
  add('stuff', 'os', 'my stuff', 'folder');
  add('system', 'os', 'system', 'folder');
  add('logs', 'os', 'logs', 'folder');
  add('secrets', 'os', 'definitely not secrets', 'folder');
  add('programs', 'root', 'Program Files', 'folder');
  add('windows', 'root', 'WINDOWS', 'folder');
  add('recycler', 'root', 'RECYCLED', 'folder');
  for (const id of ['home', 'computer', 'quotes', 'inactive', 'nouveau', 'terminal', 'readme', 'note']) {
    add(`app-${id}`, 'stuff', apps[id].name, 'app', { app: id });
  }
  for (const id of ['settings', 'about', 'find']) add(`app-${id}`, 'system', apps[id].name, 'app', { app: id });
  const notes = [
    ['release', 'os', 'VERSION.txt', 'beepOS 1.0 — FINAL\nThe cupboards are real now. Well, browser-real.\nThanks for exploring my little corner of the internet.\n— Bug Hayes :3'],
    ['bootlog', 'logs', 'boot.log', '[OK] found pixels\n[OK] fed the protogen\n[WARN] user may right-click the wallpaper\n[OK] mounted C:\\ without asking a single floppy disk'],
    ['secret', 'secrets', 'do not read.txt', 'Well, that sign lasted approximately zero seconds.\nThere is no prize. Just a green toaster looking impressed. :3'],
    ['ram', 'system', 'RAM.txt', 'Please do not download more RAM.\nThe last batch was full of raisins.'],
    ['dll', 'windows', 'important.dll.txt', 'This is a text file wearing a DLL costume.\nMuch like this website is wearing an operating system costume.'],
    ['empty', 'recycler', 'your dignity.txt', 'Recovered after a failed sudo attempt.\nCondition: slightly singed.'],
    ['installer', 'programs', 'setup.txt', 'Installation complete.\nWe installed absolutely nothing. A new industry record.'],
    ['weather', 'secrets', 'weather forecast.txt', 'Cloudy, with a chance of beeps.\nTomorrow: still a website.'],
    ['license', 'os', 'EULA.txt', 'By reading this file you agree that the computer is trying its best.\nThat is the entire agreement.']
  ];
  for (const [id, parent, name, content] of notes) add(id, parent, name, 'text', { content });
  return { version: 1, revision: 0, nodes };
}
export function validateDisk(disk, appIds) {
  if (!disk || disk.version !== 1 || !Number.isSafeInteger(disk.revision) || disk.revision < 0 || !Array.isArray(disk.nodes) || disk.nodes.length > MAX_NODES) throw Error('Unrecognized or damaged disk.');
  const map = new Map();
  const names = new Set();
  for (const n of disk.nodes) {
    if (!n || typeof n.id !== 'string' || !/^[a-z0-9-]+$/.test(n.id) || map.has(n.id) || typeof n.locked !== 'boolean' || !['folder', 'text', 'app'].includes(n.type)) throw Error('Invalid disk entry.');
    if (n.id !== 'root' && (!validName(n.name) || typeof n.parent !== 'string')) throw Error('Invalid file name.');
    if (n.type === 'text' && (typeof n.content !== 'string' || n.content.length > MAX_TEXT)) throw Error('Invalid text file.');
    if (n.type === 'app' && (!appIds.has(n.app) || !n.locked)) throw Error('Unknown application.');
    const key = `${n.parent}\0${n.name.toLowerCase()}`;
    if (names.has(key)) throw Error('Duplicate file name.');
    names.add(key); map.set(n.id, n);
  }
  const root = map.get('root');
  if (!root || root.parent !== null || root.type !== 'folder' || root.name !== 'C:' || !root.locked) throw Error('Missing root.');
  for (const [id, parent, name] of [['os', 'root', 'beepOS'], ['stuff', 'os', 'my stuff']]) {
    const n = map.get(id);
    if (!n || n.type !== 'folder' || n.parent !== parent || n.name !== name || !n.locked) throw Error('Missing system folder.');
  }
  for (const node of map.values()) {
    let current = node; const seen = new Set();
    while (current.id !== 'root') {
      if (seen.has(current.id)) throw Error('Folder cycle.');
      seen.add(current.id); current = map.get(current.parent);
      if (!current || current.type !== 'folder') throw Error('Missing parent folder.');
    }
  }
  return disk;
}
function openDatabase() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(Error('Disk storage timed out.')); }, 2500);
    let request;
    try { request = indexedDB.open('beepOS-filesystem', 1); }
    catch (error) { clearTimeout(timer); reject(error); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('disk')) request.result.createObjectStore('disk'); };
    request.onsuccess = () => { clearTimeout(timer); if (settled) request.result.close(); else { settled = true; resolve(request.result); } };
    request.onerror = request.onblocked = () => { clearTimeout(timer); if (!settled) { settled = true; reject(Error('Disk storage is unavailable.')); } };
  });
}
export async function createFilesystem(apps) {
  const appIds = new Set(Object.keys(apps));
  let state = seedDisk(apps);
  let db = null;
  let warning = '';
  const listeners = new Set();
  const emit = () => { for (const listener of listeners) listener(); };
  function transaction(change) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('disk', change ? 'readwrite' : 'readonly');
      const store = tx.objectStore('disk');
      const request = store.get('C');
      let next; let failure;
      request.onsuccess = () => {
        try {
          next = validateDisk(request.result ?? seedDisk(apps), appIds);
          if (change) { change(next); next.revision++; validateDisk(next, appIds); store.put(next, 'C'); }
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => { state = next; resolve(); };
      tx.onerror = tx.onabort = () => reject(failure || Error('Could not save the disk. Storage may be full.'));
    });
  }
  try { db = await openDatabase(); await transaction(() => {}); }
  catch (error) { db?.close(); db = null; warning = `${error.message} Temporary disk: changes will not survive a reload. Any existing stored disk was left untouched.`; }
  const persistent = !!db;
  let channel;
  try { channel = new BroadcastChannel('beepOS-filesystem'); } catch { /* Optional cross-tab refresh. */ }
  async function refresh() { if (db) { await transaction(); emit(); } }
  if (channel) channel.onmessage = () => refresh().catch(() => {});
  if (db) db.onversionchange = () => { db.close(); db = null; warning = 'Disk changed in another tab. Reload before saving.'; emit(); };
  async function mutate(change) {
    if (persistent && !db) throw Error('Disk connection closed. Reload to reconnect.');
    if (db) await transaction(change);
    else { const next = structuredClone(state); change(next); next.revision++; validateDisk(next, appIds); state = next; }
    channel?.postMessage('changed'); emit();
  }
  function node(id) { return state.nodes.find(n => n.id === id); }
  function path(id) { const parts = []; let n = node(id); while (n) { parts.unshift(n.name); n = node(n.parent); } return parts.join('\\') + (id === 'root' ? '\\' : ''); }
  function assertName(disk, parent, name, except) {
    if (!validName(name)) throw Error('Use a name of 1–120 characters without Windows reserved names, trailing dots or <>:"/\\|?*.');
    if (!disk.nodes.some(n => n.id === parent && n.type === 'folder')) throw Error('Folder no longer exists.');
    if (disk.nodes.some(n => n.parent === parent && n.id !== except && n.name.toLowerCase() === name.toLowerCase())) throw Error('That name already exists in this folder.');
  }
  return {
    persistent, get warning() { return warning; },
    node: id => { const n = node(id); return n && structuredClone(n); },
    list: id => state.nodes.filter(n => n.parent === id).map(n => structuredClone(n)),
    path,
    resolve(input, from = 'stuff') {
      const value = input.replaceAll('/', '\\');
      const absolute = /^c:/i.test(value) || value.startsWith('\\');
      let current = absolute ? 'root' : from;
      for (const part of value.replace(/^c:/i, '').split('\\').filter(Boolean)) {
        if (part === '.') continue;
        if (part === '..') { current = node(current)?.parent || 'root'; continue; }
        const found = state.nodes.find(n => n.parent === current && n.name.toLowerCase() === part.toLowerCase());
        if (!found) return null;
        current = found.id;
      }
      return node(current)?.id || null;
    },
    async create(parent, name, type) {
      if (!['folder', 'text'].includes(type)) throw Error('Unsupported file type.');
      const id = `user-${crypto.randomUUID()}`;
      await mutate(disk => { assertName(disk, parent, name); if (disk.nodes.length >= MAX_NODES) throw Error('Disk has reached its 2048-item limit.'); disk.nodes.push({ id, parent, name, type, locked: false, ...(type === 'text' ? { content: '' } : {}) }); });
      return id;
    },
    async write(id, content, expectedContent) {
      await mutate(disk => { const n = disk.nodes.find(n => n.id === id); if (!n || n.type !== 'text' || n.locked) throw Error('This file is read-only.'); if (expectedContent !== undefined && n.content !== expectedContent) throw Error('This file changed in another window. Reopen it before saving; your draft is still here.'); if (typeof content !== 'string' || content.length > MAX_TEXT) throw Error('Text files are limited to 256 Ki characters.'); n.content = content; });
    },
    async rename(id, name) {
      await mutate(disk => { const n = disk.nodes.find(n => n.id === id); if (!n || n.locked) throw Error('System files cannot be renamed.'); assertName(disk, n.parent, name, id); n.name = name; });
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    refresh
  };
}
