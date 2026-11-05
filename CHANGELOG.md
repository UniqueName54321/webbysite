# beepOS releases

## 1.1 — the gravity update

- Hardened Images thumbnail loading with small metadata batches and complete API continuation handling. Image buttons always open Media Viewer, including keyboard, touch and modified clicks.

- Added Media Viewer for Commons images and temporary local images/audio/video, with fit/zoom, attribution and source links.
- Every Commons image requests a preview, with original-image fallback and retry feedback.
- Media NOTES.txt now includes category browsing protips; existing bundled notes upgrade safely.

- Added `C:\Media` with a NOTES.txt introduction and a live Wikimedia Commons Images folder mount. Browse subcategories, multiple parents, paginated image results and creator/license source links.

- Rotate windows from their Window menu, with a slider and 15-degree steps.
- Enable item physics independently per window: gravity, wall/item collisions and grab/throw interactions. Disabling it restores the original DOM, controls and editor drafts.
- Added a Start-menu rescue action to reset every window’s rotation and physics.
- Explorer owns its file-pane context menu: create files/folders, open/rename items and confirm deletion of user items (including folder contents). System items remain protected.
- Opening My Computer’s shortcut inside `C:\beepOS\my stuff` opens Inception on IMDb. Normal launchers still open Explorer.
- Apps now have relevant submenus and independent About dialogs; text editors and readonly documents get their own information.
- Existing 1.0 disks are preserved. The schema stays at version 1; only the known locked 1.0 release note is migrated.
- Added rotation, collision, restoration, deletion, popup, mobile rescue and migration tests with screenshots.

## 1.0 — final update

- Added a persistent virtual C: disk backed by transactional IndexedDB storage.
- Kept the desktop applications under `C:\beepOS\my stuff`, with existing routes and content preserved.
- Explorer can navigate up/back, accept paths, create folders/text files and rename user entries.
- Added a text editor with Save/Ctrl+S, unsaved-change protection and stale-save detection.
- Beep prompt now understands disk paths, `cd`, `pwd`, `ls`/`dir`, `mkdir`, `touch` and `cat`. Existing commands and harmless dangerous-command jokes remain.
- Added an actual initialization/boot screen and explorable system folders with assorted nonsense inside.
- Preserved sticky notes, preferences, Find, the vague README and desktop context menus.
- Added storage-failure and multi-tab regression coverage, with desktop/mobile screenshots.

This is the final feature update for version 1.0. Be curious. There are cupboards now :3
