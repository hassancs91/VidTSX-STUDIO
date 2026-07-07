// Upload the 3 release artifacts (latest.yml + .exe + .blockmap) to the R2
// bucket `vidtsx-releases` under the `releases/` prefix, using AWS CLI over
// R2's S3-compatible API. AWS CLI automatically switches to multipart upload
// for files >8 MB, so there is no 300 MiB cap (unlike the R2 dashboard or
// wrangler's `r2 object put`).
//
// ONE-TIME SETUP:
//
//   1. Install AWS CLI v2:
//        Windows:  winget install Amazon.AWSCLI
//        or MSI:   https://awscli.amazonaws.com/AWSCLIV2.msi
//      Verify:  aws --version
//
//   2. Create an R2 API token:
//        Cloudflare dashboard → R2 → "Manage R2 API Tokens" → "Create API Token"
//        Permissions: "Object Read & Write"
//        Specify bucket: vidtsx-releases  (or "Apply to all buckets")
//        TTL: no expiry (or a long one — you'll rotate at your own pace)
//        Click Create. Copy the "Access Key ID" and "Secret Access Key" NOW —
//        the secret is only shown once.
//      Also note your Cloudflare Account ID (top-right of the dashboard or R2
//      overview page — looks like a 32-char hex string).
//
//   3. Put credentials in the project root .env file (gitignored):
//        R2_ACCOUNT_ID=<your-cloudflare-account-id>
//        R2_ACCESS_KEY_ID=<access-key-id-from-step-2>
//        R2_SECRET_ACCESS_KEY=<secret-from-step-2>
//      The script auto-loads .env. Shell env vars (if set) take precedence.
//
// USAGE:
//
//   node scripts/publish-to-r2.mjs
//     → uploads latest.yml + VidTSX-Studio-Setup-{pkg.version}.exe + .blockmap
//       from dist/ using the version in package.json.
//
//   node scripts/publish-to-r2.mjs --from <folder>
//     → uploads the 3 artifacts from <folder> instead of dist/. Useful when
//       you've saved release builds into dist/release-v0.1.0/ etc.
//
//   node scripts/publish-to-r2.mjs --version <v> [--from <folder>]
//     → explicit version override (when package.json doesn't match the build
//       inside <folder>).
//
//   node scripts/publish-to-r2.mjs --delete <version>
//     → deletes the 3 artifacts for <version> from the bucket.

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');

const BUCKET = 'vidtsx-releases';
const PREFIX = 'releases';
const CUSTOM_DOMAIN = 'https://releases.vidtsx.com';

// Load .env from project root so credentials can live in a gitignored file.
// Real shell env vars win over .env (matches dotenv conventions).
function loadDotEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error('Missing R2 credentials. Add these to .env in the project root:');
  console.error('  R2_ACCOUNT_ID=<your-cloudflare-account-id>');
  console.error('  R2_ACCESS_KEY_ID=<access-key-id>');
  console.error('  R2_SECRET_ACCESS_KEY=<secret-access-key>');
  console.error('(Or export them as shell env vars.) See script header for setup.');
  process.exit(1);
}

const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

function artifactFilenames(version) {
  return [
    'latest.yml',
    `VidTSX-Studio-Setup-${version}.exe`,
    `VidTSX-Studio-Setup-${version}.exe.blockmap`,
  ];
}

// Force AWS CLI to skip multipart and use single-shot PutObject. The
// multipart transfer manager has shown silent mid-transfer failures on
// Windows (exits 0 while actually aborting the upload). R2 supports
// single-shot PutObject up to 5 GiB, well above any realistic installer
// size, so multipart adds complexity without benefit here.
const AWS_CONFIG_PATH = join(ROOT, 'scripts', '.aws-r2-config');
writeFileSync(
  AWS_CONFIG_PATH,
  [
    '[default]',
    'region = auto',
    's3 =',
    '    multipart_threshold = 5GB',
    '    max_concurrent_requests = 2',
    '',
  ].join('\n')
);

// shell: true is required on Windows for Node 22+ to spawn aws.cmd
// (Node's CVE-2024-27980 mitigation refuses to run .cmd/.bat without shell).
function aws(args, { captureOutput = false } = {}) {
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY: SECRET_KEY,
    AWS_DEFAULT_REGION: 'auto',
    AWS_REGION: 'auto',
    AWS_EC2_METADATA_DISABLED: 'true',
    AWS_CONFIG_FILE: AWS_CONFIG_PATH,
  };
  const res = spawnSync('aws', args, {
    stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    cwd: ROOT,
    env,
    encoding: 'utf8',
    shell: true,
  });
  if (res.error && res.error.code === 'ENOENT') {
    console.error('Could not find aws on PATH. Install AWS CLI v2:');
    console.error('  winget install Amazon.AWSCLI');
    process.exit(1);
  }
  if (res.status !== 0) {
    if (captureOutput && res.stderr) console.error(res.stderr);
    console.error(`\naws ${args.join(' ')} failed with exit code ${res.status}`);
    if (res.signal) console.error(`(killed by signal: ${res.signal})`);
    process.exit(1);
  }
  return res;
}

// Confirm the object actually exists on R2 with non-zero size. AWS CLI can
// exit 0 on a multipart upload that silently aborted mid-stream, so we must
// verify the result independently rather than trust the exit code alone.
function verifyObject(key, expectedSize) {
  const res = aws(
    ['s3api', 'head-object', '--bucket', BUCKET, '--key', key, '--endpoint-url', ENDPOINT],
    { captureOutput: true }
  );
  let meta;
  try {
    meta = JSON.parse(res.stdout);
  } catch {
    console.error(`\nVerification failed: could not parse head-object response for ${key}`);
    process.exit(1);
  }
  const actualSize = Number(meta.ContentLength);
  if (actualSize !== expectedSize) {
    console.error(
      `\nVerification failed for ${key}: expected ${expectedSize} bytes, got ${actualSize}`
    );
    process.exit(1);
  }
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

function contentTypeFor(name) {
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'text/yaml';
  if (name.endsWith('.exe')) return 'application/octet-stream';
  if (name.endsWith('.blockmap')) return 'application/octet-stream';
  return 'application/octet-stream';
}

function doUpload(version, sourceDir) {
  const files = artifactFilenames(version);

  console.log(`\nPublishing v${version} from ${sourceDir} → ${BUCKET}/${PREFIX}/`);
  console.log(`Endpoint: ${ENDPOINT}\n`);

  for (const name of files) {
    const local = join(sourceDir, name);
    if (!existsSync(local)) {
      console.error(`Missing: ${local}`);
      console.error(`Did you run 'npm run build:win' for v${version}?`);
      process.exit(1);
    }
  }

  for (const name of files) {
    const local = join(sourceDir, name);
    const expectedSize = statSync(local).size;
    const key = `${PREFIX}/${name}`;
    const ct = contentTypeFor(name);
    console.log(`  → ${name} (${formatBytes(expectedSize)})`);
    aws([
      's3',
      'cp',
      local,
      `s3://${BUCKET}/${key}`,
      '--endpoint-url',
      ENDPOINT,
      '--content-type',
      ct,
    ]);
    verifyObject(key, expectedSize);
    console.log(`    ✓ verified ${name} on R2`);
  }

  console.log(`\nDone. Verify with:`);
  console.log(`  curl ${CUSTOM_DOMAIN}/${PREFIX}/latest.yml`);
}

function doCleanMultipart() {
  console.log(`\nListing orphaned multipart uploads in ${BUCKET}...\n`);

  const res = aws(
    [
      's3api',
      'list-multipart-uploads',
      '--bucket',
      BUCKET,
      '--endpoint-url',
      ENDPOINT,
    ],
    { captureOutput: true }
  );

  let parsed = {};
  const stdout = (res.stdout || '').trim();
  if (stdout) {
    try {
      parsed = JSON.parse(stdout);
    } catch {
      console.error('Could not parse list-multipart-uploads response:');
      console.error(stdout);
      process.exit(1);
    }
  }

  const uploads = parsed.Uploads || [];
  if (uploads.length === 0) {
    console.log('No orphaned multipart uploads found. Nothing to clean.');
    return;
  }

  console.log(`Found ${uploads.length} orphaned upload(s):`);
  for (const u of uploads) {
    console.log(`  - ${u.Key}  (UploadId: ${u.UploadId}, started ${u.Initiated})`);
  }
  console.log('');

  for (const u of uploads) {
    console.log(`  x aborting ${u.Key}`);
    aws([
      's3api',
      'abort-multipart-upload',
      '--bucket',
      BUCKET,
      '--key',
      u.Key,
      '--upload-id',
      u.UploadId,
      '--endpoint-url',
      ENDPOINT,
    ]);
  }

  console.log(`\nAborted ${uploads.length} orphaned upload(s).`);
}

function doDelete(version) {
  const files = artifactFilenames(version);

  console.log(`\nDeleting v${version} artifacts from ${BUCKET}/${PREFIX}/\n`);

  for (const name of files) {
    const key = `${PREFIX}/${name}`;
    console.log(`  x ${name}`);
    aws([
      's3',
      'rm',
      `s3://${BUCKET}/${key}`,
      '--endpoint-url',
      ENDPOINT,
    ]);
  }

  console.log(`\nDeleted v${version} artifacts.`);
}

function parseArgs(argv) {
  const out = { mode: 'upload', version: null, from: null, deleteVersion: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--delete') {
      out.mode = 'delete';
      out.deleteVersion = argv[++i];
    } else if (a === '--clean-multipart') {
      out.mode = 'clean-multipart';
    } else if (a === '--from') {
      out.from = argv[++i];
    } else if (a === '--version') {
      out.version = argv[++i];
    } else {
      console.error(`Unknown argument: ${a}`);
      printUsage();
      process.exit(1);
    }
  }
  return out;
}

function printUsage() {
  console.error('Usage:');
  console.error('  node scripts/publish-to-r2.mjs                              # upload pkg.version from dist/');
  console.error('  node scripts/publish-to-r2.mjs --from <folder>              # upload pkg.version from <folder>');
  console.error('  node scripts/publish-to-r2.mjs --version <v> --from <dir>   # explicit version + folder');
  console.error('  node scripts/publish-to-r2.mjs --delete <version>           # delete version artifacts');
  console.error('  node scripts/publish-to-r2.mjs --clean-multipart             # abort orphaned multipart uploads');
}

const parsed = parseArgs(process.argv.slice(2));

if (parsed.mode === 'delete') {
  if (!parsed.deleteVersion) {
    console.error('--delete requires a version argument');
    printUsage();
    process.exit(1);
  }
  doDelete(parsed.deleteVersion);
} else if (parsed.mode === 'clean-multipart') {
  doCleanMultipart();
} else {
  const version = parsed.version ?? pkg.version;
  const sourceDir = parsed.from ? resolve(parsed.from) : DIST;
  doUpload(version, sourceDir);
}
