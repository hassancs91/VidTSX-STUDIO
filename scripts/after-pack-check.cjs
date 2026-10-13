// electron-builder `afterPack` (electron-builder.yml): every package of the TSX
// builder's library set, and everything it pulls in, must sit in
// app.asar.unpacked, or `check` cannot bundle a piece in the installed app
// (esbuild cannot read app.asar; see scripts/builder-unpack.mjs). Checked by
// name@version at any depth: electron-builder hoists differently from npm's dev
// layout. A folder electron-builder drops from every package (examples, test…)
// must be there too when the package's `exports` points into it
// (scripts/node-module-file.cjs keeps three/examples). Runs before the installer
// is made, so a miss fails the build instead of shipping.

const fs = require('node:fs');
const path = require('node:path');

function resourcesDir(context) {
  if (context.electronPlatformName === 'darwin') {
    return path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources');
  }
  return path.join(context.appOutDir, 'resources');
}

module.exports = async function afterPackCheck(context) {
  const { builderLibraryClosure, installedPackages } = await import('./builder-unpack.mjs');
  const { packages } = builderLibraryClosure(context.packager.projectDir);
  const unpacked = installedPackages(path.join(resourcesDir(context), 'app.asar.unpacked', 'node_modules'));
  const problems = [];
  for (const p of packages) {
    const id = `${p.name}@${p.version}`;
    const dirs = unpacked.get(id);
    if (!dirs) {
      problems.push(`${id} is not unpacked (run node scripts/builder-unpack.mjs --write)`);
      continue;
    }
    for (const folder of p.needs) {
      if (!dirs.every((dir) => fs.existsSync(path.join(dir, folder)))) {
        problems.push(`${id} lost its ${folder}/ folder, which its exports point into (keep it in scripts/node-module-file.cjs)`);
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`after-pack-check: ${problems.length} builder-library problem(s): ${problems.join('; ')}`);
  }
  console.log(`after-pack-check: ok, ${packages.length} builder-library packages unpacked`);
};
