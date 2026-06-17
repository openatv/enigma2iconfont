#!/usr/bin/env node
/**
 * Trims each SVG's viewBox to the actual path bounding box.
 * Removes width/height attributes (not needed for icon fonts).
 * Writes files in-place.
 */

const fs = require("fs");
const path = require("path");
const { svgPathBbox } = require("svg-path-bbox");

const iconsDir = path.resolve(__dirname, "../icons");
const notrimPath = path.resolve(__dirname, "../notrim.lst");

function loadNotrim() {
  if (!fs.existsSync(notrimPath)) return new Set();
  return new Set(
    fs.readFileSync(notrimPath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
  );
}

function findSvgsRecursive(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findSvgsRecursive(full));
    } else if (entry.name.endsWith(".svg")) {
      results.push(path.relative(iconsDir, full));
    }
  }
  return results;
}

// Minimal regex-based SVG parser — handles the simple Material Design icons used here.
function extractPaths(svgContent) {
  const matches = [...svgContent.matchAll(/\sd="([^"]+)"/g)];
  return matches.map((m) => m[1]);
}

function combineBboxes(bboxes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x1, y1, x2, y2] of bboxes) {
    if (x1 < minX) minX = x1;
    if (y1 < minY) minY = y1;
    if (x2 > maxX) maxX = x2;
    if (y2 > maxY) maxY = y2;
  }
  return [minX, minY, maxX, maxY];
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

// Trims a single SVG file in place. Returns true if it changed, false if it
// was already trimmed or had no <path d="..."> to measure.
function trimSvgFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const paths = extractPaths(content);
  if (!paths.length) return false;

  const bboxes = paths.map((d) => svgPathBbox(d));
  const [minX, minY, maxX, maxY] = combineBboxes(bboxes);
  let x = minX, y = minY, w = maxX - minX, h = maxY - minY;

  // Square only extreme outliers, padding the shorter axis symmetrically.
  // A bare ink bbox is fine for the normal (mildly asymmetric) case, but
  // for an inherently thin shape (e.g. "remove"'s horizontal bar) it gives
  // a wildly non-square viewBox; fantasticon's normalize then blows the
  // glyph up far too wide, pushing it outside its cell.
  const MAX_ASPECT_RATIO = 1;
  if (Math.max(w / h, h / w) > MAX_ASPECT_RATIO) {
    const diff = Math.abs(w - h);
    if (w > h) { y -= diff / 2; h = w; } else { x -= diff / 2; w = h; }
  }

  x = round4(x); y = round4(y); w = round4(w); h = round4(h);

  const newViewBox = `${x} ${y} ${w} ${h}`;

  const updated = content
    // Strip a fill on the root <svg> tag only (some Google source SVGs ship
    // a light placeholder fill like "#e3e3e3" that overrides every path
    // without its own fill, making the glyph render gray/white instead of
    // the expected solid black). Per-path fill attributes are left intact.
    .replace(/^(<svg\b[^>]*?)\s+fill="[^"]*"([^>]*>)/, "$1$2")
    .replace(/\swidth="[^"]*"/g, "")
    .replace(/\sheight="[^"]*"/g, "")
    .replace(/viewBox="[^"]*"/, `viewBox="${newViewBox}"`);

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, "utf8");
    return true;
  }
  return false;
}

module.exports = { trimSvgFile, loadNotrim };

if (require.main === module) {
  const files = findSvgsRecursive(iconsDir);
  const noTrim = loadNotrim();
  let changed = 0;

  for (const file of files) {
    // notrim.lst uses the inbox-filename stem: "<category>_<iconname>"
    // For fill icons the stored file is e.g. "google_fill/cancel_fill.svg";
    // strip the trailing "_fill" from the basename so the key matches
    // the inbox stem "google_fill_cancel" (not "google_fill_cancel_fill").
    const dir = path.dirname(file);
    const base = path.basename(file, ".svg");
    const noTrimBase = dir.endsWith("_fill") && base.endsWith("_fill")
      ? base.slice(0, -5) : base;
    const key = `${dir}_${noTrimBase}`;
    if (noTrim.has(key)) {
      console.log(`[skip] ${file.padEnd(28)} (notrim.lst)`);
      continue;
    }

    const filePath = path.join(iconsDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const oldViewBoxMatch = content.match(/viewBox="([^"]*)"/);
    const oldViewBox = oldViewBoxMatch ? oldViewBoxMatch[1] : "(none)";

    let didChange;
    try {
      didChange = trimSvgFile(filePath);
    } catch (err) {
      console.error(`[error] ${file}: ${err.message}`);
      continue;
    }

    if (didChange) {
      const newViewBox = fs.readFileSync(filePath, "utf8").match(/viewBox="([^"]*)"/)[1];
      console.log(`[ok]   ${file.padEnd(28)} ${oldViewBox}  →  ${newViewBox}`);
      changed++;
    } else if (!extractPaths(content).length) {
      console.warn(`[skip] ${file} — no <path d="..."> found`);
    } else {
      console.log(`[--]   ${file.padEnd(28)} unchanged (${oldViewBox})`);
    }
  }

  console.log(`\nDone. ${changed}/${files.length} files updated.`);
}
