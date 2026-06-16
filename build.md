# enigma2iconfont — Build Reference

## Toolchain

[fantasticon](https://github.com/tancredi/fantasticon) converts SVG files into a web font (woff2 / woff / ttf) plus a CSS file.

| File | Purpose |
|---|---|
| `fantasticonrc.cjs` | Build configuration (font name, metrics, codepoints) |
| `codepoints.json` | Unicode codepoint assignments per icon |
| `icons/` | Source SVGs (filename = icon name), split into subfolders by provenance — see below |
| `source.lst` | Provenance list: original GitHub URL → local path, for icons sourced from Google Material Symbols |
| `dist/fonts/` | Generated font files + CSS |
| `dist/demo.html` | Visual preview of all icons |

### Icon folders

`icons/` is split into four subfolders. `fantasticon` and `trim-svgs.js` both recurse into
all of them — the subfolder only documents where an icon came from, it has no effect on the
build itself.

| Folder | Contents | Codepoint range |
|---|---|---|
| `icons/google/` | Outline icons sourced from Google Material Symbols (Sharp, weight 400) | `E000`+ |
| `icons/google_fill/` | Filled variants from the same Material Symbols set | `E000`+ |
| `icons/other/` | Custom / non-Google icons (no Material Symbols equivalent) | `F000`+ |
| `icons/other_fill/` | Filled variants of custom icons | `F000`+ |

```
npm run build          # full build: clean + font + demo
npm run build:font     # font files only (no CSS generated — enigma2 uses the font directly)
npm run build:demo     # demo.html only (CSS is embedded inline, no separate file)
npm run clean          # remove dist/fonts/ and dist/demo.html
npm run trim-svgs      # trim each SVG viewBox to its actual path bounding box
```

---

## Font Metrics

A font works in **font units** within a coordinate system called the **em square**.
The em square is the box into which every glyph is drawn.

```
┌─────────────────────────────┐  ← top of em square
│                             │
│   ascent = fontHeight       │  ascent: space above the baseline
│         − descent           │
│                             │
├─────────────────────────────┤  ← baseline
│                             │
│   descent                   │  descent: space below the baseline
│                             │
└─────────────────────────────┘  ← bottom of em square
```

**Current values in `fantasticonrc.cjs`:**

| Parameter    | Value | Meaning |
|---|---|---|
| `fontHeight` | 1000 | Total em square size in font units |
| `descent`    | 0    | Space below baseline — 0 means no descender gap |
| `normalize`  | true | Scale SVG paths to fill the full em square |

With `normalize: true` fantasticon scales each SVG so it fills the entire em square exactly.
The viewBox of the SVG determines what counts as the "content" to fill.

---

## The Padding Problem

### Three sources of unwanted whitespace

**1. `descent` — space reserved below the baseline**
The browser renders icons inline like text. The `descent` metric reserves space for descending letters (g, p, y). For an icon font this is dead space. Setting `descent: 0` eliminates it.

**2. SVG viewBox whitespace**
If the paths inside an SVG do not reach the edges of the viewBox, that gap becomes part of the glyph. Example:

```xml
<!-- bad: paths start 10 px inside a 200 px box → ~5 % padding on each side -->
<svg viewBox="0 0 200 200"><path d="M10 20 L190 180 ..."/></svg>

<!-- good: viewBox clipped to the exact path bounding box -->
<svg viewBox="10 20 180 160"><path d="M10 20 L190 180 ..."/></svg>
```

**3. CSS line-height**
Even `line-height: 1` does not always eliminate spacing — the browser calculates line height from the font metrics, not the glyph bounding box.

---

## Minimising Padding

### SVG trimming (most important step)

Run `npm run trim-svgs` after adding or modifying any SVG.
The script (`scripts/trim-svgs.js`) reads every path's bounding box and updates the
`viewBox` attribute in-place. `width` and `height` attributes are removed (they are not
needed for icon fonts).

With trimmed viewBoxes and `normalize: true`, the icon fills the font cell with zero padding from the SVG side. The remaining visual margin — if any — comes only from sub-pixel anti-aliasing in the renderer.

### Zero descent

`descent: 0` in `fantasticonrc.cjs` eliminates the descender gap entirely.
This is the correct setting for a pure icon font.

### Higher fontHeight for detailed icons

Increasing `fontHeight` raises coordinate precision in the generated Bezier curves:

```
fontHeight: 1000  →  integer coordinates 0–1000
fontHeight: 4096  →  integer coordinates 0–4096  (4× more precision)
```

For simple broadcast-style icons 1000 is sufficient.
For icons with very fine detail or thin strokes, use 4096.

### Inspect generated font metrics

```bash
# requires: pip install fonttools
ttx -t OS/2 -t hhea dist/fonts/enigma2icons.ttf

# or via Python:
python3 -c "
from fontTools.ttLib import TTFont
f = TTFont('dist/fonts/enigma2icons.ttf')
print('ascent :', f['OS/2'].sTypoAscender)
print('descent:', f['OS/2'].sTypoDescender)
print('unitsPerEm:', f['head'].unitsPerEm)
"
```

---

## DPI and Resolution

SVGs are resolution-independent vectors, but the font coordinate system has finite precision.

At `fontHeight: 1000` the maximum Bezier control-point resolution on the Y axis is 1000 units.
For icons rendered at large sizes (e.g. full-screen splash graphics), curves may look
slightly faceted. Raising `fontHeight` to 4096 multiplies available precision fourfold
with no other trade-offs.

---

## Adding Icons

1. Place the SVG in the matching subfolder under `icons/` (`google/`, `google_fill/`, `other/`,
   or `other_fill/` — see Icon folders above) — filename becomes the icon name
   (no spaces, lowercase, underscores OK).
2. If sourced from Google Material Symbols, add a row to `source.lst` (GitHub URL → local path).
3. Run `npm run trim-svgs` to clip the viewBox.
3. Add a codepoint entry to `codepoints.json` — **always append, never change existing values**:
   ```json
   "new-icon": 59660
   ```
   Current highest codepoint: `warning: 59659` → next free: `59660`.
4. Run `npm run build`.

> **Never reassign codepoints.** Any skin or UI that references a glyph by its Unicode
> value will break if the codepoint changes.

---

## Current Icon Set

| Name | Codepoint | Unicode |
|---|---|---|
| mute | 59648 | `` |
| volume-plus | 59649 | `` |
| volume-minus | 59650 | `` |
| 4k | 59651 | `` |
| hd | 59652 | `` |
| fhd | 59653 | `` |
| dolby | 59654 | `` |
| subtitle | 59655 | `` |
| optional-channels | 59656 | `` |
| error | 59657 | `` |
| info | 59658 | `` |
| warning | 59659 | `` |
