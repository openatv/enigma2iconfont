const codepoints = require("./codepoints.json");

module.exports = {
  inputDir: "./icons",
  outputDir: "./dist/fonts",
  name: "enigma2icons",

  prefix: "ei",

  fontTypes: ["woff2", "woff", "ttf"],
  assetTypes: [],              // no CSS output — enigma2 uses the font directly via codepoints

  codepoints: codepoints,

  // icons/ is split into subfolders (google/, google_fill/, other/, other_fill/) purely to
  // document provenance. Without this override, fantasticon derives the icon id from the
  // full relative path (e.g. "google-volume_off"), which no longer matches codepoints.json
  // and silently falls back to auto-numbered codepoints instead of the ones we assigned.
  getIconId: ({ basename }) => basename,

  normalize: true,

  fontHeight: 1000,
  descent: 0,
};
