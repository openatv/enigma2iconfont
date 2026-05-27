const codepoints = require("./codepoints.json");

module.exports = {
  inputDir: "./icons",
  outputDir: "./dist/fonts",

  name: "my-icons",

  prefix: "icon",

  fontTypes: ["woff2", "woff", "ttf"],

  assetTypes: ["css"],

  codepoints: codepoints,

  normalize: true,

  fontHeight: 1000,

  descent: 200
};