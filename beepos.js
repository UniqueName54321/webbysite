/* beepOS — a small desktop for a small website. No dependencies, no build step. */
(() => {
  "use strict";

  const source = document.getElementById("page-content");
  if (!source) return;

  const base = new URL(".", document.currentScript.src);
  const asset = (file) => new URL(file, base).href;
  const icon = (name, className = "") => `<svg class="${className}" aria-hidden="true"><use href="${asset("assets/icons.svg")}#${name}"></use></svg>`;
  const storage = {
    get(key, fallback) {
      try { return localStorage.getItem(`beepOS.${key}`) ?? fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(`beepOS.${key}`, value); return true; }
      catch { return false; }
    }
  };

  const findErrors = [
    "If you're looking for something, it's always in the last place you look.",
    "This program doesn't work. But, at least it's better than Windows search.",
    "Search complete: found the audacity. Still looking for your file.",
    "The thing you want is somewhere very safe. Unfortunately, nobody knows where.",
    "Have you checked the pocket of the trousers you wore yesterday?",
    "Error 404: motivation to search not found.",
    "Your file is in another castle. Probably in a folder called 'final_FINAL_v3'.",
    "We searched everywhere except the place it actually is. You're welcome."
  ];
  let lastFindError = -1;
  let propertiesTarget = "home";
  const apps = {
    commons: { name: "Images", label: "Images", icon: "folder", path: "Media\\Images", width: 680, height: 520, status: "Wikimedia Commons · live categories and images" },
    'file-dialog': { name: "New / Rename", label: "New / Rename", icon: "folder", path: "system\\files.exe", width: 350, height: 230, status: "choose a name" },
    properties: { name: "Properties", label: "Properties", icon: "settings", path: "system\\properties.exe", width: 360, height: 290, status: "desktop shortcut properties" },
    find: { name: "Find", label: "Find", icon: "offline", path: "system\\find.exe", width: 380, height: 210, status: "search failed successfully" },
    readme: { name: "README.md", label: "README.md", icon: "quotes", file: "desktop/README.md", path: "desktop\\README.md", width: 600, height: 460, status: "README.md · read-only · deliberately unhelpful" },
    home: { name: "welcome.exe", label: "Welcome", icon: "computer", file: "index.html", path: "welcome.exe", width: 640, height: 512, status: "welcome to your little corner of the internet" },
    computer: { name: "My computer", label: "My computer", icon: "folder", path: "my stuff", width: 580, height: 390, status: "C: virtual disk" },
    quotes: { name: "quotes.txt", label: "Quotes & jokes", icon: "quotes", file: "quotes.html", path: "my stuff\\quotes.txt", width: 600, height: 390, status: "3 entries · read-only · unfortunately" },
    inactive: { name: "account graveyard", label: "Account graveyard", icon: "archive", file: "inactive.html", path: "my stuff\\account graveyard", width: 660, height: 550, status: "inactive, potentially inactive & formerly inactive" },
    nouveau: { name: "NouveauBrowser checker", label: "Nouveau checker", icon: "globe", file: "nouveau/nouveautest.html", path: "utilities\\nouveau.exe", width: 480, height: 450, status: "browser diagnostics · The Nouveau Project" },
    terminal: { name: "beep prompt", label: "Beep prompt", icon: "terminal", path: "system\\beep.exe", width: 600, height: 360, status: "type help to see what this thing can do" },
    settings: { name: "Display properties", label: "Display settings", icon: "settings", path: "system\\display.exe", width: 420, height: 440, status: "make yourself at home" },
    note: { name: "a note to self", label: "Sticky note", icon: "note", path: "my stuff\\note.txt", width: 225, height: 240, status: "" },
    about: { name: "About beepOS", label: "About beepOS", icon: "beep", path: "system\\about.exe", width: 400, height: 360, status: "beepOS 1.1 · personal edition" },
    notfound: { name: "file not found", label: "File not found", icon: "offline", width: 540, height: 475, status: "error 404 · this file has left the chat" }
  };
  const initialApp = apps[source.dataset.app] ? source.dataset.app : "home";
  const templates = new Map([[initialApp, { html: source.innerHTML, className: source.className }]]);
  let createWindowPhysics;
  const aboutTargets = new Map();
  let filesystem;
  let fileRequest;
  const editorFiles = new Map();
  const windows = new Map();
  const loading = new Map();
  let topLayer = 10;
  let activeId = null;
  let audioContext;
  let toastTimeout;
  let soundEnabled = storage.get("sound", "off") === "on";
  let plainWallpaper = storage.get("wallpaper", "dots") === "plain";
  const themes = {
    garden: ["#326b52", "#295b46", "#497c62"],
    lagoon: ["#35666d", "#285159", "#4b7980"],
    dusk: ["#635b6f", "#4c4557", "#7b7285"]
  };
  let theme = storage.get("theme", "garden");
  if (!Object.hasOwn(themes, theme)) theme = "garden";

  function appLink(id, className, label = apps[id].label) {
    const app = apps[id];
    const content = `${icon(app.icon)}<span>${label}</span>`;
    return app.file
      ? `<a class="${className}" href="${asset(app.file)}" data-open="${id}">${content}</a>`
      : `<button class="${className}" type="button" data-open="${id}">${content}</button>`;
  }

  function pixelLogo() {
    const letters = [
      ["10000", "10000", "11110", "10001", "10001", "10001", "11110"],
      ["00000", "00000", "01110", "10001", "11111", "10000", "01111"],
      ["00000", "00000", "01110", "10001", "11111", "10000", "01111"],
      ["00000", "00000", "11110", "10001", "11110", "10000", "10000"],
      ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
      ["01111", "10000", "10000", "01110", "00001", "00001", "11110"]
    ];
    const pixels = letters.map((rows, i) => rows.map((row, y) => [...row].map((bit, x) => bit === "1" ? `<rect x="${i * 6 + x}" y="${y}" width="1" height="1"/>` : "").join("")).join("")).join("");
    return `<svg class="brand-pixels" viewBox="0 0 35 7" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${pixels}</svg>`;
  }

  const desktop = document.createElement("main");
  desktop.className = "desktop";
  desktop.id = "desktop";
  desktop.tabIndex = -1;
  desktop.setAttribute("aria-label", "beepOS desktop");
  desktop.innerHTML = `
    <div class="desktop-topline"><span><strong>beepOS</strong> / PERSONAL EDITION</span><span>an operating system for doing absolutely whatever.</span></div>
    <nav class="desktop-shortcuts" aria-label="Desktop apps">
      ${appLink("home", "shortcut", "Welcome")}
      ${appLink("computer", "shortcut")}
      ${appLink("quotes", "shortcut", "quotes.txt")}
      ${appLink("inactive", "shortcut", "Account<br>graveyard")}
      ${appLink("nouveau", "shortcut", "Nouveau<br>checker")}
      ${appLink("terminal", "shortcut")}
      ${appLink("readme", "shortcut")}
    </nav>
    <div class="wallpaper-brand" aria-hidden="true">${pixelLogo()}<p>your very personal computer.</p><p class="brand-version">version 1.1 / beep8.xyz</p></div>
    <div class="desktop-hint" aria-hidden="true">click an icon. poke around.<span>no installation required. probably a good thing.</span></div>`;

  const startMenu = document.createElement("nav");
  startMenu.className = "start-menu";
  startMenu.id = "start-menu";
  startMenu.hidden = true;
  startMenu.setAttribute("aria-label", "Start menu");
  startMenu.innerHTML = `
    <div class="start-rail">beepOS <span>personal edition</span></div>
    <div class="start-items">
      <div class="start-heading">hello, internet person.</div>
      ${["home", "computer", "quotes", "inactive", "nouveau", "terminal", "note"].map((id) => appLink(id, "start-item")).join("")}
      <hr class="start-divider">
      ${appLink("find", "start-item")}${appLink("settings", "start-item")}${appLink("about", "start-item")}
      <hr class="start-divider">
      <button class="start-item" type="button" data-action="reset-effects">${icon("settings")}<span>Reset window effects<small>put reality back where you found it</small></span></button>
      <button class="start-item" type="button" data-action="show-desktop">${icon("computer")}<span>Show desktop<small>give your windows a little rest</small></span></button>
    </div>`;

  const taskbar = document.createElement("footer");
  taskbar.className = "taskbar";
  taskbar.setAttribute("aria-label", "Taskbar");
  taskbar.innerHTML = `
    <button class="start-button" type="button" aria-expanded="false" aria-controls="start-menu">${icon("beep")}<span>start</span></button>
    <div class="quick-launches" aria-label="Quick launch">
      <button class="quick-launch" type="button" data-open="home" aria-label="Open welcome" title="Welcome">${icon("computer")}</button>
      <button class="quick-launch" type="button" data-open="terminal" aria-label="Open beep prompt" title="Beep prompt">${icon("terminal")}</button>
    </div>
    <nav class="task-buttons" aria-label="Open windows"></nav>
    <div class="system-tray">
      <span class="connection-status"><span class="tiny-led" aria-hidden="true"></span><span class="connection-label">online</span></span>
      <button class="tray-button" type="button" data-action="sound" aria-label="Desktop sounds" aria-pressed="${soundEnabled}" title="Toggle desktop sounds">${icon("sound")}</button>
      <time class="clock"></time>
    </div>
    <button class="desktop-button" type="button" data-action="show-desktop" aria-label="Show desktop" title="Show desktop"></button>`;
  const startButton = taskbar.querySelector(".start-button");
  const taskButtons = taskbar.querySelector(".task-buttons");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.hidden = true;
  const announcements = document.createElement("div");
  announcements.className = "sr-only";
  announcements.setAttribute("role", "status");
  const skipLink = document.createElement("a");
  skipLink.className = "skip-link";
  skipLink.href = "#desktop";
  skipLink.textContent = "Skip to desktop";

  source.remove();
  document.body.prepend(skipLink, desktop, startMenu, taskbar, toast, announcements);
  document.body.classList.add("os-running");
  document.title = initialApp === "home" ? "beepOS — beep8.xyz" : `${apps[initialApp].name} — beepOS`;

  // Only desktop surfaces belong to this menu. App contextmenu events pass through.
  const contextMenu = document.createElement("div");
  contextMenu.className = "menu-popup desktop-context-menu";
  contextMenu.setAttribute("role", "menu");
  contextMenu.hidden = true;
  document.body.append(contextMenu);
  let contextTarget = desktop;
  let contextApp = null;

  function closeContextMenu(restoreFocus = false) {
    if (contextMenu.hidden) return;
    contextMenu.hidden = true;
    if (restoreFocus && contextTarget.isConnected) contextTarget.focus({ preventScroll: true });
  }

  function showContextMenu(target, x, y) {
    if (target.closest(".os-window")) return;
    const shortcut = target.closest(".shortcut");
    contextTarget = shortcut || desktop;
    contextApp = shortcut?.dataset.open || null;
    closeStart();
    for (const menu of document.querySelectorAll(".app-menu[open]")) menu.open = false;
    contextMenu.setAttribute("aria-label", contextApp ? `${apps[contextApp].label} context menu` : "Desktop context menu");
    contextMenu.innerHTML = contextApp
      ? '<button type="button" role="menuitem" data-context="open">Open</button><hr><button type="button" role="menuitem" data-context="properties">Properties</button>'
      : '<button type="button" role="menuitem" data-context="nothing">Right-clicking nothing. Ambitious.</button>';
    contextMenu.hidden = false;
    contextMenu.style.left = `${Math.max(4, Math.min(x, innerWidth - contextMenu.offsetWidth - 4))}px`;
    contextMenu.style.top = `${Math.max(4, Math.min(y, innerHeight - contextMenu.offsetHeight - 4))}px`;
    contextMenu.querySelector("button").focus({ preventScroll: true });
  }

  desktop.addEventListener("contextmenu", (event) => {
    if (event.defaultPrevented || event.target.closest(".os-window")) return;
    event.preventDefault();
    const bounds = event.target.closest(".shortcut")?.getBoundingClientRect();
    const keyboard = event.clientX === 0 && event.clientY === 0;
    showContextMenu(event.target, keyboard ? bounds?.left || 8 : event.clientX, keyboard ? bounds?.bottom || 8 : event.clientY);
  });
  desktop.addEventListener("keydown", (event) => {
    if (event.target.closest(".os-window")) return;
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const bounds = event.target.getBoundingClientRect();
      showContextMenu(event.target, bounds.left + 8, event.target === desktop ? 8 : bounds.bottom);
    }
  });
  contextMenu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-context]")?.dataset.context;
    if (!action) return;
    const id = contextApp;
    closeContextMenu(true);
    if (action === "open") openApp(id);
    if (action === "properties") { propertiesTarget = id; openApp("properties"); }
    if (action === "nothing") notify("You right-clicked the wallpaper. It has no files, no ambitions, and now concerns about you.");
  });
  contextMenu.addEventListener("keydown", (event) => {
    const items = [...contextMenu.querySelectorAll("button")];
    const index = items.indexOf(document.activeElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    }
    if (event.key === "Escape" || event.key === "Tab") { closeContextMenu(true); if (event.key === "Escape") event.preventDefault(); }
  });
  document.addEventListener("pointerdown", (event) => { if (!contextMenu.contains(event.target)) closeContextMenu(); });
  window.addEventListener("resize", () => closeContextMenu());
  window.addEventListener("blur", () => closeContextMenu());

  function notify(message) {
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.hidden = false;
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  function beep(force = false) {
    if (!force && !soundEnabled) return false;
    try {
      audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
      gain.gain.setValueAtTime(0.025, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.11);
      return true;
    } catch { return false; }
  }

  function applyDisplay() {
    const colors = themes[theme];
    ["--desktop", "--desktop-dark", "--desktop-dot"].forEach((prop, i) => document.documentElement.style.setProperty(prop, colors[i]));
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors[0]);
    desktop.classList.toggle("flat", plainWallpaper);
  }
  applyDisplay();

  function updateConnection() {
    const online = navigator.onLine;
    const status = taskbar.querySelector(".connection-status");
    status.classList.toggle("is-offline", !online);
    status.querySelector(".connection-label").textContent = online ? "online" : "offline";
    status.title = online ? "Your browser reports an internet connection" : "Your browser is offline";
  }
  function updateClock() {
    const now = new Date();
    const clock = taskbar.querySelector(".clock");
    clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    clock.dateTime = now.toISOString();
    clock.title = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  updateConnection();
  updateClock();
  setInterval(updateClock, 1000);
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);

  function closeStart(returnFocus = false) {
    startMenu.hidden = true;
    startButton.setAttribute("aria-expanded", "false");
    if (returnFocus) startButton.focus();
  }

  function focusWindow(win, moveFocus = false) {
    if (!win || !windows.has(win.id)) return;
    for (const other of windows.values()) {
      const active = other === win;
      other.element.classList.toggle("is-active", active);
      other.task.setAttribute("aria-pressed", String(active));
      if (innerWidth <= 640 && !active) other.physics?.pause();
    }
    win.element.hidden = false;
    win.physics?.resume();
    win.element.style.zIndex = ++topLayer;
    activeId = win.id;
    if (moveFocus) win.element.querySelector(".window-titlebar").focus({ preventScroll: true });
  }

  function focusNext() {
    const visible = [...windows.values()].filter((win) => !win.element.hidden);
    const next = visible.sort((a, b) => Number(b.element.style.zIndex) - Number(a.element.style.zIndex))[0];
    activeId = null;
    if (next) focusWindow(next, true);
    else desktop.focus({ preventScroll: true });
  }

  function minimizeWindow(win, moveFocus = true) {
    win.physics?.pause();
    win.element.hidden = true;
    win.element.classList.remove("is-active");
    win.task.setAttribute("aria-pressed", "false");
    if (activeId === win.id && moveFocus) focusNext();
  }

  function closeWindow(win) {
    if (win.saving) { notify("Please wait for the save to finish."); return; }
    if (win.dirty && !window.confirm("This file has unsaved changes. Discard them and close?")) return;
    win.cleanupCommons?.();
    win.cleanupContext?.();
    win.cleanupEffects?.();
    win.unsubscribe?.();
    win.observer?.disconnect();
    win.element.remove();
    win.task.remove();
    windows.delete(win.id);
    if (activeId === win.id) focusNext();
    announcements.textContent = `${apps[win.id].name} closed`;
  }

  function showDesktop() {
    for (const win of windows.values()) minimizeWindow(win, false);
    activeId = null;
    desktop.focus({ preventScroll: true });
    closeStart();
  }

  function constrainWindow(win) {
    if (window.innerWidth <= 640 || win.element.classList.contains("is-maximized")) return;
    const el = win.element;
    const maxWidth = desktop.clientWidth - 12;
    const maxHeight = desktop.clientHeight - 12;
    if (el.offsetWidth > maxWidth) el.style.width = `${maxWidth}px`;
    if (el.offsetHeight > maxHeight) el.style.height = `${maxHeight}px`;
    const left = Math.max(6, Math.min(parseFloat(el.style.left) || 6, desktop.clientWidth - el.offsetWidth - 6));
    const top = Math.max(6, Math.min(parseFloat(el.style.top) || 6, desktop.clientHeight - el.offsetHeight - 6));
    if (parseFloat(el.style.left) !== left) el.style.left = `${left}px`;
    if (parseFloat(el.style.top) !== top) el.style.top = `${top}px`;
  }

  function toggleMaximize(win) {
    if (win.rotation) setRotation(win, 0);
    const maximized = win.element.classList.toggle("is-maximized");
    const button = win.element.querySelector('[data-action="maximize"]');
    button.setAttribute("aria-label", `${maximized ? "Restore" : "Maximize"} ${apps[win.id].name}`);
    button.classList.toggle("restore", maximized);
    button.classList.toggle("maximize", !maximized);
    button.title = maximized ? "Restore window" : "Maximize window";
    focusWindow(win);
    if (!maximized) constrainWindow(win);
  }

  const appDescriptions = {
    commons: 'Live Wikimedia Commons categories and images. Categories can have multiple parents; image links include source and license information.',
    home: 'The front door to Bug Hayes’s corner of the internet. Links, writing and assorted crap.',
    computer: 'A small file explorer for your persistent C: drive. Now with optional gravity.',
    quotes: 'A read-only collection of jokes. Quality control remains unavailable.',
    inactive: 'The account graveyard: where old internet haunts get an explanation.',
    nouveau: 'Checks the NouveauBrowser detection API. A browser name is not proof.',
    terminal: 'Beep prompt: a toy shell for the virtual disk, with opinions about your commands.',
    settings: 'Wallpaper and tiny computer noises. No reboot or ritual sacrifice required.',
    note: 'A sticky note saved in this browser. Your thoughts, approximately organized.',
    readme: 'The deliberately vague manual. Curiosity sold separately.',
    find: 'A search utility with a perfect record of finding excuses.',
    properties: 'Shortcut metadata. No imaginary hard-drive statistics.',
    'file-dialog': 'Names things. Tries very hard not to name two things the same thing.',
    notfound: 'Reports missing pages with precisely the appropriate amount of attitude.'
  };
  function openAppAbout(id) {
    if (id === 'about' || aboutTargets.has(id)) return openApp('about');
    const key = `about-${id}`;
    aboutTargets.set(key, id);
    apps[key] = { name: `About ${apps[id].name}`, label: `About ${apps[id].name}`, icon: apps[id].icon, path: 'system\\about.exe', width: 420, height: 280, status: 'beepOS 1.1 · application information' };
    openApp(key);
  }
  function setRotation(win, value) {
    if (!Number.isFinite(Number(value))) return;
    const angle = Math.max(-180, Math.min(180, Math.round(Number(value))));
    if (angle && win.element.classList.contains('is-maximized')) toggleMaximize(win);
    win.rotation = angle; win.element.style.rotate = `${angle}deg`;
    const slider = win.element.querySelector('[data-effect="rotation"]');
    if (slider) slider.value = angle;
    const output = win.element.querySelector('.rotation-value'); if (output) output.textContent = `${angle}°`;
    const radians = angle * Math.PI / 180;
    const width = win.element.offsetWidth, height = win.element.offsetHeight;
    const rotatedWidth = Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * height;
    const rotatedHeight = Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * height;
    win.effectScale = angle ? Math.min(1, (desktop.clientWidth - 8) / rotatedWidth, (desktop.clientHeight - 8) / rotatedHeight) : 1;
    win.element.style.scale = String(win.effectScale);
    if (innerWidth > 640 && !win.element.classList.contains('is-maximized')) {
      const box = win.element.getBoundingClientRect();
      const dx = box.left < 4 ? 4 - box.left : box.right > desktop.clientWidth - 4 ? desktop.clientWidth - 4 - box.right : 0;
      const dy = box.top < 4 ? 4 - box.top : box.bottom > desktop.clientHeight - 4 ? desktop.clientHeight - 4 - box.bottom : 0;
      win.element.style.left = `${win.element.offsetLeft + dx}px`;
      win.element.style.top = `${win.element.offsetTop + dy}px`;
    }
  }

  function setPhysics(win, enabled) {
    win.physics?.stop(); win.physics = null; win.physicsEnabled = enabled;
    if (enabled) {
      try { win.physics = createWindowPhysics(win); }
      catch (error) { win.physicsEnabled = false; notify(error.message); }
    }
    win.element.dataset.physics = String(win.physicsEnabled);
    const button = win.element.querySelector('[data-effect="physics"]');
    if (button) { button.setAttribute('aria-pressed', String(win.physicsEnabled)); button.textContent = win.physicsEnabled ? 'Disable item physics' : 'Enable item physics'; }
  }
  function resetEffects(win) { setPhysics(win, false); setRotation(win, 0); constrainWindow(win); }
  function initWindowEffects(win) {
    win.rotation = 0; win.physicsEnabled = false;
    win.element.addEventListener('input', event => { if (event.target.matches('[data-effect="rotation"]')) setRotation(win, event.target.value); });
    win.element.addEventListener('click', event => {
      const command = event.target.closest('[data-effect]')?.dataset.effect;
      if (command === 'physics') setPhysics(win, !win.physicsEnabled);
      if (command === 'left') setRotation(win, win.rotation - 15);
      if (command === 'right') setRotation(win, win.rotation + 15);
      if (command === 'reset') resetEffects(win);
      if (command === 'about') openAppAbout(win.id);
      const action = event.target.closest('[data-app-command]')?.dataset.appCommand;
      if (action === 'select') {
        const input = win.body.querySelector('textarea,input');
        if (input) { input.focus(); input.select(); }
        else { const range = document.createRange(); range.selectNodeContents(win.body); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); }
      }
      if (action === 'print') window.print();
      if (action === 'check') win.body.querySelector('#check-again')?.click();
      if (action === 'retry-find') initContent(win);
      if (action === 'sound') win.body.querySelector('[name="desktop-sound"]')?.click();
      if (action === 'help' || action === 'whoami' || action === 'clear') win.runCommand?.(action);
    });
    let pending = 0;
    const refresh = () => {
      if (!win.physicsEnabled || pending) return;
      pending = requestAnimationFrame(() => { pending = 0; if (windows.get(win.id) === win && win.physicsEnabled) setPhysics(win, true); });
    };
    win.effectsObserver = new MutationObserver(refresh);
    win.effectsObserver.observe(win.body, { childList: true, subtree: true });
    const menuHeight = () => win.element.style.setProperty('--menu-height', `${Math.max(90, win.element.clientHeight - 55)}px`);
    menuHeight();
    let w = win.body.clientWidth, h = win.body.clientHeight;
    win.effectsResize = new ResizeObserver(() => {
      if (win.element.hidden) return;
      menuHeight();
      if (w !== win.body.clientWidth || h !== win.body.clientHeight) { w = win.body.clientWidth; h = win.body.clientHeight; if (win.rotation) setRotation(win, win.rotation); refresh(); }
    });
    win.effectsResize.observe(win.body);
    win.cleanupEffects = () => { cancelAnimationFrame(pending); win.effectsObserver.disconnect(); win.effectsResize.disconnect(); win.physics?.stop(); };
  }

  // Shared native menu presentation; actions reuse the existing window manager.
  function appMenuBar(id) {
    const menu = (label, content) => `<details class="app-menu"><summary>${label}</summary><div class="menu-popup">${content}</div></details>`;
    const command = (label, value) => `<button type="button" data-app-command="${value}">${label}</button>`;
    let extra = '';
    if (id === 'computer') extra = menu('Go', '<button type="button" data-explorer-go="up">Up one level</button><button type="button" data-explorer-go="back">Back</button>');
    else if (id === 'terminal') extra = menu('Command', command('Command reference', 'help') + command('Who am I?', 'whoami') + command('Clear prompt', 'clear'));
    else if (id === 'nouveau') extra = menu('Browser', command('Check again', 'check'));
    else if (id === 'settings') extra = menu('Display', command('Toggle computer noises', 'sound') + '<button type="button" data-action="beep">Test beep</button>');
    else if (id === 'find') extra = menu('Search', command('Fail again', 'retry-find'));
    else if (id === 'home') extra = menu('Navigate', ['computer','quotes','inactive','readme'].map(app => `<button type="button" data-open="${app}">${apps[app].label}</button>`).join(''));
    else if (editorFiles.has(id) || id === 'note') extra = menu('Edit', command('Select all text', 'select'));
    else if (['quotes','inactive','readme'].includes(id)) extra = menu('Document', command('Select all', 'select') + command('Print', 'print'));
    const effects = `<hr><button type="button" data-effect="left">Rotate left 15°</button><button type="button" data-effect="right">Rotate right 15°</button><div class="rotation-control"><label for="rotation-${id}">Rotation: <output class="rotation-value">0°</output></label><input id="rotation-${id}" type="range" min="-180" max="180" value="0" data-effect="rotation"></div><button type="button" data-effect="physics" aria-pressed="false">Enable item physics</button><button type="button" data-effect="reset">Reset this window’s effects</button>`;
    return `<nav class="window-toolbar" aria-label="${apps[id].name} menu bar">${
      menu('File', `${editorFiles.has(id) ? '<button type="button" data-fs="save">Save</button><hr>' : ''}${id === 'computer' ? '<button type="button" data-explorer="open" disabled>Open</button><button type="button" data-fs="text">New Text File</button><button type="button" data-fs="folder">New Folder</button><button type="button" data-fs="rename" disabled>Rename</button><button type="button" data-fs="delete" disabled>Delete</button><hr>' : ''}<button type="button" data-open="computer">My Computer</button><button type="button" data-action="close">Close</button>`) +
      menu('View', `${id === 'computer' ? '<button type="button" data-explorer="large" aria-pressed="true">Large Icons</button><button type="button" data-explorer="small" aria-pressed="false">Small Icons</button><hr>' : ''}<button type="button" data-action="maximize">Maximize / Restore</button>`) + extra +
      menu('Window', '<button type="button" data-action="minimize">Minimize</button><button type="button" data-action="show-desktop">Show Desktop</button>' + effects) +
      menu('Help', `<button type="button" data-effect="about">About ${apps[id].name}</button>`)
    }</nav>`;
  }

  function initMenus(win) {
    const menus = [...win.element.querySelectorAll(".app-menu")];
    for (const menu of menus) {
      menu.querySelector("summary").addEventListener("click", () => {
        for (const other of menus) if (other !== menu) other.open = false;
      });
      menu.addEventListener("focusout", (event) => {
        if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
      });
      menu.addEventListener("keydown", (event) => {
        if (event.target.matches("input,textarea,select") && event.key !== "Escape") return;
        const items = [...menu.querySelectorAll("button:not(:disabled)")];
        const index = items.indexOf(document.activeElement);
        if (event.key === "Escape") { menu.open = false; menu.querySelector("summary").focus(); }
        else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault(); menu.open = true;
          const next = index < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1) : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        } else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault(); menu.open = false;
          const next = menus[(menus.indexOf(menu) + (event.key === "ArrowRight" ? 1 : -1) + menus.length) % menus.length];
          next.open = true; next.querySelector("summary").focus();
        }
      });
    }
  }

  async function openDiskEntry(id) {
    const entry = filesystem.node(id);
    if (!entry) return;
    if (entry.mount === 'commons') return openApp('commons');
    if (entry.type === 'app') {
      if (entry.app === 'computer' && entry.parent === 'stuff') { window.open('https://www.imdb.com/title/tt1375666/', '_blank', 'noopener,noreferrer'); return; }
      return openApp(entry.app);
    }
    if (entry.type === 'folder') {
      await openApp('computer');
      const win = windows.get('computer');
      if (win) { focusWindow(win); win.navigate(id); }
      return;
    }
    const appId = `file-${id}`;
    editorFiles.set(appId, id);
    apps[appId] = { name: entry.name, label: entry.name, icon: 'quotes', path: filesystem.path(id), width: 600, height: 430, status: entry.locked ? 'Read-only' : 'Text document' };
    openApp(appId);
  }

  function requestFileChange(mode, type = 'text', nodeId = null) {
    const pending = windows.get('file-dialog');
    if (pending?.saving) { focusWindow(pending, true); notify('Please wait for the disk operation to finish.'); return; }
    const explorer = windows.get('computer');
    fileRequest = { mode, type, parent: explorer.folder, nodeId };
    openApp('file-dialog');
  }

  function initFileDialog(win) {
    const form = win.body.querySelector('form');
    const input = form.querySelector('input');
    const error = form.querySelector('[role="alert"]');
    const request = { ...fileRequest };
    form.querySelector('label').textContent = request.mode === 'rename' ? 'New name:' : request.type === 'folder' ? 'Folder name:' : 'File name:';
    input.value = request.mode === 'rename' ? filesystem.node(request.nodeId).name : request.type === 'folder' ? 'New Folder' : 'New Text Document.txt';
    error.textContent = '';
    form.onsubmit = async event => {
      event.preventDefault(); error.textContent = '';
      const button = form.querySelector('[type="submit"]'); button.disabled = true; win.saving = true;
      try {
        if (request.mode === 'rename') await filesystem.rename(request.nodeId, input.value);
        else await filesystem.create(request.parent, input.value, request.type);
        win.saving = false;
        if (windows.get(win.id) === win) closeWindow(win);
      } catch (failure) { error.textContent = failure.message; }
      finally { win.saving = false; button.disabled = false; }
    };
    // Wait until the ordinary app focus handling has completed.
    requestAnimationFrame(() => { if (activeId === win.id) { input.focus(); input.select(); } });
  }

  function initFileEditor(win) {
    const id = editorFiles.get(win.id);
    const entry = filesystem.node(id);
    const input = win.body.querySelector('textarea');
    const saveButtons = [...win.element.querySelectorAll('[data-fs="save"]')];
    input.value = entry.content; input.readOnly = entry.locked;
    input.setAttribute('aria-label', entry.name);
    const setStatus = message => { win.element.querySelector('.window-status span').textContent = message; };
    const dirty = value => { win.dirty = value; for (const button of saveButtons) button.disabled = entry.locked || !value; };
    dirty(false);
    input.addEventListener('input', () => { dirty(input.value !== win.savedText); setStatus(win.dirty ? 'Unsaved changes' : entry.locked ? 'Read-only' : 'No unsaved changes'); });
    win.savedText = input.value;
    const save = async () => {
      if (entry.locked || !win.dirty || win.saving) return;
      const content = input.value; win.saving = true; setStatus('Saving…');
      try {
        await filesystem.write(id, content, win.savedText);
        win.savedText = content; dirty(input.value !== content);
        setStatus(win.dirty ? 'Unsaved changes' : filesystem.persistent ? 'Saved to C:' : 'Saved for this session only');
      } catch (error) { setStatus('Not saved — ' + error.message); notify(error.message); }
      finally { win.saving = false; }
    };
    for (const button of saveButtons) button.addEventListener('click', save);
    input.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); } });
    setStatus(entry.locked ? 'Read-only system file' : 'No unsaved changes');
  }

  async function deleteDiskEntry(id) {
    const entry = filesystem.node(id);
    if (!entry || entry.locked) { notify('Protected system items cannot be deleted.'); return; }
    const ids = new Set([id]);
    const collect = parent => { for (const n of filesystem.list(parent)) { ids.add(n.id); if (n.type === 'folder') collect(n.id); } };
    if (entry.type === 'folder') collect(id);
    for (const [appId, nodeId] of editorFiles) {
      const editor = windows.get(appId);
      if (ids.has(nodeId) && editor && (editor.dirty || editor.saving)) { notify('Save or close the open edits before deleting this item.'); focusWindow(editor, true); return; }
    }
    if (!window.confirm(`Delete "${entry.name}"${ids.size > 1 ? ` and its ${ids.size - 1} contents` : ''} permanently from the virtual disk?`)) return;
    try { await filesystem.remove(id); }
    catch (error) { notify(error.message); }
  }

  function explorerContext(win, select) {
    const popup = document.createElement('div');
    popup.className = 'menu-popup explorer-context-menu'; popup.setAttribute('role', 'menu'); popup.setAttribute('aria-label', 'File Explorer context menu'); popup.hidden = true;
    document.body.append(popup);
    let target = win.body, nodeId = null;
    const close = restore => { popup.hidden = true; if (restore && target.isConnected) target.focus({preventScroll:true}); };
    const open = (event, element, x, y) => {
      event.preventDefault(); event.stopPropagation(); closeContextMenu();
      const file = element.closest('.app-file'); target = file || win.body; nodeId = file?.dataset.node || null;
      const entry = filesystem.node(nodeId); if (entry) select(nodeId);
      popup.innerHTML = entry
        ? `<button type="button" role="menuitem" data-file-context="open">Open</button><button type="button" role="menuitem" data-file-context="rename" ${entry.locked ? 'disabled' : ''}>Rename</button><hr><button type="button" role="menuitem" data-file-context="delete" ${entry.locked ? 'disabled title="Protected system item"' : ''}>Delete</button>`
        : '<button type="button" role="menuitem" data-file-context="folder">New Folder</button><button type="button" role="menuitem" data-file-context="text">New Text File</button>';
      popup.hidden = false;
      popup.style.left = `${Math.max(4, Math.min(x, innerWidth - popup.offsetWidth - 4))}px`;
      popup.style.top = `${Math.max(4, Math.min(y, innerHeight - popup.offsetHeight - 4))}px`;
      popup.querySelector('button:not(:disabled)').focus({preventScroll:true});
    };
    const rightClick = event => {
      if (event.target !== win.body && !event.target.closest('.computer-content')) return;
      const rect = event.target.getBoundingClientRect();
      open(event, event.target, event.clientX || rect.left + 4, event.clientY || rect.bottom);
    };
    const key = event => {
      if (event.target !== win.body && !event.target.closest('.computer-content')) return;
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { const rect = event.target.getBoundingClientRect(); open(event,event.target,rect.left+4,rect.bottom); }
    };
    win.body.addEventListener('contextmenu', rightClick); win.body.addEventListener('keydown',key);
    popup.addEventListener('click',event=>{
      const action=event.target.closest('[data-file-context]')?.dataset.fileContext; if (!action) return;
      const id=nodeId;close(true);
      if(action==='open') openDiskEntry(id);
      if(action==='rename') requestFileChange('rename',null,id);
      if(action==='delete') deleteDiskEntry(id);
      if(action==='folder'||action==='text') requestFileChange('create',action);
    });
    popup.addEventListener('keydown',event=>{
      const items=[...popup.querySelectorAll('button:not(:disabled)')]; const index=items.indexOf(document.activeElement);
      if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)) {event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}
      if(event.key==='Escape'||event.key==='Tab'){close(true);if(event.key==='Escape')event.preventDefault();}
    });
    const outside=event=>{if(!popup.contains(event.target))close(false)};
    const dismiss=()=>close(false);
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',dismiss);window.addEventListener('blur',dismiss);
    win.closeContext = dismiss;
    win.cleanupContext=()=>{popup.remove();document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',dismiss);window.removeEventListener('blur',dismiss)};
  }

  function initExplorer(win) {
    const grid = win.body.querySelector('.app-grid');
    const openButton = win.element.querySelector('[data-explorer="open"]');
    const renameButton = win.element.querySelector('[data-fs="rename"]');
    const address = win.element.querySelector('.disk-address');
    const back = win.element.querySelector('[data-fs="back"]');
    const up = win.element.querySelector('[data-fs="up"]');
    const history = [];
    let selected = null;
    win.folder = 'stuff';
    const status = message => { win.element.querySelector('.window-status span').textContent = message; };
    const select = id => {
      selected = id;
      const files = [...grid.children];
      for (const file of files) {
        file.classList.toggle('is-selected', file.dataset.node === id);
        file.setAttribute('aria-selected', String(file.dataset.node === id));
        file.tabIndex = file.dataset.node === id || (!id && file === files[0]) ? 0 : -1;
      }
      const entry = filesystem.node(id);
      openButton.disabled = !entry; renameButton.disabled = !entry || entry.locked;
      win.element.querySelector('[data-fs="delete"]').disabled = !entry || entry.locked;
      status(entry ? `${entry.name} · 1 object selected` : `${files.length} objects`);
    };
    const render = () => {
      const physics = win.physicsEnabled;
      win.physics?.stop(); win.physics = null;
      win.closeContext?.();
      if (!filesystem.node(win.folder)) win.folder = 'stuff';
      for (let i = history.length - 1; i >= 0; i--) if (!filesystem.node(history[i])) history.splice(i, 1);
      grid.replaceChildren();
      const entries = filesystem.list(win.folder);
      for (const entry of entries) {
        let file;
        if (entry.type === 'app') {
          const holder = document.createElement('div'); holder.innerHTML = appLink(entry.app, 'app-file'); file = holder.firstElementChild;
        } else { file = document.createElement('button'); file.type = 'button'; file.className = 'app-file'; file.innerHTML = icon(entry.type === 'folder' ? 'folder' : 'quotes') + '<span></span>'; }
        file.querySelector('span').textContent = entry.name;
        file.dataset.node = entry.id; file.setAttribute('role', 'option');
        grid.append(file);
      }
      address.value = filesystem.path(win.folder);
      up.disabled = win.folder === 'root'; back.disabled = history.length === 0;
      win.element.querySelector('[data-explorer-go="up"]').disabled = up.disabled;
      win.element.querySelector('[data-explorer-go="back"]').disabled = back.disabled;
      win.body.querySelector('.disk-notice').textContent = filesystem.warning || 'Files are stored in this browser on this device.';
      select(entries.some(n => n.id === selected) ? selected : null);
      if (physics) setPhysics(win, true);
    };
    win.navigate = (id, remember = true) => {
      if (filesystem.node(id)?.type !== 'folder') return;
      if (filesystem.node(id).mount === 'commons') { address.value = filesystem.path(win.folder); openDiskEntry(id); return; }
      if (remember && id !== win.folder) history.push(win.folder);
      win.folder = id; selected = null; render();
      (grid.querySelector('.app-file') || win.body).focus({ preventScroll: true });
    };
    const open = id => openDiskEntry(id);
    grid.addEventListener('click', event => {
      const file = event.target.closest('.app-file');
      if (!file) { select(null); return; }
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); select(file.dataset.node);
      if (event.pointerType === 'touch') open(selected);
    });
    grid.addEventListener('dblclick', event => { const file = event.target.closest('.app-file'); if (file) { event.preventDefault(); open(file.dataset.node); } });
    grid.addEventListener('keydown', event => {
      const file = event.target.closest('.app-file'); if (!file) return;
      if (event.key === 'Delete') { event.preventDefault(); deleteDiskEntry(file.dataset.node); return; }
      const files = [...grid.children]; const index = files.indexOf(file);
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
      if (Object.hasOwn(offsets, event.key) || ['Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const i = event.key === 'Home' ? 0 : event.key === 'End' ? files.length - 1 : Math.max(0, Math.min(files.length - 1, index + offsets[event.key]));
        select(files[i].dataset.node); files[i].focus();
      } else if (event.key === 'Enter') { event.preventDefault(); open(file.dataset.node); }
      else if (event.key === ' ') { event.preventDefault(); select(file.dataset.node); }
    });
    win.body.addEventListener('click', event => { if (!event.target.closest('.app-file')) select(null); });
    for (const button of win.element.querySelectorAll('[data-explorer]')) button.addEventListener('click', () => {
      if (button.dataset.explorer === 'open') { if (selected) open(selected); }
      else {
        const small = button.dataset.explorer === 'small'; grid.classList.toggle('small-icons', small);
        win.element.querySelector('[data-explorer="large"]').setAttribute('aria-pressed', String(!small));
        win.element.querySelector('[data-explorer="small"]').setAttribute('aria-pressed', String(small));
      }
    });
    for (const button of win.element.querySelectorAll('[data-fs]')) button.addEventListener('click', () => {
      const action = button.dataset.fs;
      if (action === 'up') win.navigate(filesystem.node(win.folder).parent);
      if (action === 'back' && history.length) win.navigate(history.pop(), false);
      if (action === 'folder' || action === 'text') requestFileChange('create', action);
      if (action === 'delete' && selected) deleteDiskEntry(selected);
      if (action === 'rename' && selected && !filesystem.node(selected).locked) requestFileChange('rename', null, selected);
    });
    win.element.querySelector('.address-bar').addEventListener('submit', event => {
      event.preventDefault(); const id = filesystem.resolve(address.value, win.folder);
      if (id && filesystem.node(id).type === 'folder') win.navigate(id);
      else { notify('Folder not found. Even Find would struggle with that one.'); address.value = filesystem.path(win.folder); }
    });
    for (const button of win.element.querySelectorAll('[data-explorer-go]')) button.addEventListener('click', () => {
      if (button.dataset.explorerGo === 'up' && win.folder !== 'root') win.navigate(filesystem.node(win.folder).parent);
      if (button.dataset.explorerGo === 'back' && history.length) win.navigate(history.pop(), false);
    });
    explorerContext(win, select);
    win.unsubscribe = filesystem.subscribe(render);
    render();
  }

  function makeWindow(id, focus) {
    const app = apps[id];
    const el = document.createElement("section");
    el.className = `window os-window${id === "note" ? " note-window" : ""}`;
    el.id = `window-${id}`;
    el.setAttribute("aria-labelledby", `title-${id}`);
    const width = Math.min(app.width, desktop.clientWidth - 24);
    const height = Math.min(app.height, desktop.clientHeight - 96);
    const offset = (windows.size % 5) * 26;
    const homeLeft = Math.max(104, Math.round((desktop.clientWidth - 940) / 2));
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.left = `${id === "home" ? homeLeft : id === "note" ? desktop.clientWidth - width - 40 : homeLeft + 54 + offset}px`;
    el.style.top = `${id === "home" ? 48 : id === "note" ? 64 : 64 + offset}px`;
    el.innerHTML = `
      <header class="title-bar window-titlebar" tabindex="0" aria-label="${app.name} title bar. Drag or use arrow keys to move; double-click to maximize.">
        ${icon(app.icon)}<h2 class="title-bar-text window-title" id="title-${id}">${app.name}</h2>
        <div class="title-bar-controls window-controls">
          <button class="window-control minimize" type="button" data-action="minimize" aria-label="Minimize ${app.name}" title="Minimize window"></button>
          <button class="window-control maximize" type="button" data-action="maximize" aria-label="Maximize ${app.name}" title="Maximize window"></button>
          <button class="window-control close" type="button" data-action="close" aria-label="Close ${app.name}" title="Close window"></button>
        </div>
      </header>
      ${appMenuBar(id)}
      ${id === "computer" ? `<div class="explorer-tools"><button type="button" data-fs="back">Back</button><button type="button" data-fs="up">Up</button><button type="button" data-fs="folder">New Folder</button><button type="button" data-fs="text">New File</button></div><form class="address-bar"><label for="disk-address">Address</label><input id="disk-address" class="disk-address" type="text" spellcheck="false" autocomplete="off"><button type="submit">Go</button></form>` : ""}
      <div class="window-body" tabindex="-1"><div class="app-content"><p>opening file…</p></div></div>
      ${id !== "note" ? `<footer class="window-status"><span>${app.status}</span><span>beep8.xyz</span></footer>` : ""}`;

    const task = document.createElement("button");
    task.type = "button";
    task.className = "task-button";
    task.setAttribute("aria-label", `Switch to ${app.name}`);
    task.setAttribute("aria-controls", el.id);
    task.setAttribute("aria-pressed", "false");
    task.innerHTML = `${icon(app.icon)}<span>${app.name}</span>`;
    const win = { id, element: el, body: el.querySelector(".window-body"), task };
    windows.set(id, win);
    desktop.append(el);
    taskButtons.append(task);
    task.addEventListener("click", () => {
      if (activeId === id && !el.hidden) minimizeWindow(win);
      else focusWindow(win, true);
    });
    el.addEventListener("pointerdown", () => focusWindow(win));
    el.addEventListener("focusin", () => {
      if (activeId !== id) focusWindow(win);
    });

    const titlebar = el.querySelector(".window-titlebar");
    titlebar.addEventListener("dblclick", (event) => { if (!event.target.closest("button")) toggleMaximize(win); });
    titlebar.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button") || el.classList.contains("is-maximized") || window.innerWidth <= 640) return;
      const left = el.offsetLeft;
      const top = el.offsetTop;
      const x = event.clientX;
      const y = event.clientY;
      titlebar.setPointerCapture(event.pointerId);
      titlebar.focus({ preventScroll: true });
      const move = (e) => {
        el.style.left = `${Math.max(6, Math.min(left + e.clientX - x, desktop.clientWidth - el.offsetWidth - 6))}px`;
        el.style.top = `${Math.max(6, Math.min(top + e.clientY - y, desktop.clientHeight - el.offsetHeight - 6))}px`;
      };
      const end = () => { titlebar.removeEventListener("pointermove", move); };
      titlebar.addEventListener("pointermove", move);
      titlebar.addEventListener("lostpointercapture", end, { once: true });
    });
    titlebar.addEventListener("keydown", (event) => {
      if (event.target !== titlebar || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      if (el.classList.contains("is-maximized") || window.innerWidth <= 640) return;
      event.preventDefault();
      const step = event.shiftKey ? 30 : 10;
      el.style.left = `${el.offsetLeft + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0)}px`;
      el.style.top = `${el.offsetTop + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0)}px`;
      constrainWindow(win);
    });
    if ("ResizeObserver" in window) {
      win.observer = new ResizeObserver(() => constrainWindow(win));
      win.observer.observe(el);
    }
    initMenus(win);
    initWindowEffects(win);
    constrainWindow(win);
    if (focus) focusWindow(win);
    else el.style.zIndex = ++topLayer;
    return win;
  }

  async function loadTemplate(id) {
    if (templates.has(id)) return templates.get(id);
    if (!loading.has(id)) {
      loading.set(id, (async () => {
        const response = await fetch(asset(apps[id].file), { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (id === "readme") {
          const text = document.createElement("pre");
          text.textContent = await response.text();
          const template = { html: text.outerHTML, className: "app-content readme-content" };
          templates.set(id, template);
          return template;
        }
        const doc = new DOMParser().parseFromString(await response.text(), "text/html");
        const content = doc.querySelector("#page-content");
        if (!content || content.dataset.app !== id) throw new Error("File not found");
        // Resolve paths relative to the fetched page, including the nested Nouveau checker.
        for (const node of content.querySelectorAll("[href], [src]")) {
          for (const attr of ["href", "src"]) {
            const value = node.getAttribute(attr);
            if (value && !value.startsWith("#")) node.setAttribute(attr, new URL(value, asset(apps[id].file)).href);
          }
        }
        const template = { html: content.innerHTML, className: content.className };
        templates.set(id, template);
        return template;
      })().finally(() => loading.delete(id)));
    }
    return loading.get(id);
  }

  function builtInContent(id) {
    if (aboutTargets.has(id)) return { className: 'app-content about-content app-about-content', html: `${icon('beep')}<h1></h1><p class="app-about-description"></p><dl class="about-specs"><div><dt>Version</dt><dd>beepOS 1.1</dd></div><div><dt>Lives at</dt><dd class="app-about-path"></dd></div></dl><button type="button" data-action="close">OK</button>` };
    if (editorFiles.has(id)) return { className: "app-content file-editor", html: '<div class="editor-tools"><button type="button" data-fs="save">Save</button><span>Ctrl+S to save</span></div><textarea spellcheck="false" maxlength="262144"></textarea>' };
    switch (id) {
      case "commons": return { className: "app-content commons-content", html: "<p>Connecting to Wikimedia Commons…</p>" };
      case "file-dialog":
        return { className: "app-content file-dialog-content", html: '<form><label for="new-file-name">Name:</label><input id="new-file-name" name="filename" type="text" maxlength="120" required autocomplete="off"><p role="alert"></p><button type="submit">OK</button> <button type="button" data-action="close">Cancel</button></form>' };
      case "properties":
        return { className: "app-content properties-content", html: `${icon("settings")}<h1 id="properties-name"></h1><dl class="about-specs"><div><dt>Type</dt><dd id="properties-type"></dd></div><div><dt>Location</dt><dd id="properties-location">Desktop</dd></div><div><dt>Target</dt><dd id="properties-target"></dd></div></dl><button class="retro-button" type="button" data-action="close">OK</button>` };
      case "find":
        return { className: "app-content error-content", html: `${icon("offline", "error-icon")}<p id="find-message"></p><button class="retro-button" type="button" data-action="close">OK</button>` };
      case "computer":
        return { className: "app-content computer-content", html: '<p class="disk-notice" role="status"></p><div class="app-grid" role="listbox" aria-label="Files in My Computer"></div>' };
      case "note":
        return { className: "app-content note-content", html: `<div class="note-kicker"><span>NOTE TO SELF</span><span>001</span></div><label for="sticky-note" class="sr-only">Your sticky note</label><textarea id="sticky-note" maxlength="2000" spellcheck="false"></textarea><p class="note-save" role="status">editable · saves on this computer</p>` };
      case "settings":
        return { className: "app-content settings-content", html: `<p class="eyebrow">make it yours</p><h1>Display properties<span class="accent">.</span></h1><p>same little OS. different little mood.</p><fieldset><legend>Desktop colour</legend><div class="theme-options">${Object.entries(themes).map(([id, colors]) => `<div class="theme-option"><span class="theme-swatch" style="background:${colors[0]}">${icon("computer")}</span><div class="field-row"><input id="theme-${id}" type="radio" name="desktop-theme" value="${id}" ${theme === id ? "checked" : ""}><label for="theme-${id}">${id}</label></div></div>`).join("")}</div></fieldset><fieldset><legend>The little details</legend><div class="field-row setting-check"><input id="wallpaper-dots" type="checkbox" name="wallpaper-dots" ${plainWallpaper ? "" : "checked"}><label for="wallpaper-dots">Dotted wallpaper</label></div><div class="field-row setting-check"><input id="desktop-sound" type="checkbox" name="desktop-sound" ${soundEnabled ? "checked" : ""}><label for="desktop-sound">Tiny computer noises</label></div></fieldset><p class="settings-note">Changes apply immediately and stay on this browser.<br>No restart required. What a concept.</p>` };
      case "about":
        return { className: "app-content about-content", html: `${icon("beep")}<p class="eyebrow">welcome to your very personal computer</p><h1>beepOS</h1><p>an operating system for my corner of the internet.<br>just a page for me and my crap, with more windows.</p><dl class="about-specs"><div><dt>Version</dt><dd>1.1 / personal edition</dd></div><div><dt>System requirements</dt><dd>a browser &amp; curiosity</dd></div><div><dt>Available storage</dt><dd>enough for my crap</dd></div><div><dt>Powered by</dt><dd>HTML, CSS &amp; JavaScript</dd></div></dl><p>Inspired by the wonderfully weird web desktops of<br><a href="https://www.windows93.net/">Windows 93</a> &amp; <a href="https://windows96.net/">Windows 96</a>.</p><button class="retro-button" type="button" data-action="beep">beep!</button>` };
      case "terminal":
        return { className: "app-content terminal-content", html: `<p>beepOS [version 1.1]\n(c) beep8.xyz. all beeps reserved.</p><p class="terminal-dim">Type 'help' for a list of commands.\nThis is a toy terminal. Go on, poke it.</p><div class="terminal-output" role="log" aria-label="Command output" aria-live="polite"></div><form autocomplete="off"><label for="terminal-command">C:\\beepOS&gt;</label><input id="terminal-command" name="command" aria-label="Terminal command" spellcheck="false" autocapitalize="off" maxlength="200"></form>` };
      default: return null;
    }
  }

  function checkNouveau(root) {
    let detected = false;
    try {
      detected = Array.isArray(window.nouveau?.features) && window.nouveau.features.includes("browser-detection");
    } catch { /* A browser can refuse access to its API. Treat it as unavailable. */ }
    root.querySelector("#result").className = `result ${detected ? "success" : "failure"}`;
    root.querySelector("#status-icon").textContent = detected ? "✓" : "✕";
    root.querySelector("#status-title").textContent = detected ? "Yes! NouveauBrowser detected." : "NouveauBrowser not detected.";
    root.querySelector("#status-description").textContent = detected
      ? "Your browser exposes the NouveauBrowser detection API. You're ready to explore Nouveau-enabled websites!"
      : "Your current browser doesn't appear to support the NouveauBrowser API. You can still browse ordinary websites, but Nouveau-specific features may not work.";
  }

  function initContent(win) {
    const root = win.body;
    if (win.id === 'commons') import(asset('commons.js')).then(({mountCommons})=>{if(windows.get(win.id)===win)win.cleanupCommons=mountCommons(root.querySelector('.commons-content'))}).catch(()=>{if(windows.get(win.id)===win)root.textContent='Could not load the Commons browser. Close and reopen to retry.'});
    if (aboutTargets.has(win.id)) {
      const target = aboutTargets.get(win.id), app = apps[target];
      root.querySelector('h1').textContent = app.name;
      root.querySelector('.app-about-description').textContent = appDescriptions[target] || (editorFiles.has(target) ? 'Text Editor: a small place to write, save and lose absolutely no plot.' : 'Part of your very personal operating system.');
      root.querySelector('.app-about-path').textContent = editorFiles.has(target) ? filesystem.path(editorFiles.get(target)) : filesystem.path(`app-${target}`) || app.path || 'beepOS';
      root.querySelector('svg use').setAttribute('href', `${asset('assets/icons.svg')}#${app.icon}`);
    }
    if (win.id === "file-dialog") initFileDialog(win);
    if (editorFiles.has(win.id)) initFileEditor(win);
    if (win.id === "properties") {
      const app = apps[propertiesTarget];
      root.querySelector("#properties-name").textContent = app.label;
      root.querySelector("#properties-type").textContent = app.file ? "Document shortcut" : "Application shortcut";
      root.querySelector("#properties-location").textContent = filesystem.path("stuff");
      root.querySelector("#properties-target").textContent = filesystem.path(`app-${propertiesTarget}`);
      root.querySelector("svg use").setAttribute("href", `${asset("assets/icons.svg")}#${app.icon}`);
      win.element.setAttribute("role", "dialog");
    }
    if (win.id === "find") {
      const next = lastFindError < 0 ? Math.floor(Math.random() * findErrors.length) : (lastFindError + 1 + Math.floor(Math.random() * (findErrors.length - 1))) % findErrors.length;
      lastFindError = next;
      root.querySelector("#find-message").textContent = findErrors[next];
      win.element.setAttribute("role", "alertdialog");
      win.element.setAttribute("aria-describedby", "find-message");
    }
    if (win.id === "nouveau") {
      checkNouveau(root);
      root.querySelector("#check-again").addEventListener("click", () => checkNouveau(root));
    }
    if (win.id === "note") {
      const note = root.querySelector("textarea");
      note.value = storage.get("note", "remember to make\nsomething just\nfor the fun of it.\n\n— me, probably");
      note.addEventListener("input", () => {
        const saved = storage.set("note", note.value);
        root.querySelector(".note-save").textContent = saved ? "saved on this computer. beep." : "storage unavailable · copy your note to keep it";
      });
    }
    if (win.id === "terminal") initTerminal(win);
    if (win.id === "computer") initExplorer(win);
  }

  async function openApp(id, { focus = true, initial = false } = {}) {
    if (!Object.hasOwn(apps, id)) return;
    closeStart();
    if (windows.has(id)) { if (["find", "properties", "file-dialog"].includes(id)) initContent(windows.get(id)); focusWindow(windows.get(id), !initial); return; }
    const win = makeWindow(id, focus);
    try {
      const content = builtInContent(id) || await loadTemplate(id);
      if (windows.get(id) !== win) return;
      const container = document.createElement("div");
      container.className = content.className;
      container.innerHTML = content.html;
      const physical = win.physicsEnabled; win.physics?.stop();
      win.body.replaceChildren(container);
      initContent(win);
      if (physical) setPhysics(win, true);
      if (focus && !initial && activeId === id) {
        if (id === "terminal") win.body.querySelector("input").focus({ preventScroll: true });
        else win.element.querySelector(".window-titlebar").focus({ preventScroll: true });
      }
      if (!initial) beep();
    } catch {
      if (windows.get(id) !== win) return;
      win.body.innerHTML = `<div class="app-content document-content"><p class="eyebrow">file could not be opened</p><h1>the file got away.</h1><p>Couldn't load this page. Check your connection and try again.</p><button class="retro-button" type="button" data-retry="${id}">Try again</button> <a href="${asset(apps[id].file)}" data-direct>Open page directly ↗</a></div>`;
    }
  }

  function initTerminal(win) {
    const form = win.body.querySelector("form");
    const input = form.querySelector("input");
    const output = win.body.querySelector(".terminal-output");
    const history = [];
    let historyIndex = 0;
    let cwd = 'stuff';
    const argument = raw => raw.replace(/^\S+\s*/, '').replace(/^"(.*)"$/, '$1');
    const updatePrompt = () => { form.querySelector('label').textContent = filesystem.path(cwd) + '>'; };
    updatePrompt();
    win.runCommand = command => { if (input.disabled) return; const draft = input.value; input.value = command; form.requestSubmit(); input.value = draft; };
    const print = (message, dim = false) => {
      const p = document.createElement("p");
      p.textContent = message;
      if (dim) p.className = "terminal-dim";
      output.append(p);
      // Keep a long terminal session from growing forever.
      while (output.childElementCount > 150) output.firstElementChild.remove();
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const raw = input.value.trim();
      if (!raw) return;
      input.value = "";
      history.push(raw);
      historyIndex = history.length;
      print(`${filesystem.path(cwd)}> ${raw}`, true);
      const [command, ...args] = raw.toLowerCase().split(/\s+/);
      // Match text only. These eggs never execute commands or change stored data.
      const prank = raw.toLowerCase().replace(/^sudo\s+/, "");
      let roast = null;
      if (/^rm\b/.test(prank)) roast = "rm: permission denied by the Department of Keeping My Crap.\nYou brought a flamethrower to a website. Sit down.";
      else if (/^mkfs(?:\.\w+)?\b/.test(prank)) roast = "mkfs: found 0 disks and 1 questionable decision.\nTry formatting your priorities.";
      else if (/^dd\b/.test(prank)) roast = "dd: 0 bytes copied, 1 disaster averted.\nThe disk is imaginary. Your confidence is concerning.";
      else if (/^chmod\b.*\b777\b/.test(prank)) roast = "chmod: absolutely not.\nYou cannot give the entire internet a spare key to my house.";
      else if (/^(?:shutdown|reboot|poweroff|halt)\b/.test(prank)) roast = "Power management says no.\nYou may close the tab like a normal person.";
      else if (/^:\(\)\s*\{/.test(prank)) roast = "Fork bomb detected.\nThis is a toaster, not an all-you-can-fork buffet.";
      else if (/^(?:curl|wget)\b.*\|\s*(?:sudo\s+)?(?:ba)?sh\b/.test(prank)) roast = "Download mystery script, pipe directly into regret?\nBold strategy. The imaginary security department has eaten the pipe.";
      else if (/^(?:kill|killall|pkill)\b/.test(prank)) roast = "No processes were harmed in the making of this tantrum.\nThe only thing getting terminated is your villain arc.";
      else if (/^(?:>|cat\b.*>|echo\b.*>)\s*\/dev\/sd/.test(prank)) roast = "That disk does not exist.\nYou are threatening a drawing of a computer.";
      if (roast) {
        print(roast);
        win.body.scrollTop = win.body.scrollHeight;
        return;
      }
      input.disabled = true;
      try {
      switch (command) {
        case "help": print("help          you are here\nls / dir      list your files\nopen <app>    open an app or file (try 'open quotes')\ncd <folder>   change directory (.. goes up)\npwd           show your location\nmkdir <name>  create a folder\ntouch <name>  create a text file\ncat <file>    read a text file\nbeep          do the thing\ndate          check the time\nwhoami        meet the person behind beepOS\necho <text>   say something into the void\nclear / cls   tidy up\nexit          close the prompt"); break;
        case "ls": case "dir": {
          const id = argument(raw) ? filesystem.resolve(argument(raw), cwd) : cwd;
          if (!id || filesystem.node(id).type !== 'folder') print('Folder not found.');
          else print(filesystem.list(id).map(n => `${n.type === 'folder' ? '[DIR] ' : '      '}${n.name}`).join('\n') || '(empty folder. suspiciously tidy.)');
          break;
        }
        case "pwd": print(filesystem.path(cwd)); break;
        case "cd": {
          const id = argument(raw) ? filesystem.resolve(argument(raw), cwd) : 'stuff';
          if (!id || filesystem.node(id).type !== 'folder') print('Folder not found.');
          else { cwd = id; updatePrompt(); }
          break;
        }
        case "mkdir": case "touch": {
          const value = argument(raw).replaceAll('/', '\\');
          const split = value.lastIndexOf('\\');
          const parent = split < 0 ? cwd : filesystem.resolve(value.slice(0, split + 1), cwd);
          const name = value.slice(split + 1);
          await filesystem.create(parent, name, command === 'mkdir' ? 'folder' : 'text');
          print(filesystem.persistent ? 'Created on C:.' : 'Created for this session only.');
          break;
        }
        case "cat": {
          const entry = filesystem.node(filesystem.resolve(argument(raw), cwd));
          print(entry?.type === 'text' ? entry.content || '(empty file)' : 'Not a text file. Try open for application shortcuts.');
          break;
        }
        case "open": {
          const aliases = { welcome: "home", "quotes.txt": "quotes", accounts: "inactive", display: "settings", "readme.md": "readme" };
          const id = args.length === 1 ? aliases[args[0]] || args[0] : null;
          if (id && Object.hasOwn(apps, id) && !["notfound", "file-dialog"].includes(id)) { print(`Opening ${apps[id].name}…`); openApp(id); }
          else {
            const nodeId = filesystem.resolve(argument(raw), cwd);
            if (nodeId) openDiskEntry(nodeId);
            else print("File not found. Try 'ls' to see what's here.");
          }
          break;
        }
        case "beep": print(beep(true) ? "beep! :3" : "beep! (audio isn't available in this browser)"); break;
        case "date": print(new Date().toLocaleString()); break;
        case "whoami": print("Bug Hayes — a penname, not my real name, for privacy.\n17M, gay, and a protogen :3\nI'm a vibecoder who also makes Geometry Dash levels and stories.\nI generally like discovering new hobbies. apparently one hobby wasn't enough."); break;
        case "echo": print(raw.slice(command.length).trimStart() || "…the void says nothing back."); break;
        case "clear": case "cls": output.replaceChildren(); break;
        case "exit": closeWindow(win); return;
        case "sudo": print("nice try. you are already the administrator of this nonsense."); break;
        default: print(`Unknown command: ${command}. Type 'help' for a list.`);
      }
      } catch (error) { print(error.message); }
      finally { input.disabled = false; if (activeId === win.id) input.focus({ preventScroll: true }); }
      win.body.scrollTop = win.body.scrollHeight;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === "ArrowUp" ? -1 : 1)));
      input.value = history[historyIndex] || "";
    });
  }

  // One navigation handler keeps native links useful without JavaScript or with a modifier key.
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target.closest("a, button");
    if (!target) return;
    if (target.tagName === "A" && (target.getAttribute("href")?.startsWith("#") || target.hasAttribute("download") || (target.target && target.target !== "_self"))) return;
    target.closest(".app-menu")?.removeAttribute("open");
    let id = target.dataset.open;
    if (!id && target.tagName === "A" && !target.hasAttribute("data-direct")) {
      const url = new URL(target.href, location.href);
      if (url.origin === base.origin) {
        id = Object.entries(apps).find(([, app]) => app.file && new URL(app.file, base).pathname === url.pathname)?.[0];
        if (!id && url.pathname === base.pathname) id = "home";
      }
    }
    if (id) { event.preventDefault(); openApp(id); return; }
    if (target.dataset.retry) {
      const retryId = target.dataset.retry;
      closeWindow(windows.get(retryId));
      openApp(retryId);
      return;
    }
    const action = target.dataset.action;
    const win = windows.get(target.closest(".os-window")?.id.replace("window-", ""));
    if (action === "close" && win) closeWindow(win);
    if (action === "minimize" && win) minimizeWindow(win);
    if (action === "maximize" && win) toggleMaximize(win);
    if (action === "show-desktop") showDesktop();
    if (action === "reset-effects") { for (const item of windows.values()) resetEffects(item); closeStart(); }
    if (action === "beep") notify(beep(true) ? "beep! a very important system operation." : "beep! audio isn't available in this browser.");
    if (action === "sound") {
      soundEnabled = !soundEnabled;
      storage.set("sound", soundEnabled ? "on" : "off");
      target.setAttribute("aria-pressed", String(soundEnabled));
      const checkbox = windows.get("settings")?.body.querySelector('[name="desktop-sound"]');
      if (checkbox) checkbox.checked = soundEnabled;
      if (soundEnabled) beep();
      notify(`tiny computer noises: ${soundEnabled ? "on" : "off"}`);
    }
  });

  startButton.addEventListener("click", () => {
    const opening = startMenu.hidden;
    startMenu.hidden = !opening;
    startButton.setAttribute("aria-expanded", String(opening));
    if (opening) startMenu.querySelector(".start-item").focus();
  });
  document.addEventListener("pointerdown", (event) => {
    for (const menu of document.querySelectorAll(".app-menu[open]")) if (!menu.contains(event.target)) menu.open = false;
    if (!startMenu.hidden && !startMenu.contains(event.target) && !startButton.contains(event.target)) closeStart();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { closeStart(!startMenu.hidden); toast.hidden = true; }
  });
  startMenu.addEventListener("keydown", (event) => {
    const items = [...startMenu.querySelectorAll(".start-item")];
    const index = items.indexOf(document.activeElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    }
  });
  document.addEventListener("change", (event) => {
    const input = event.target;
    if (input.name === "desktop-theme" && Object.hasOwn(themes, input.value)) { theme = input.value; storage.set("theme", theme); applyDisplay(); }
    if (input.name === "wallpaper-dots") { plainWallpaper = !input.checked; storage.set("wallpaper", plainWallpaper ? "plain" : "dots"); applyDisplay(); }
    if (input.name === "desktop-sound") {
      soundEnabled = input.checked;
      storage.set("sound", soundEnabled ? "on" : "off");
      taskbar.querySelector('[data-action="sound"]').setAttribute("aria-pressed", String(soundEnabled));
      if (soundEnabled) beep();
    }
  });
  window.addEventListener("resize", () => { for (const win of windows.values()) constrainWindow(win); });

  document.addEventListener('visibilitychange', () => { for (const win of windows.values()) { if (document.hidden) win.physics?.pause(); else win.physics?.resume(); } });
  window.addEventListener('beforeunload', event => {
    if ([...windows.values()].some(win => win.dirty || win.saving)) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('focus', () => filesystem?.refresh().catch(() => {}));
  async function boot() {
    const screen = document.createElement('section');
    screen.className = 'boot-screen'; screen.setAttribute('aria-label', 'Starting beepOS');
    screen.innerHTML = `${pixelLogo()}<h1>beepOS 1.1</h1><p>PERSONAL EDITION · THE GRAVITY UPDATE</p><p role="status">Mounting C: and checking the cupboards…</p><div class="progress-indicator segmented" role="progressbar" aria-label="Loading virtual disk"><span class="progress-indicator-bar"></span></div>`;
    document.body.append(screen); desktop.inert = true; taskbar.inert = true;
    try {
      const [{ createFilesystem }, effects] = await Promise.all([import(asset('filesystem.js')), import(asset('window-effects.js'))]);
      createWindowPhysics = effects.createWindowPhysics;
      filesystem = await createFilesystem(apps);
      filesystem.subscribe(() => {
        for (const [appId, nodeId] of editorFiles) {
          const entry = filesystem.node(nodeId);
          if (!entry) {
            const deleted = windows.get(appId);
            if (deleted) { deleted.body.querySelector('textarea').readOnly = true; for (const button of deleted.element.querySelectorAll('[data-fs="save"]')) button.disabled = true; deleted.element.querySelector('.window-status span').textContent = 'Deleted from C: — copy any draft before closing.'; }
            continue;
          }
          apps[appId].name = apps[appId].label = entry.name;
          apps[appId].path = filesystem.path(nodeId);
          const win = windows.get(appId);
          if (win) {
            win.element.querySelector('.window-title').textContent = entry.name;
            win.task.querySelector('span').textContent = entry.name;
            win.task.setAttribute('aria-label', `Switch to ${entry.name}`);
            win.body.querySelector('textarea')?.setAttribute('aria-label', entry.name);
          }
        }
      });
      screen.querySelector('[role="status"]').textContent = 'Disk ready. Starting desktop…';
      if (initialApp === "home" && window.innerWidth > 1100) openApp("note", { focus: false, initial: true });
      await openApp(initialApp, { initial: true });
      screen.remove(); desktop.inert = false; taskbar.inert = false;
      if (filesystem.warning) notify(filesystem.warning);
    } catch {
      screen.querySelector('[role="status"]').textContent = 'Could not load the virtual disk. Your stored files have not been reset.';
      const retry = document.createElement('button'); retry.textContent = 'Retry boot'; retry.onclick = () => location.reload(); screen.append(retry);
    }
  }
  boot();
})();
