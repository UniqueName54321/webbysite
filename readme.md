# beepOS

[beep8.xyz](https://beep8.xyz/), disguised as a very personal computer.

Static HTML, CSS, and vanilla JavaScript. No build step, packages, remote fonts, or runtime dependencies. Cloudflare Pages serves the repository directly.

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
- `assets/` — original SVG pixel icons and favicon.

Edit content in the HTML pages. The desktop loads their `#page-content` elements into windows; opening an existing URL directly starts that app. Those pages also remain readable without JavaScript. Internal links keep their real destinations, including for opening in a new tab.

Click a desktop icon or use Start to open an app. Drag a title bar to move a window (or focus it and use arrow keys; Shift moves farther), drag its bottom-right corner to resize, or double-click its title bar to maximize. Window buttons and taskbar buttons minimize, restore, and close apps. On phones, the active app fills the desktop; Start and the taskbar still switch apps.

The sticky note, wallpaper, and optional sounds save only in this browser's local storage. Notes never leave the browser. The beep prompt is a toy, not a shell; type `help` for its commands.

## Check changes

```sh
node --check beepos.js
git diff --check
```

Browser regression checks for this migration covered all original content and external links; window dragging, resizing, controls, and single-instance apps; keyboard navigation; direct URLs and nested assets; both Nouveau API outcomes; terminal commands; note and preference persistence; unavailable storage; failed app requests and retry; offline status; JavaScript-disabled pages; and layouts from 320px to 1440px wide.

Pushing `main` triggers the connected Cloudflare Pages deployment.
