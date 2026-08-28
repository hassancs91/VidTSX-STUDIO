import { resolve } from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

const repoRoot = resolve(import.meta.dirname, '../../..');

const MIME = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/**
 * Serves local media over http the same way the app's module-server does
 * (`/asset?path=<absolute>`), because a <video> tag — and, later, a WebCodecs
 * decoder reading byte ranges — cannot use file:// URLs.
 *
 * Range support is not optional here: without it Chromium downloads the whole
 * file before showing a frame, which would make a 2.6 GB 4K original measure
 * the disk instead of the decoder. It is also exactly what @remotion/media's
 * partial-download path needs when T2 swaps the tag in.
 */
function assetServer() {
  return {
    name: 'vidtsx-bench-assets',
    configureServer(server) {
      server.middlewares.use('/asset', (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const filePath = url.searchParams.get('path');
        if (!filePath || !fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }

        const stat = fs.statSync(filePath);
        const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
        const type = MIME[ext] ?? 'application/octet-stream';
        const range = req.headers.range;

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', type);

        if (!range) {
          res.setHeader('Content-Length', String(stat.size));
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m && m[1] ? Number(m[1]) : 0;
        const end = m && m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
        if (start >= stat.size || start > end) {
          res.statusCode = 416;
          res.setHeader('Content-Range', `bytes */${stat.size}`);
          res.end();
          return;
        }

        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        res.setHeader('Content-Length', String(end - start + 1));
        fs.createReadStream(filePath, { start, end }).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  // Mirrors the app's renderer config: esbuild handles JSX, no React plugin.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@shared': resolve(repoRoot, 'src/shared') },
  },
  server: {
    port: 5199,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  plugins: [assetServer()],
});
