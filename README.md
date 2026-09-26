# Maaltafel-zoo

A game for learning the multiplication tables 1–10. See `REQUIREMENTS.md`.

## Play

Double-click `index.html`. It needs no installation, internet or server.
Progress is saved in that browser on that device.

## Install on iPad (works offline)

1. Open https://qaffeine.github.io/maaltafels/ in Safari.
2. Tap Share → Add to Home Screen → Add.
3. Open it once from the new icon while online. It then works without internet.

Always play from the home-screen icon: it keeps its own progress, separate from Safari.

**When adding a new file** (script, style, image), also add it to `FILES` in `sw.js`,
otherwise it won't be available offline.

## Publish a change

```sh
git add . && git commit -m "Describe the change" && git push
```

## Tests

```sh
node --test tests/logic.test.js
```

## Files

- `index.html`: the page
- `css/style.css`: the look
- `js/logic.js`: questions, mastery levels, stars (no DOM; unit-tested)
- `js/storage.js`: saving profiles in the browser (localStorage)
- `js/themes.js`: the worlds (zoo, city): names, emoji and texts
- `js/sound.js`: sound effects generated in the browser
- `js/app.js`: screens and game flow
- `sw.js`: offline support (saves the game files on the device)
- `manifest.webmanifest`, `icons/`: home-screen app name and icon
- `tools/make_icons.py`: redraws the icons
