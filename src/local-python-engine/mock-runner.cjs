// Scripted stand-in for resources/pipelines/<id>/runner.py so every engine test runs
// without Python (plan §7 "CI never needs Python"). Invoked exactly like a runner:
//
//   node mock-runner.cjs --request <tmp.json>   (CommonJS so a copy named runner.py runs too)
//
// The request's `mock` field drives it:
//   { script?: Event[]           // events after `ready`; default = a normal 3-stage run
//     delayMs?: number           // pause between events (default 5)
//     noReady?: boolean          // skip the ready line
//     hang?: boolean             // after the script, sleep forever (cancel / timeout tests)
//     exitCode?: number          // exit with this code after the script (default 0)
//     noise?: boolean            // print non-JSON lines to stdout (must be ignored)
//     split?: boolean            // write the result line in two chunks (partial-line parser)
//     stderr?: string            // something to log on stderr
//   }
// A `result` event without outputPath uses request.outputPath and creates that file.
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const reqIndex = args.indexOf('--request');
if (reqIndex < 0 || !args[reqIndex + 1]) {
  process.stdout.write(JSON.stringify({ type: 'error', code: 'bad-request', message: '--request <file> is required' }) + '\n');
  process.exit(1);
}
const request = JSON.parse(fs.readFileSync(args[reqIndex + 1], 'utf8'));
const mock = request.mock ?? {};
const delayMs = typeof mock.delayMs === 'number' ? mock.delayMs : 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (evt) => process.stdout.write(JSON.stringify(evt) + '\n');

const defaultScript = [
  { type: 'stage', name: 'load-model' },
  { type: 'stage', name: 'process' },
  { type: 'progress', stage: 'process', pct: 50 },
  { type: 'progress', stage: 'process', pct: 100 },
  { type: 'stage', name: 'export' },
  { type: 'result', stats: { seconds: 0.01, mock: true, env: { cuda: process.env.CUDA_VISIBLE_DEVICES ?? null, offline: process.env.HF_HUB_OFFLINE ?? null } } },
];

async function main() {
  if (mock.stderr) process.stderr.write(String(mock.stderr) + '\n');
  if (mock.noise) process.stdout.write('some library print()\n{not json\n');
  if (!mock.noReady) {
    emit({ type: 'ready', torch: null, cuda: false, device: 'mock', vramMb: 0, python: 'mock', importSeconds: 0 });
  }
  const script = Array.isArray(mock.script) ? mock.script : defaultScript;
  for (const evt of script) {
    await sleep(typeof evt.delayMs === 'number' ? evt.delayMs : delayMs);
    const { delayMs: _d, ...clean } = evt;
    if (clean.type === 'result') {
      const outputPath = clean.outputPath ?? request.outputPath ?? null;
      if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, 'mock-output');
      }
      const line = JSON.stringify({ ...clean, outputPath, stats: clean.stats ?? {} }) + '\n';
      if (mock.split) {
        const half = Math.floor(line.length / 2);
        process.stdout.write(line.slice(0, half));
        await sleep(10);
        process.stdout.write(line.slice(half));
      } else {
        process.stdout.write(line);
      }
      continue;
    }
    if (clean.type === 'error') {
      emit(clean);
      process.exit(typeof mock.exitCode === 'number' ? mock.exitCode : 1);
    }
    emit(clean);
  }
  if (mock.hang) {
    // Keep the event loop alive until killed.
    setInterval(() => {}, 1000);
    return;
  }
  process.exit(typeof mock.exitCode === 'number' ? mock.exitCode : 0);
}

main();
