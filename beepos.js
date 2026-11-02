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
  const apps = {
    find: { name: "Find", label: "Find", icon: "offline", path: "system\\find.exe", width: 380, height: 210, status: "search failed successfully" },
    readme: { name: "README.md", label: "README.md", icon: "quotes", file: "desktop/README.md", path: "desktop\\README.md", width: 600, height: 460, status: "README.md · read-only · deliberately unhelpful" },
    home: { name: "welcome.exe", label: "Welcome", icon: "computer", file: "index.html", path: "welcome.exe", width: 640, height: 512, status: "welcome to your little corner of the internet" },
    computer: { name: "My computer", label: "My computer", icon: "folder", path: "my stuff", width: 540, height: 340, status: "6 items · all your stuff, in one place" },
    quotes: { name: "quotes.txt", label: "Quotes & jokes", icon: "quotes", file: "quotes.html", path: "my stuff\\quotes.txt", width: 600, height: 390, status: "3 entries · read-only · unfortunately" },
    inactive: { name: "account graveyard", label: "Account graveyard", icon: "archive", file: "inactive.html", path: "my stuff\\account graveyard", width: 660, height: 550, status: "inactive, potentially inactive & formerly inactive" },
    nouveau: { name: "NouveauBrowser checker", label: "Nouveau checker", icon: "globe", file: "nouveau/nouveautest.html", path: "utilities\\nouveau.exe", width: 480, height: 450, status: "browser diagnostics · The Nouveau Project" },
    terminal: { name: "beep prompt", label: "Beep prompt", icon: "terminal", path: "system\\beep.exe", width: 600, height: 360, status: "type help to see what this thing can do" },
    settings: { name: "Display properties", label: "Display settings", icon: "settings", path: "system\\display.exe", width: 420, height: 440, status: "make yourself at home" },
    note: { name: "a note to self", label: "Sticky note", icon: "note", path: "my stuff\\note.txt", width: 225, height: 240, status: "" },
    about: { name: "About beepOS", label: "About beepOS", icon: "beep", path: "system\\about.exe", width: 400, height: 360, status: "beepOS 1.0 · personal edition" },
    notfound: { name: "file not found", label: "File not found", icon: "offline", width: 540, height: 475, status: "error 404 · this file has left the chat" }
  };
  const initialApp = apps[source.dataset.app] ? source.dataset.app : "home";
  const templates = new Map([[initialApp, { html: source.innerHTML, className: source.className }]]);
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
    <div class="wallpaper-brand" aria-hidden="true">${pixelLogo()}<p>your very personal computer.</p><p class="brand-version">version 1.0 / beep8.xyz</p></div>
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
    }
    win.element.hidden = false;
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
    win.element.hidden = true;
    win.element.classList.remove("is-active");
    win.task.setAttribute("aria-pressed", "false");
    if (activeId === win.id && moveFocus) focusNext();
  }

  function closeWindow(win) {
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
    const maximized = win.element.classList.toggle("is-maximized");
    const button = win.element.querySelector('[data-action="maximize"]');
    button.setAttribute("aria-label", `${maximized ? "Restore" : "Maximize"} ${apps[win.id].name}`);
    button.classList.toggle("restore", maximized);
    button.classList.toggle("maximize", !maximized);
    button.title = maximized ? "Restore window" : "Maximize window";
    focusWindow(win);
    if (!maximized) constrainWindow(win);
  }

  // Shared native menu presentation; actions reuse the existing window manager.
  function appMenuBar(id) {
    const menu = (label, content) => `<details class="app-menu"><summary>${label}</summary><div class="menu-popup">${content}</div></details>`;
    return `<nav class="window-toolbar" aria-label="${apps[id].name} menu bar">${
      menu("File", `${id === "computer" ? '<button type="button" data-explorer="open" disabled>Open</button><hr>' : ''}<button type="button" data-open="computer">My Computer</button><button type="button" data-action="close">Close</button>`) +
      menu("View", `${id === "computer" ? '<button type="button" data-explorer="large" aria-pressed="true">Large Icons</button><button type="button" data-explorer="small" aria-pressed="false">Small Icons</button><hr>' : ''}<button type="button" data-action="maximize">Maximize / Restore</button>`) +
      menu("Window", '<button type="button" data-action="minimize">Minimize</button><button type="button" data-action="show-desktop">Show Desktop</button>') +
      menu("Help", '<button type="button" data-open="about">About beepOS</button>')
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

  function initExplorer(win) {
    const grid = win.body.querySelector(".app-grid");
    const files = [...grid.querySelectorAll(".app-file")];
    const openButton = win.element.querySelector('[data-explorer="open"]');
    let selected = null;
    const select = (file) => {
      selected = file;
      for (const item of files) {
        item.classList.toggle("is-selected", item === file);
        item.setAttribute("aria-selected", String(item === file));
        item.tabIndex = item === file || (!file && item === files[0]) ? 0 : -1;
      }
      openButton.disabled = !file;
      win.element.querySelector(".window-status span").textContent = file
        ? `${apps[file.dataset.open].name} · 1 object selected`
        : `${files.length} objects`;
    };
    for (const file of files) {
      file.setAttribute("role", "option");
      file.addEventListener("click", (event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); select(file);
        if (event.pointerType === "touch") openApp(file.dataset.open);
      });
      file.addEventListener("dblclick", (event) => { event.preventDefault(); openApp(file.dataset.open); });
      file.addEventListener("keydown", (event) => {
        const index = files.indexOf(file);
        const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
        if (Object.hasOwn(offsets, event.key) || ["Home", "End"].includes(event.key)) {
          event.preventDefault();
          const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? files.length - 1 : Math.max(0, Math.min(files.length - 1, index + offsets[event.key]));
          select(files[nextIndex]); files[nextIndex].focus();
        } else if (event.key === "Enter") { event.preventDefault(); openApp(file.dataset.open); }
        else if (event.key === " ") { event.preventDefault(); select(file); }
      });
    }
    win.body.addEventListener("click", (event) => { if (!event.target.closest(".app-file")) select(null); });
    for (const button of win.element.querySelectorAll("[data-explorer]")) {
      button.addEventListener("click", () => {
        if (button.dataset.explorer === "open") { if (selected) openApp(selected.dataset.open); }
        else {
          const small = button.dataset.explorer === "small";
          grid.classList.toggle("small-icons", small);
          win.element.querySelector('[data-explorer="large"]').setAttribute("aria-pressed", String(!small));
          win.element.querySelector('[data-explorer="small"]').setAttribute("aria-pressed", String(small));
        }
      });
    }
    select(null);
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
      ${!["note", "find"].includes(id) ? appMenuBar(id) : ""}
      ${id === "computer" ? `<div class="address-bar"><span>Address</span><div class="address">${icon(app.icon)}C:\\beepOS\\${app.path}</div></div>` : ""}
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
    switch (id) {
      case "find":
        return { className: "app-content error-content", html: `${icon("offline", "error-icon")}<p id="find-message"></p><button class="retro-button" type="button" data-action="close">OK</button>` };
      case "computer":
        return { className: "app-content computer-content", html: `<div class="app-grid" role="listbox" aria-label="Files in My Computer">${["home", "quotes", "inactive", "nouveau", "terminal", "note"].map((appId) => appLink(appId, "app-file")).join("")}</div>` };
      case "note":
        return { className: "app-content note-content", html: `<div class="note-kicker"><span>NOTE TO SELF</span><span>001</span></div><label for="sticky-note" class="sr-only">Your sticky note</label><textarea id="sticky-note" maxlength="2000" spellcheck="false"></textarea><p class="note-save" role="status">editable · saves on this computer</p>` };
      case "settings":
        return { className: "app-content settings-content", html: `<p class="eyebrow">make it yours</p><h1>Display properties<span class="accent">.</span></h1><p>same little OS. different little mood.</p><fieldset><legend>Desktop colour</legend><div class="theme-options">${Object.entries(themes).map(([id, colors]) => `<div class="theme-option"><span class="theme-swatch" style="background:${colors[0]}">${icon("computer")}</span><div class="field-row"><input id="theme-${id}" type="radio" name="desktop-theme" value="${id}" ${theme === id ? "checked" : ""}><label for="theme-${id}">${id}</label></div></div>`).join("")}</div></fieldset><fieldset><legend>The little details</legend><div class="field-row setting-check"><input id="wallpaper-dots" type="checkbox" name="wallpaper-dots" ${plainWallpaper ? "" : "checked"}><label for="wallpaper-dots">Dotted wallpaper</label></div><div class="field-row setting-check"><input id="desktop-sound" type="checkbox" name="desktop-sound" ${soundEnabled ? "checked" : ""}><label for="desktop-sound">Tiny computer noises</label></div></fieldset><p class="settings-note">Changes apply immediately and stay on this browser.<br>No restart required. What a concept.</p>` };
      case "about":
        return { className: "app-content about-content", html: `${icon("beep")}<p class="eyebrow">welcome to your very personal computer</p><h1>beepOS</h1><p>an operating system for my corner of the internet.<br>just a page for me and my crap, with more windows.</p><dl class="about-specs"><div><dt>Version</dt><dd>1.0 / personal edition</dd></div><div><dt>System requirements</dt><dd>a browser &amp; curiosity</dd></div><div><dt>Available storage</dt><dd>enough for my crap</dd></div><div><dt>Powered by</dt><dd>HTML, CSS &amp; JavaScript</dd></div></dl><p>Inspired by the wonderfully weird web desktops of<br><a href="https://www.windows93.net/">Windows 93</a> &amp; <a href="https://windows96.net/">Windows 96</a>.</p><button class="retro-button" type="button" data-action="beep">beep!</button>` };
      case "terminal":
        return { className: "app-content terminal-content", html: `<p>beepOS [version 1.0]\n(c) beep8.xyz. all beeps reserved.</p><p class="terminal-dim">Type 'help' for a list of commands.\nThis is a toy terminal. Go on, poke it.</p><div class="terminal-output" role="log" aria-label="Command output" aria-live="polite"></div><form autocomplete="off"><label for="terminal-command">C:\\beepOS&gt;</label><input id="terminal-command" name="command" aria-label="Terminal command" spellcheck="false" autocapitalize="off" maxlength="200"></form>` };
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
    if (windows.has(id)) { if (id === "find") initContent(windows.get(id)); focusWindow(windows.get(id), !initial); return; }
    const win = makeWindow(id, focus);
    try {
      const content = builtInContent(id) || await loadTemplate(id);
      if (windows.get(id) !== win) return;
      const container = document.createElement("div");
      container.className = content.className;
      container.innerHTML = content.html;
      win.body.replaceChildren(container);
      initContent(win);
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
    const print = (message, dim = false) => {
      const p = document.createElement("p");
      p.textContent = message;
      if (dim) p.className = "terminal-dim";
      output.append(p);
      // Keep a long terminal session from growing forever.
      while (output.childElementCount > 150) output.firstElementChild.remove();
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const raw = input.value.trim();
      if (!raw) return;
      input.value = "";
      history.push(raw);
      historyIndex = history.length;
      print(`C:\\beepOS> ${raw}`, true);
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
      switch (command) {
        case "help": print("help          you are here\nls / dir      list your files\nopen <app>    open an app (try 'open quotes')\nbeep          do the thing\ndate          check the time\nwhoami        meet the person behind beepOS\necho <text>   say something into the void\nclear / cls   tidy up\nexit          close the prompt"); break;
        case "ls": case "dir": print("welcome    quotes    inactive    nouveau\ncomputer   note      settings    about\nreadme     find"); break;
        case "open": {
          const aliases = { welcome: "home", "quotes.txt": "quotes", accounts: "inactive", display: "settings", "readme.md": "readme" };
          const id = aliases[args[0]] || args[0];
          if (id && Object.hasOwn(apps, id) && id !== "notfound") { print(`Opening ${apps[id].name}…`); openApp(id); }
          else print("File not found. Try 'ls' to see what's here.");
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

  // No fake boot delay: the content is ready as soon as the desktop is.
  if (initialApp === "home" && window.innerWidth > 1100) openApp("note", { focus: false, initial: true });
  openApp(initialApp, { initial: true });
})();
