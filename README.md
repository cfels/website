# moxiu☆ちゃんねる

Personal homepage and unofficial Lucky☆Star fan site. Plain HTML documents,
real `<frameset>` / `<frame>` navigation, shared CSS, and no package dependencies.

## Run

```sh
bun run dev
```

Open `http://localhost:3000`. Reload after editing a document or stylesheet.
`HOST` and `PORT` can override the default `0.0.0.0:3000` listener.

## Verify and serve production

```sh
bun run check
bun run test
bun run build
bun run start
```

The build copies `static/` to `build/` without transforming the frame markup.
The Bun server supports direct documents, `/donate`, 404s, conditional requests,
and normal asset caching. Alternatively, serve `build/` directly with Caddy or
another static host; use `404.html` as the error document and preserve relative
paths. The old `node build` command has been replaced by `bun run start`.

## Documents and artwork

`static/index.html` contains the three named frames: `header`, `main`, and
`footer`. The top navigation targets `main`; links within a content document
navigate that document. Content pages also work directly. `frames.js` changes
only the frame heights for the two-row phone menu and button strip.

Edit personal content in `home.html`, `profile.html`, `contact.html`,
`links.html`, and `donate/index.html`. `gallery.html` contains the picture corner.
The birthday and age are preserved from the previous site, not calculated.

Original supplied assets remain in `src/lib/assets/`. The production derivatives
in `static/assets/` are committed, so ordinary builds need no image/font tools.
To regenerate them, install ImageMagick and Python's `fonttools` and `brotli`,
then run `python scripts/prepare-assets.py`. Only Comic Sans regular/bold,
Verdana regular, and Tahoma regular are served, as Latin-subset WOFF2 files;
Japanese text uses the browser's system fallback. The small GIF and 88×31
buttons are copied unchanged.

The 51×15 title-bar controls are cropped at native resolution from Lucky☆Star's
[`header_01.gif`](https://www.lucky-ch.com/header_img/header_01.gif), and stored
in `src/lib/assets/buttons/lucky-ch-window-controls.gif`.

The featured character uses `assets/konata_cutout.webp` and the
`featured-character` / `side-cutout` classes. Replacing that transparent image
does not change the frame architecture. Adjust its width if the new artwork
has a substantially different aspect ratio.

`service-worker.js` is a retirement worker for the previous site's installed
worker. It deletes only `uma-` caches, unregisters itself, and reloads its
controlled pages. The new site does not register a service worker; retain this
migration file so returning visitors can leave the old cached frontend.
