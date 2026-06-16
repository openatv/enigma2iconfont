#!/usr/bin/env node
/**
 * Imports SVGs dropped into inbox/ into the matching icons/ subfolder,
 * trims their viewBox, and registers a codepoint for each new icon. Asks
 * for confirmation before every import; if the icon name already exists,
 * asks whether to overwrite (the codepoint is kept unchanged either way).
 *
 * Inbox filename schema: <category>_<name>.svg
 *   google_fill_<name>.svg  →  icons/google_fill/<name>_fill.svg
 *   google_<name>.svg       →  icons/google/<name>.svg
 *   other_fill_<name>.svg   →  icons/other_fill/<name>_fill.svg
 *   other_<name>.svg        →  icons/other/<name>.svg
 *
 * The "_fill" suffix is appended to the icon's identity (not just the
 * folder): fantasticon's getIconId is basename-only, so a fill variant
 * must not share a basename with its outline counterpart in the other
 * folder of the same pair (e.g. "cancel" vs "cancel_fill").
 *
 * google / google_fill share the E000+ codepoint range, other / other_fill
 * share the F000+ range (see build.md). Existing codepoints are never
 * reassigned — re-importing a known name only replaces the SVG file.
 */

const fs = require("fs");
const path = require("path");
const readline = require("node:readline/promises");
const { trimSvgFile } = require("./trim-svgs");

const root = path.resolve(__dirname, "..");
const inboxDir = path.join(root, "inbox");
const iconsDir = path.join(root, "icons");
const codepointsPath = path.join(root, "codepoints.json");

// Longest/most specific prefixes first, so "google_fill_x" isn't parsed as
// category "google" with name "fill_x".
const CATEGORIES = ["google_fill", "other_fill", "google", "other"];

const RANGES = {
  google: [0xe000, 0xefff],
  google_fill: [0xe000, 0xefff],
  other: [0xf000, 0xffff],
  other_fill: [0xf000, 0xffff],
};

function parseFilename(filename) {
  const base = filename.replace(/\.svg$/i, "");
  for (const category of CATEGORIES) {
    if (base.startsWith(`${category}_`)) {
      const rawName = base.slice(category.length + 1);
      if (!rawName) continue;
      const name = category.endsWith("_fill") ? `${rawName}_fill` : rawName;
      return { category, name };
    }
  }
  return null;
}

function nextCodepoint(codepoints, category) {
  const [min, max] = RANGES[category];
  const used = [...codepoints.values()].filter((v) => v >= min && v <= max);
  const next = (used.length ? Math.max(...used) : min - 1) + 1;
  if (next > max) {
    throw new Error(`codepoint range exhausted for "${category}" (max 0x${max.toString(16)})`);
  }
  return next;
}

// codepoints.json is read/written as a Map, not a plain object: JS objects
// always enumerate integer-like string keys (e.g. "123") before all other
// keys regardless of insertion order, which would silently reorder the file
// on every run. Map preserves true insertion order for any key type.
function readCodepoints(text) {
  const map = new Map();
  const re = /"((?:[^"\\]|\\.)*)"\s*:\s*(-?\d+)/g;
  let m;
  while ((m = re.exec(text))) {
    map.set(JSON.parse(`"${m[1]}"`), parseInt(m[2], 10));
  }
  return map;
}

function writeCodepoints(map) {
  const lines = [...map.entries()].map(([k, v]) => `  ${JSON.stringify(k)}: ${v}`);
  return `{\n${lines.join(",\n")}\n}\n`;
}

function findExistingIconPaths() {
  const map = new Map(); // name -> absolute path
  for (const category of Object.keys(RANGES)) {
    const dir = path.join(iconsDir, category);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".svg")) map.set(f.slice(0, -4), path.join(dir, f));
    }
  }
  return map;
}

async function confirm(rl, question, defaultYes) {
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = (await rl.question(`${question} ${suffix} `)).trim().toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes" || answer === "j" || answer === "ja";
}

async function main() {
  if (!fs.existsSync(inboxDir)) {
    console.error(`inbox/ not found at ${inboxDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(inboxDir).filter((f) => f.toLowerCase().endsWith(".svg"));
  if (!files.length) {
    console.log("inbox/ is empty — nothing to import.");
    return;
  }

  const codepoints = readCodepoints(fs.readFileSync(codepointsPath, "utf8"));
  const existingPaths = findExistingIconPaths();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let imported = 0;
  let updated = 0;
  let declined = 0;
  let skipped = 0;

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) {
      console.warn(`[skip]     ${file} — expected <category>_<name>.svg (google_fill, google, other_fill, other)`);
      skipped++;
      continue;
    }

    const { category, name } = parsed;
    const destDir = path.join(iconsDir, category);
    const destPath = path.join(destDir, `${name}.svg`);
    const srcPath = path.join(inboxDir, file);

    const priorPath = existingPaths.get(name);
    const isKnown = codepoints.has(name);

    let proceed;
    if (priorPath) {
      const rel = path.relative(root, priorPath);
      const cpHex = codepoints.get(name).toString(16).toUpperCase();
      proceed = await confirm(rl, `[exists]   ${rel} existiert bereits — mit ${file} überschreiben (Codepoint bleibt 0x${cpHex})?`, false);
    } else {
      const previewCp = nextCodepoint(codepoints, category);
      proceed = await confirm(rl, `[import]   ${file} → icons/${category}/${name}.svg (neuer Codepoint 0x${previewCp.toString(16).toUpperCase()})?`, true);
    }

    if (!proceed) {
      console.log(`[declined] ${file} — bleibt in inbox/`);
      declined++;
      continue;
    }

    fs.mkdirSync(destDir, { recursive: true });
    fs.renameSync(srcPath, destPath);
    trimSvgFile(destPath);

    // If the icon previously lived in a different category folder, drop the
    // stale copy so fantasticon's getIconId (basename-based) never sees two
    // files sharing the same icon name.
    if (priorPath && priorPath !== destPath && fs.existsSync(priorPath)) {
      fs.unlinkSync(priorPath);
      console.log(`[moved]    removed stale ${path.relative(root, priorPath)}`);
    }
    existingPaths.set(name, destPath);

    if (isKnown) {
      console.log(`[update]   ${file} → icons/${category}/${name}.svg (codepoint unchanged: 0x${codepoints.get(name).toString(16).toUpperCase()})`);
      updated++;
    } else {
      const cp = nextCodepoint(codepoints, category);
      codepoints.set(name, cp);
      console.log(`[new]      ${file} → icons/${category}/${name}.svg (codepoint: 0x${cp.toString(16).toUpperCase()})`);
      imported++;
    }

    // Persist after every single file, not just at the end: if stdin closes
    // (e.g. Ctrl-D) while a later question is pending, rl.question() never
    // resolves and the process can exit mid-loop — already-renamed files
    // must not end up missing a codepoint entry.
    fs.writeFileSync(codepointsPath, writeCodepoints(codepoints), "utf8");
  }

  rl.close();

  console.log(`\nDone. ${imported} new, ${updated} updated, ${declined} declined, ${skipped} skipped.`);
  if (imported || updated) {
    console.log("Next: npm run build");
  }
}

main();
