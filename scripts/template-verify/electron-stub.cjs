// Stands in for `electron` when scripts/template-verify.mjs bundles the app's
// main-process services. Everything userData-shaped (font cache, logs) lands
// in the script's temp folder, never in the real app's profile.
const path = require('path');
const fs = require('fs');

const repo = process.env.VIDTSX_REPO_ROOT;
const temp = process.env.VIDTSX_VERIFY_TEMP;
const { version } = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf-8'));

module.exports = {
  app: {
    getPath: (name) => path.join(temp, name === 'userData' ? 'userData' : `path-${name}`),
    getAppPath: () => repo,
    getVersion: () => version,
    isPackaged: false,
  },
};
