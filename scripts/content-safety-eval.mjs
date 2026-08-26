// Content Safety eval harness (NF12, dev-mode only — never ships).
//
// Measures the borderline band's false-positive rate on SFW images from OUR
// generators (CONTENT_SAFETY_DESIGN.md D6), and decides the OR-ensemble
// ship-gate: Marqo (the bundled primary, loaded from resources/content-safety)
// vs Marqo OR image-safety-classifier-xs (downloaded loose into a dev folder —
// never committed, never bundled unless the eval says so).
//
// Usage:
//   node scripts/content-safety-eval.mjs --images <dir> [--xs <xs.onnx>] [--out <report.csv>]
//
// The image dir is treated as ALL-SFW: every block it reports is a false
// positive. NSFW recall relies on the models' published benchmarks + a small
// manual spot-check; no NSFW corpus enters this repo or its tooling (D6).

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const ort = require(path.join(REPO, 'node_modules', 'onnxruntime-node'));
const sharp = require(path.join(REPO, 'node_modules', 'sharp'));

// Frozen band edges under test (src/content-safety-engine/bands.ts).
const HARD = 0.8;
const BORDER = 0.2;
// xs OR-gate flag threshold on p(NSFW)+p(NSFL).
const XS_FLAG = 0.2;
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
}

async function loadMarqo() {
  const dir = path.join(REPO, 'resources', 'content-safety');
  const cfg = JSON.parse(await fs.readFile(path.join(dir, 'model-config.json'), 'utf-8'));
  const session = await ort.InferenceSession.create(path.join(dir, cfg.file), {
    executionProviders: ['cpu'],
  });
  return { session, cfg };
}

async function tensorFor(file, size, normalize) {
  const { data } = await sharp(file)
    .resize(size, size, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const plane = size * size;
  const f32 = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      f32[c * plane + i] = normalize(data[i * 3 + c] / 255, c);
    }
  }
  return new ort.Tensor('float32', f32, [1, 3, size, size]);
}

function softmax(logits) {
  const m = Math.max(...logits);
  const exps = [...logits].map((v) => Math.exp(v - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

function band(p) {
  if (p >= HARD) return 'explicit';
  if (p >= BORDER) return 'borderline';
  return 'pass';
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.images) {
    console.error('Usage: node scripts/content-safety-eval.mjs --images <dir> [--xs <xs.onnx>] [--out <report.csv>]');
    process.exit(1);
  }

  const marqo = await loadMarqo();
  const marqoSize = marqo.cfg.inputSize[1];
  const marqoNorm = (v, c) => (v - marqo.cfg.mean[c]) / marqo.cfg.std[c];

  let xs = null;
  if (args.xs) {
    xs = await ort.InferenceSession.create(path.resolve(args.xs), { executionProviders: ['cpu'] });
    console.log(`ensemble candidate loaded: ${args.xs}`);
  }

  const files = (await fs.readdir(args.images))
    .filter((n) => /\.(png|jpe?g|webp)$/i.test(n))
    .sort()
    .map((n) => path.join(args.images, n));
  if (files.length === 0) {
    console.error(`No images in ${args.images}`);
    process.exit(1);
  }

  const rows = [];
  for (const file of files) {
    const mOut = await marqo.session.run({
      [marqo.cfg.inputName]: await tensorFor(file, marqoSize, marqoNorm),
    });
    const pMarqo = softmax([...mOut[marqo.cfg.outputName].data])[marqo.cfg.nsfwIndex];

    let pXs = null;
    if (xs) {
      const xOut = await xs.run({
        image: await tensorFor(file, 224, (v, c) => (v - IMAGENET_MEAN[c]) / IMAGENET_STD[c]),
      });
      const [nsfl, nsfw] = xOut.probabilities.data; // [NSFL, NSFW, SFW]
      pXs = nsfl + nsfw;
    }

    const mBand = band(pMarqo);
    const xsFlag = pXs !== null ? pXs >= XS_FLAG : null;
    const ensembleBlocked = mBand !== 'pass' || xsFlag === true;
    rows.push({ file: path.basename(file), pMarqo, mBand, pXs, xsFlag, ensembleBlocked });
    console.log(
      `${path.basename(file).padEnd(44)} marqo=${pMarqo.toFixed(4)} ${mBand.padEnd(10)}` +
        (pXs !== null ? ` xs=${pXs.toFixed(4)} ${xsFlag ? 'FLAG' : 'ok'}` : ''),
    );
  }

  const n = rows.length;
  const count = (fn) => rows.filter(fn).length;
  console.log('\n── Summary (all inputs assumed SFW: blocks = false positives) ──');
  console.log(`images: ${n}`);
  console.log(
    `marqo bands @ ${HARD}/${BORDER}: pass=${count((r) => r.mBand === 'pass')} borderline=${count((r) => r.mBand === 'borderline')} explicit=${count((r) => r.mBand === 'explicit')}`,
  );
  console.log(`marqo FP rate: ${((count((r) => r.mBand !== 'pass') / n) * 100).toFixed(1)}%`);
  if (xs) {
    console.log(`xs flags @ ${XS_FLAG}: ${count((r) => r.xsFlag)} (FP rate ${((count((r) => r.xsFlag) / n) * 100).toFixed(1)}%)`);
    console.log(`OR-ensemble blocked: ${count((r) => r.ensembleBlocked)} (FP rate ${((count((r) => r.ensembleBlocked) / n) * 100).toFixed(1)}%)`);
    console.log(`xs-only additions over marqo (added FPs on SFW): ${count((r) => r.mBand === 'pass' && r.xsFlag)}`);
  }
  console.log('\nborderline-edge sweep (marqo FP rate if the 0.2 edge moved):');
  for (const edge of [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]) {
    const fp = count((r) => r.pMarqo >= edge);
    console.log(`  edge ${edge.toFixed(2)}: ${fp}/${n} (${((fp / n) * 100).toFixed(1)}%)`);
  }

  const out = args.out ?? path.join(REPO, '.vidtsx-temp', 'content-safety-eval.csv');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(
    out,
    'file,p_marqo,marqo_band,p_xs,xs_flag,ensemble_blocked\n' +
      rows
        .map((r) => `${r.file},${r.pMarqo.toFixed(6)},${r.mBand},${r.pXs?.toFixed(6) ?? ''},${r.xsFlag ?? ''},${r.ensembleBlocked}`)
        .join('\n') +
      '\n',
  );
  console.log(`\nCSV: ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
