# beepOS visual system

## Why 98.css

Evaluated [98.css](https://jdan.github.io/98.css/) against the existing vanilla-JavaScript desktop. Its CSS-only approach fits: it supplies the Windows 98 bevels, title-bar glyphs (including Restore), bitmap fonts, fields, scrollbars and focus treatments without replacing window management or adding a build step.

We use **98.css 0.1.21**, vendored unmodified in `assets/vendor/98.css/`, with its four local font files and MIT license. Source: `https://unpkg.com/98.css@0.1.21/dist/98.css`. Loading the desktop makes no CDN requests. Upgrade the stylesheet and fonts together; retain the upstream license.

## One styling entrypoint

Every existing HTML page continues to load `style.css`. It imports 98.css first, then defines the shared tokens, component adapters, app layouts, responsive rules and print styles. Do not add per-page stylesheets or inline chrome styles.

- **Surfaces:** silver system chrome, white documents, navy-to-blue active titles and grey inactive titles. Desktop wallpaper colours remain a user preference and never recolour app controls.
- **Borders:** `--raised`, `--sunken` and `--status-border` reproduce the upstream bevels for components that are not native buttons, such as the start menu and Explorer address field. File icons are flat selectable objects, not raised cards. Use these tokens rather than approximating borders with new colours or shadows.
- **Spacing:** use `--space-1` through `--space-6` (4, 8, 12, 16, 24 and 32px). One-pixel edges, two-pixel bevels/control gaps, and window geometry are structural exceptions.
- **Typography:** use `--font-ui` (11px) for chrome, controls and labels; `--font-title` for title bars; `--font-heading` (13px bold) for compact dialog headings; `--font-document` (12px) for reading; and `--font-code` for text files and the terminal. Pixelated MS Sans Serif stays at its native 11px UI size across desktop resolutions. Avoid webpage hero headings, uppercase kickers and monospace UI labels.
- **Icons:** retain `assets/icons.svg`, the existing single pixel-icon sheet. Use `--icon-small` (16px) in title bars, menus, taskbar and small-icon view, and `--icon-medium` (32px) for desktop/Explorer icons and dialog illustrations. Do not stretch glyphs with viewport size. Branding is separate.
- **App content:** yellow note paper, terminal black and diagnostic status colours are semantic content tokens. Their window frames, controls and focus treatments remain identical to other apps.

## Component contract

`beepos.js` adds the upstream `window`, `title-bar`, `title-bar-text` and `title-bar-controls` classes alongside existing hooks. All window controls use 98.css's `minimize`, `maximize`, `restore` and `close` classes, with descriptive accessible labels. Maximize toggles the glyph class as well as the existing geometry state. Do not draw replacement control glyphs.

Checkboxes and radio buttons follow the upstream `input + label` structure, with explicit IDs and `for` attributes. Test the visible labels and keyboard interactions; the native inputs are visually hidden by 98.css.

The existing manager still owns dragging, resizing, focus, minimization, closing, the taskbar and app loading. Applications and all existing HTML routes remain in their original files. On narrow viewports, the existing single-active-window layout remains; shared control-size tokens increase touch targets without introducing a second control design.

## App layouts

- **My Computer:** compact, left-aligned file pane; no hero, introductory copy or card tiles. File/View/Window/Help menus and the Explorer-only address bar sit above it; the status bar reports object count or selection. Single click selects, double click or Enter opens, and arrows/Home/End move selection. On touch screens, a tap opens. File > Open and View > Large Icons / Small Icons reuse the same application routing and icon sheet.
- **Welcome:** silver system dialog with a 32px icon, compact heading and real 98.css fieldsets for files and contact groups. All existing links and account details remain available.
- **Documents:** white text panes with modest headings and system menus. Quotes uses monospace document text. Account writing remains intact and scrolls inside its pane.
- **Utilities:** settings, diagnostics and About use silver dialog surfaces and native fields/group boxes. Yellow note paper and the black terminal are content surfaces. These apps do not show a browser address bar.
- **Menus:** one shared menu builder and keyboard interaction for app chrome. File/Window commands call the existing window manager; Explorer adds only selection and view state. Escape/outside clicks dismiss menus.

The taskbar uses `--taskbar-height` consistently with the desktop work area. Desktop icons flow down columns and wrap when height is limited. Branding adapts to the available space; system text and icons retain their crisp sizes. Phones keep one active app filling the work area with larger title controls and the same menus and file grid.

## Desktop context menus

The desktop handles `contextmenu` only outside `.os-window`. Background clicks get one joke action; desktop shortcuts get Open and Properties. Window events are left uncancelled for native browser behavior or app-owned handlers. Keep this boundary when adding future actions.

The context popup reuses the shared menu styles, fits within the viewport, supports Shift+F10 / the context-menu key, arrow navigation and Escape, and dismisses on outside pointer actions, resize or blur. Properties uses the existing window manager and shows shortcut metadata without inventing disk sizes or modification dates.

## Browser checks

`tests/browser.cjs` uses Playwright and a separately running local HTTP server. It covers content/links, app loading, all window actions, Nouveau detection, notes/preferences, keyboard controls, offline/error handling, no-JavaScript pages and layouts at 320, 390, 640, 768, 1024 and 1440px. It also checks shared window frames, upstream control glyphs, font loading, Explorer selection/opening/views/keyboard/touch, and reachable icons at 800×480, 1280×720 and 1920×1080.

Screenshots are written to the system temporary directory under `beepos-screenshots`, including desktop, mobile, Explorer, documents and display settings. Override `BEEPOS_SCREENSHOTS` to save elsewhere. Inspect these images after changing the visual system.
