// The render bundle server as `remotion-bundler.ts` builds it — the font proxy,
// the `/asset?path=` route with the same extension allowlist, and the bundle
// as static files — plus a log of every asset and font request, which is what
// the harness asserts on.

import express from 'express';
import fs from 'fs';
import path from 'path';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { registerFontProxy } from '../../src/main/services/font-proxy';

const ALLOWED = [
  '.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.mts', '.m2ts',
  '.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.opus',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif',
  '.glb', '.gltf', '.obj', '.fbx',
  '.woff', '.woff2', '.ttf', '.otf',
  '.json', '.txt', '.csv', '.xml', '.md',
];

export interface Hit {
  path: string;
  status: number;
}

export interface VerifyServer {
  url: string;
  assetHits: Hit[];
  fontHits: Hit[];
  setBundle: (bundlePath: string) => void;
  close: () => void;
}

export async function startVerifyServer(): Promise<VerifyServer> {
  const assetHits: Hit[] = [];
  const fontHits: Hit[] = [];
  let bundlePath: string | null = null;
  const app = express();

  app.use('/fonts', (req, res, next) => {
    res.on('finish', () => fontHits.push({ path: String(req.query.u ?? req.url), status: res.statusCode }));
    next();
  });
  registerFontProxy(app);

  app.get('/asset', (req, res) => {
    const filePath = typeof req.query.path === 'string' ? req.query.path : '';
    const status = !filePath
      ? 400
      : !ALLOWED.includes(path.extname(filePath).toLowerCase())
        ? 400
        : !fs.existsSync(filePath)
          ? 404
          : 200;
    assetHits.push({ path: filePath, status });
    if (status !== 200) {
      res.status(status).send('refused');
      return;
    }
    res.sendFile(path.resolve(filePath));
  });

  app.use((req, res, next) => {
    if (bundlePath) express.static(bundlePath)(req, res, next);
    else res.status(404).send('No bundle loaded');
  });

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    assetHits,
    fontHits,
    setBundle: (p) => { bundlePath = p; },
    close: () => server.close(),
  };
}
