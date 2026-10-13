// electron-builder `onNodeModuleFile` (electron-builder.yml): true force-includes
// a file the default copier would drop. electron-builder leaves out some
// top-level folders of EVERY package (examples, test, … : app-builder-lib's
// NodeModuleCopyHelper `topLevelExcludedFiles`). three keeps its addons there:
// examples/jsm (GLTFLoader, HDRLoader, EXRLoader, SkeletonUtils, postprocessing
// passes), which the TSX builder's libraries import (@vidtsx/three-assets, n8ao,
// a piece's own `three/examples/jsm/...`). Without it a packaged `check` fails:
// `Could not resolve "three/examples/jsm/postprocessing/Pass.js"`.
// scripts/after-pack-check.cjs fails the build when another library's `exports`
// needs a folder dropped this way: add it here.

const KEEP = [/[\\/]node_modules[\\/]three[\\/]examples(?:[\\/]|$)/];

module.exports = function onNodeModuleFile(file) {
  return KEEP.some((pattern) => pattern.test(file));
};
