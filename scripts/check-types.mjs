// Type-error baseline gate. The repo carries a known set of pre-existing type
// errors; this script fails only when a change ADDS errors beyond the recorded
// baseline. Lower the numbers here whenever a change reduces the count — the
// baseline is a ceiling that only ratchets down.
import { execSync } from 'node:child_process';

const BASELINE = {
  'tsconfig.web.check.json': 27,
  'tsconfig.node.check.json': 32,
};

let failed = false;

for (const [config, baseline] of Object.entries(BASELINE)) {
  let output = '';
  try {
    output = execSync(`npx tsc -p ${config} --noEmit`, { encoding: 'utf-8' });
  } catch (err) {
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  const count = (output.match(/error TS/g) ?? []).length;
  const status = count > baseline ? 'FAIL' : 'ok';
  console.log(`${config}: ${count} errors (baseline ${baseline}) ${status}`);
  if (count > baseline) {
    failed = true;
    // Show the errors to make the regression easy to find
    console.log(output.trim());
  }
}

process.exit(failed ? 1 : 0);
