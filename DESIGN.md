# beepOS visual system

## Why 98.css

Evaluated [98.css](https://jdan.github.io/98.css/) against the existing vanilla-JavaScript desktop. Its CSS-only approach fits: it supplies the Windows 98 bevels, title-bar glyphs (including Restore), bitmap fonts, fields, scrollbars and focus treatments without replacing window management or adding a build step.

We use **98.css 0.1.21**, vendored unmodified in `assets/vendor/98.css/`, with its four local font files and MIT license. Source: `https://unpkg.com/98.css@0.1.21/dist/98.css`. Loading the desktop makes no CDN requests. Upgrade the stylesheet and fonts together; retain the upstream license.

## One styling entrypoint

Every existing HTML page continues to load `style.css`. It imports 98.css first, then defines the shared tokens, component adapters, app layouts, responsive rules and print styles. Do not add per-page stylesheets or inline chrome styles.

- **Surfaces:** silver system chrome, white documents, navy-to-blue active titles and grey inactive titles. Desktop wallpaper colours remain a user preference and never recolour app controls.
- **Borders:** `--raised`, `--sunken` and `--status-border` reproduce the upstream bevels for components that are not native buttons, such as file links, the start menu and address fields. Use these tokens rather than approximating borders with new colours or shadows.
- **Spacing:** use `--space-1` through `--space-6` (4, 8, 12, 16, 24 and 32px). One-pixel edges, two-pixel bevels/control gaps, and window geometry are structural exceptions.
- **Typography:** locally bundled Pixelated MS Sans Serif for the UI; the shared monospace stack for paths, metadata and terminal output.
- **Icons:** retain `assets/icons.svg`, the existing single pixel-icon sheet. Use `--icon-small` (16px) in title bars/taskbar, `--icon-medium` (32px) for launchers, and `--icon-large` (64px) for application illustrations. Keep outlines and rendering in the shared SVG rule. Branding is separate.
- **App content:** yellow note paper, terminal black and diagnostic status colours are semantic content tokens. Their window frames, controls and focus treatments remain identical to other apps.

## Component contract

`beepos.js` adds the upstream `window`, `title-bar`, `title-bar-text` and `title-bar-controls` classes alongside existing hooks. All window controls use 98.css's `minimize`, `maximize`, `restore` and `close` classes, with descriptive accessible labels. Maximize toggles the glyph class as well as the existing geometry state. Do not draw replacement control glyphs.

Checkboxes and radio buttons follow the upstream `input + label` structure, with explicit IDs and `for` attributes. Test the visible labels and keyboard interactions; the native inputs are visually hidden by 98.css.

The existing manager still owns dragging, resizing, focus, minimization, closing, the taskbar and app loading. Applications and all existing HTML routes remain in their original files. On narrow viewports, the existing single-active-window layout remains; shared control-size tokens increase touch targets without introducing a second control design.

## Browser checks

`tests/browser.cjs` uses Playwright and a separately running local HTTP server. It covers content/links, app loading, all window actions, Nouveau detection, notes/preferences, keyboard controls, offline/error handling, no-JavaScript pages and layouts at 320, 390, 640, 768, 1024 and 1440px. It also checks shared window frames, upstream control glyphs and font loading.

Screenshots are written to the system temporary directory under `beepos-screenshots`, including desktop, mobile, account documents and display settings. Override `BEEPOS_SCREENSHOTS` to save elsewhere. Inspect these images after changing the visual system.
