# beepOS

[beep8.xyz](https://beep8.xyz/), disguised as a very personal computer.

Static HTML, CSS, and vanilla JavaScript, styled with a locally vendored copy of 98.css. No build step, package installation, remote fonts, or JavaScript runtime dependencies. Cloudflare Pages serves the repository directly.

## Run locally

```sh
python3 -m http.server 8765
```

Open `http://localhost:8765`. Use an HTTP server rather than opening the HTML files directly: the desktop fetches its other apps from their existing pages.

## What's where

- `index.html` — welcome, writing links, socials, and other accounts.
- `quotes.html` — every terrible joke, in its original habitat.
- `inactive.html` — the account graveyard.
- `nouveau/nouveautest.html` — NouveauBrowser API detection and its recheck button.
- `404.html` — the missing-file app. Assets use root paths so nested missing URLs work on Cloudflare Pages.
- `filesystem.js` — versioned IndexedDB disk, transaction-safe writes and text/folder operations.
- `beepos.js` — desktop, app loading, window management, taskbar, start menu, terminal, and preferences.
- `style.css` — desktop and app styles, including mobile, print, and reduced-motion support.
- `DESIGN.md` — the shared Windows 93/98 visual system, 98.css evaluation and component rules.
- `assets/` — original SVG pixel icons and favicon.
- `assets/vendor/98.css/` — pinned 98.css 0.1.21, its fonts and upstream license.

Edit content in the HTML pages. The desktop loads their `#page-content` elements into windows; opening an existing URL directly starts that app. Those pages also remain readable without JavaScript. Internal links keep their real destinations, including for opening in a new tab.

Click a desktop icon or use Start to open an app. Drag a title bar to move a window (or focus it and use arrow keys; Shift moves farther), drag its bottom-right corner to resize, or double-click its title bar to maximize. Window buttons and taskbar buttons minimize, restore, and close apps. My Computer uses single-click selection, double-click/Enter to open, arrow keys to navigate, and File/View menus for opening and icon views. On phones, tap a file to open it; the active app fills the desktop, and Start and the taskbar still switch apps.

The virtual C: disk saves in IndexedDB in this browser on this device. New files, folders, names and saved text survive a reload. Existing app shortcuts live in `C:\beepOS\my stuff`; Explorer supports Up, Back, address entry, new files/folders and renaming user entries. Text documents save with Save or Ctrl+S. Built-in files are read-only. No real host files are exposed.

The sticky note, wallpaper, and optional sounds save only in this browser's local storage. Notes never leave the browser. The beep prompt is a toy, not a shell; type `help` for its commands.

## Check changes

```sh
node --check beepos.js
git diff --check
```

Run the reproducible Playwright checks with the preview server running. Test tooling can live outside the site:

```sh
npm install --prefix /tmp/beepos-test-tools playwright
/tmp/beepos-test-tools/node_modules/.bin/playwright install chromium
PLAYWRIGHT_MODULE=/tmp/beepos-test-tools/node_modules/playwright node tests/browser.cjs
```

Run the filesystem checks with the same server and tooling:

```sh
PLAYWRIGHT_MODULE=/tmp/beepos-test-tools/node_modules/playwright node tests/filesystem.browser.cjs
```

If IndexedDB is blocked or saved disk data is invalid, beepOS clearly labels a temporary disk and leaves stored data untouched. Failed saves preserve the previous committed version; unsaved editors warn on close/reload. Clearing site data or browser eviction can remove local files. This is local browser storage, not a cloud backup.

Tests save desktop/mobile screenshots to the system temporary directory under `beepos-screenshots`. Set `BEEPOS_URL` or `BEEPOS_SCREENSHOTS` to override the preview URL or screenshot directory. See `DESIGN.md` for coverage and visual conventions.

Pushing `main` triggers the connected Cloudflare Pages deployment.

This release closes out beepOS **1.0**. See `CHANGELOG.md`.
