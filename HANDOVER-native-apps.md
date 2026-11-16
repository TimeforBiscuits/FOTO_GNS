# Handover: should FOTO_GNS become a native Mac / iPad app?

I'd like to explore what it would take to turn FOTO_GNS into a native app, installed through TestFlight with an Apple Developer account, and what I'd gain from it. Please help me weigh it up before I commit to anything.

## What FOTO_GNS is today

- A web app (PWA) for laying out photos on A4 pages and exporting print PDFs, plus a curation tool for culling folders of JPGs. It belongs to the same family as my other app, PJKT_GNS.
- Repo: github.com/TimeforBiscuits/FOTO_GNS. Live: timeforbiscuits.github.io/FOTO_GNS.
- Built with React 19, TypeScript, Vite, zustand and pdf-lib. Everything runs in the browser and nothing goes to a server. Work is saved in the browser's own storage (IndexedDB).
- Targets: a 2024 iPad Pro 13" (Safari, added to the Home Screen) and macOS (Safari or Chrome).

**Two halves:**
- **Selezione (curation):** open a folder of JPGs, mark keepers, and copy them into a `SELECTS` folder.
- **Impaginazione (layout):** named projects of A4 pages with fixed-ratio photo fields (3×2, 2×3, 16×9, 1×1), including fixed sizes for A5 and A6 notebooks. It exports 300 dpi or original-quality PDFs named `DDMMYY_project-name.pdf`.

## Where being a web app holds it back

These are the workarounds a native app might remove:

1. **No deleting.** My original idea was that the cull deletes the rejects (iPad) or moves them to the Trash (Mac). Browsers can't do either, so today I delete the originals myself after making SELECTS.
2. **No real folders in Safari.** Safari on iPad can't open a whole folder; I have to select all the files inside it. Safari can't create a `SELECTS` folder either, so it makes `SELECTS.zip` instead, which then has to be unpacked. Only Chrome on the Mac can write the folder directly.
3. **Saving on iPad needs extra taps.** Every save goes through the share sheet → "Save to Files", with a separate tap after each export.
4. **No Photos library.** The app can't read from or delete in the iPad's Photos app; only a native app can.
5. **Memory and canvas limits.** Safari caps the size of image canvases, and very large PDFs or zips are risky on iPad.
6. **Fragile storage.** Saved work lives in Safari's storage, which the system or a cleanup can wipe.

## What I want to understand

- **Options and effort**, for example:
  - wrapping the existing web code (e.g. Capacitor) and adding native bits for files and Photos
  - one iPad app that also runs on Apple-silicon Macs, versus a separate Mac build (Mac Catalyst, Tauri, Electron)
  - a full rewrite in SwiftUI

  Which would reuse the most of what already exists?
- **What I'd actually gain**, item by item against the list above.
- **Apple Developer Program:** cost, what it unlocks, and whether I need it for personal use only. What do I get with a free Apple ID (I've heard apps installed that way expire after about 7 days)?
- **TestFlight:** how it works, build expiry, internal vs external testers, and whether App Review is involved.
- **What I'd need:** a Mac with Xcode, signing certificates, App Store Connect setup, ongoing upkeep such as yearly renewal, rebuilds and OS updates.
- **Whether native file deletion and Trash** work the way I want (permissions, confirmation prompts, Files and iCloud Drive folders).
- **A rough plan and time estimate** for the recommended path, and anything that could make it not worth it.

## About me

- I'm not a professional developer. Claude Code builds the app with me in cloud sessions.
- I have a Mac and the iPad Pro.
- The app is for my own use, maybe shared with a few people.
