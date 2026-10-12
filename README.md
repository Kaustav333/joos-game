# Jooo’s Little Universe

A small browser-playable Three.js exploration game made for Jooo. The whole island is rendered in one scene: wander from Mosslight Meadow to the Little Cup Café, the Wishing Garden, and the Starlit Castle. Procedural geometry keeps the world self-contained and lightweight; its music and sound effects are synthesized by the browser, with no third-party game assets or audio files.

## Run locally

Install Node.js 20.19+ or 22.12+, then from this folder run:

```bash
npm install
npm run dev
```

Open the local URL Vite prints. To create and preview the production build:

```bash
npm run build
npm run preview
```

## Play

- Desktop: **WASD** or arrow keys to walk, **E** to interact, drag to orbit the free camera, and use the mouse wheel to zoom.
- Phone or tablet: use the on-screen thumbstick to walk, drag the scene to look around, and tap the heart button when an interaction is nearby.
- Collect all 12 stars, befriend the garden cat through three encounters, then visit the castle heart for the romantic finale.
- The sound button opens volume and mute controls. Audio starts after the first user gesture, as required by browser autoplay rules.
- Progress and settings are saved in this browser with local storage.

## Personalize the notes

Edit `src/messages.js` to change the three hidden messages and the romantic finale title, note, and sign-off. The notes cycle if you add fewer or more than three entries. No rebuild step is needed during development; Vite refreshes the page when the file is saved.

To start over, clear this site’s local storage in the browser’s developer tools. The game uses the `joos-little-universe-save-v1` key for progress and separate `joos-volume` / `joos-muted` keys for sound preferences.

## Deploy to Vercel

1. Push this project to a Git repository and import it in Vercel, or install the Vercel CLI and run `vercel` from this folder.
2. Vercel detects Vite automatically. Use **Build Command** `npm run build` and **Output Directory** `dist` (both are also set in `vercel.json`). No environment variables are needed.
3. Deploy. The static build works on desktop and mobile browsers that support WebGL 2 and Web Audio.

## Project files

- `src/main.js` — world, controls, camera, game state, interactions, animation, and procedural sound.
- `src/messages.js` — editable personal messages and finale copy.
- `src/style.css` — responsive game interface.
- `index.html` — page shell and interface elements.
- `vercel.json` — Vite build and SPA deployment configuration.
