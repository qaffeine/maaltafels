# Maaltafel-zoo

A game for learning the multiplication tables 1–10. See `REQUIREMENTS.md`.

## Play

Double-click `index.html`. It needs no installation, internet or server.
Progress is saved in that browser on that device.

## Tests

```sh
node --test tests/logic.test.js
```

## Files

- `index.html`: the page
- `css/style.css`: the look
- `js/logic.js`: questions, mastery levels, stars (no DOM; unit-tested)
- `js/storage.js`: saving profiles in the browser (localStorage)
- `js/sound.js`: sound effects generated in the browser
- `js/app.js`: screens and game flow
