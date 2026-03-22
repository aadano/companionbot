# Teto QoL Roadmap

## High priority
- [ ] **Position memory** — save window position to config, restore on launch
- [ ] **Launch on startup** — Windows auto-start via `app.setLoginItemSettings()`
- [ ] **Global hotkeys** — e.g. `Ctrl+Shift+M` to mute/unmute without focusing the window
- [ ] **System tray icon** — right-click tray to mute/quit without needing the app visible

## Medium priority
- [ ] **Idle reactions** — if screen has been static for a long time, Teto occasionally says something unprompted (yawn, comment about the silence)
- [ ] **Time-aware personality** — morning / night / late-night awareness baked into her responses
- [ ] **Chat input history** — up-arrow recalls previous messages like a terminal
- [ ] **Caption always-on mode** — optional setting to keep caption visible after TTS ends

## Polish
- [ ] **Typewriter caption effect** — text appears character by character instead of all at once
- [ ] **Export chat history** — save log as txt/json from the history window

## Accessories (longer term)
- [ ] **Hat/headwear overlays** — PNG overlaid on sprite, inherits same CSS animation class so it moves with her
- [ ] **Glasses/facewear** — same approach, fixed position on face
- [ ] Full outfits would need per-emotion artwork — bigger scope

## Done this session
- [x] Settings window (separate BrowserWindow, full config UI)
- [x] Game mode (multi-frame vision, patience erosion, AAVE + cursing tier)
- [x] Screen watch switched to Claude Haiku (vision.js)
- [x] Controls toggle (clean floating mode vs full UI)
- [x] Quit button
- [x] Opacity control (CSS-level, doesn't affect Teto or toggle)
- [x] Emotion auto-reset to idle after 12s
- [x] Caption no longer pushes avatar up
- [x] Scrolling fixed in settings + history windows
- [x] Dark rectangle of doom and despair — DEFEATED
