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
- `beepos.js` — desktop, app loading, window management, taskbar, start menu, terminal, and preferences.
- `style.css` — desktop and app styles, including mobile, print, and reduced-motion support.
- `DESIGN.md` — the shared Windows 93/98 visual system, 98.css evaluation and component rules.
- `assets/` — original SVG pixel icons and favicon.
- `assets/vendor/98.css/` — pinned 98.css 0.1.21, its fonts and upstream license.

Edit content in the HTML pages. The desktop loads their `#page-content` elements into windows; opening an existing URL directly starts that app. Those pages also remain readable without JavaScript. Internal links keep their real destinations, including for opening in a new tab.

Click a desktop icon or use Start to open an app. Drag a title bar to move a window (or focus it and use arrow keys; Shift moves farther), drag its bottom-right corner to resize, or double-click its title bar to maximize. Window buttons and taskbar buttons minimize, restore, and close apps. On phones, the active app fills the desktop; Start and the taskbar still switch apps.

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

Tests save desktop/mobile screenshots to the system temporary directory under `beepos-screenshots`. Set `BEEPOS_URL` or `BEEPOS_SCREENSHOTS` to override the preview URL or screenshot directory. See `DESIGN.md` for coverage and visual conventions.

Pushing `main` triggers the connected Cloudflare Pages deployment.
