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

The existing manager still owns dragging, resizing, focus, minimization, closing, the taskbar and app loading. Disk-backed text files register safe generated app IDs and reuse this manager; they never execute their contents. Applications and all existing HTML routes remain in their original files. On narrow viewports, the existing single-active-window layout remains; shared control-size tokens increase touch targets without introducing a second control design.

## App layouts

- **My Computer:** compact, left-aligned file pane; no hero, introductory copy or card tiles. File/View/Window/Help menus, the Back/Up/New toolbar and the editable Explorer-only address bar sit above it; the status bar reports object count or selection. Single click selects, double click or Enter opens, and arrows/Home/End move selection. On touch screens, a tap opens. File > Open and View > Large Icons / Small Icons reuse the same application routing and icon sheet.
- **Welcome:** silver system dialog with a 32px icon, compact heading and real 98.css fieldsets for files and contact groups. All existing links and account details remain available.
- **Documents:** white text panes with modest headings and system menus. Quotes uses monospace document text. Account writing remains intact and scrolls inside its pane.
- **Utilities:** settings, diagnostics and About use silver dialog surfaces and native fields/group boxes. Yellow note paper and the black terminal are content surfaces. These apps do not show a browser address bar.
- **Menus:** one shared menu builder and keyboard interaction for app chrome. File/Window commands call the existing window manager; Explorer adds only selection and view state. Escape/outside clicks dismiss menus.

The taskbar uses `--taskbar-height` consistently with the desktop work area. Desktop icons flow down columns and wrap when height is limited. Branding adapts to the available space; system text and icons retain their crisp sizes. Phones keep one active app filling the work area with larger title controls and the same menus and file grid.

## Desktop context menus

The desktop handles `contextmenu` only outside `.os-window`. Background clicks get one joke action; desktop shortcuts get Open and Properties. Window events are left uncancelled by the desktop for native browser behavior or app-owned handlers. Explorer now handles only its file pane: New File/Folder on the background, Open/Rename/Delete on items. Address/edit fields retain browser context menus. Keep this boundary when adding future actions.

The context popup reuses the shared menu styles, fits within the viewport, supports Shift+F10 / the context-menu key, arrow navigation and Escape, and dismisses on outside pointer actions, resize or blur. Properties uses the existing window manager and shows shortcut metadata without inventing disk sizes or modification dates.

## Virtual disk and boot

`filesystem.js` owns schema version 1 in IndexedDB database `beepOS-filesystem`, object store `disk`, key `C`. It seeds only a missing disk and validates existing data before use. Built-in folders/shortcuts/text are locked against rename/edit; user folders and text can be created, renamed and deleted with confirmation. Recursive deletion is transactional and rejects protected descendants; local unsaved edits block deletion, while deleted documents in other tabs retain a copyable draft/snapshot. All desktop app shortcuts live under `C:\beepOS\my stuff`; static HTML routes remain valid. Stored user names/content are rendered with DOM text/value APIs, never as executable markup.

All writes run in read/write transactions against the latest stored disk. BroadcastChannel and focus refresh keep tabs current; an editor checks its previous saved text before overwriting a changed file. Failed writes do not commit or clear the editor draft. Existing localStorage note/preferences remain separate and untouched. Inaccessible or invalid storage uses a clearly labelled temporary session and never resets existing data. There is no implicit formatting/reset command.

The boot screen is shown during module loading and disk initialization, with an indeterminate 98.css progress bar and reduced-motion support. It does not add a fake minimum delay. The desktop stays inert until the initial app is ready. Boot errors offer Retry rather than silently wiping storage.

The disk is limited to 2048 entries and 256 Ki UTF-16 code units per text file. Names follow case-insensitive Windows-style collision/reserved-name rules. Root/system anchors and parent relationships are validated, including cycle detection. Future disk schema versions require explicit migration; do not reseed over an existing disk. Release 1.1 keeps schema version 1 and changes only the exact known locked 1.0 VERSION.txt content. User nodes are not reseeded or rewritten.

## Window effects and application menus (1.1)

Window effects are session-only and off by default. The Window menu has a native range control, 15-degree rotation buttons and an independent physics toggle. CSS `rotate` leaves the drag/resize manager intact; Start > Reset window effects is always available outside the transformed windows. Maximized windows restore before setting a nonzero angle. Rotated frames scale down only when needed to fit the work area, so phone controls stay reachable. Maximizing straightens the window. Mobile users have the same global rescue action.

`window-effects.js` positions actual content nodes without reparenting or cloning them. Explorer items keep their grid event delegation, forms keep native controls and listeners, and textareas keep drafts. The fixed-step rectangle solver applies world-down gravity in the rotated window’s local coordinates, resolves item/wall collisions and supports pointer grabs/throws. Bulky nodes scale to fit; up to 64 direct items are supported per window to bound CPU cost. Menus/chrome are outside the simulation.

Disabling restores original inline styles and scroll position. Folder/content changes and window resizing rebuild the simulation; minimizing, mobile inactive windows and document visibility pause animation. Closing disconnects observers and cancels frames. Do not persist simulated item positions or write physics state into the disk.

App menus share one builder and native controls, but Explorer gets Go/file actions, the prompt gets Command actions, browser diagnostics gets Browser actions, settings gets Display actions, editors get Edit/Save and documents get selection/print. Help opens an independent About window for the originating app. Internal About dialogs use the system About as their own information view rather than recursing forever.

Opening the `app-computer` shortcut through the virtual disk opens the fixed IMDb URL for Inception in a new tab with noopener/noreferrer. Start/desktop/File menu launchers still open the normal Explorer; no user data is attached to the external URL.

## Browser checks

`tests/browser.cjs` uses Playwright and a separately running local HTTP server. It covers content/links, app loading, all window actions, Nouveau detection, notes/preferences, keyboard controls, offline/error handling, no-JavaScript pages and layouts at 320, 390, 640, 768, 1024 and 1440px. It also checks shared window frames, upstream control glyphs, font loading, Explorer selection/opening/views/keyboard/touch, and reachable icons at 800×480, 1280×720 and 1920×1080.

Screenshots are written to the system temporary directory under `beepos-screenshots`, including desktop, mobile, Explorer, documents and display settings. Override `BEEPOS_SCREENSHOTS` to save elsewhere. Inspect these images after changing the visual system.

`tests/filesystem.browser.cjs` adds boot, persistence/reload, hierarchy, new/rename/edit, invalid names, quota failures, stale saves, cross-tab concurrency, read-only seeds, prompt commands, mobile layouts, unavailable storage and damaged-disk recovery checks. It captures the boot screen, disk root, editor and mobile Explorer.

`tests/version11.browser.cjs` covers actual rotation/dragging, slider keyboard input, collision response, per-window physics and DOM restoration, editor input preservation, app menus/About, recursive and protected deletion, Inception navigation, mobile recovery, and a populated 1.0 disk upgrade. Screenshots use the `v11-` prefix.

## Media mount

C:\Media contains NOTES.txt and an Images folder mount. Missing mount entries are added transactionally to existing disks without overwriting user entries with colliding names. The Images mount opens the live Commons category browser (`commons.js`); remote results are not stored as local disk nodes. Category members and parent categories are queried through Wikimedia Commons’s public Action API using origin=*. Category graphs may have multiple parents and cycles; browsing uses explicit links and Back history instead of recursively downloading a tree. Results paginate, requests abort on navigation/close, and errors expose Retry. Only image MIME types are shown; thumbnail/source URLs are restricted to Commons/upload.wikimedia.org over HTTPS. Remote text is rendered as text, never HTML. Source-page links provide full creator/license details.

Media Viewer (`media-viewer.js`) reuses desktop window management, 98.css controls, the shared inset border, app menus and About dialog. Commons image buttons open it for mouse, keyboard and touch activation, including modified clicks; the source page remains available inside the viewer. Every image has an eagerly requested preview, falling back to its original URL when a thumbnail is missing or fails. Unavailable previews expose a retry control. Attribution remains visible in the viewer with a source/license link. A larger 1280px Commons rendition is requested for viewing, with the existing URL as a network-error fallback.

`media-contract.js` defines the shared media descriptor: `{kind:'commons', title, pageid, mime, url, previewUrl, sourceUrl, artist, license}` or `{kind:'local', title, mime, blob}`. Future local disk media can use the same viewer `open()` method. Open Local currently accepts device files as temporary Blob URLs; it does not import them into C: or upload them. Images support fit/actual-size/zoom; audio/video use native playback controls. Replacing media or closing releases object URLs, cancels requests and stops playback. Only the exact original bundled Media note is migrated to include the category protips.

`tests/media.browser.cjs` checks missing/broken thumbnail fallback, in-window Commons viewing, attribution, zoom, local Blob loading/cleanup, unsupported types and desktop/mobile screenshots.

Images requests thumbnail metadata in batches of ten and consumes imageinfo continuation responses before rendering the page. Every image entry eagerly loads its preview, including entries on subsequent category pages; missing source-page URLs are safely derived from the Commons file title. `tests/images.browser.cjs` covers 45 previews across batches, partial responses and pagination, plus mouse/keyboard/touch viewer routing and desktop/mobile screenshots.
