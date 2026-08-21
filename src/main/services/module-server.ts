import { logEngine } from '../../logging/log-engine';
import express from 'express';
import { app } from 'electron';

const log = logEngine.createLogger('ModuleServer');
import type { Express, Request, Response } from 'express';
import type { Server } from 'http';
import path from 'path';
import fsSync from 'fs';
import { getVirtualReactModule, getVirtualRemotionModule, getVirtualReactJsxRuntime, getVirtualReactDomModule, getVirtualRemotionNoReactModule, getVirtualRemotionThreeModule } from './virtual-modules';
import { getPreviewHtml } from './preview-html';
import { getToneExtractHtml } from './tone-extract-html';
import { registerFontProxy } from './font-proxy';
import type { TranspileResult } from './tsx-transpiler';
import { getVendorDir, getShotKitDir } from '../utils/paths';
import { bundleKitFromDir } from './kit-bundler';

// Module state
let moduleApp: Express | null = null;
let moduleServer: Server | null = null;
let moduleServerPort: number | null = null;

// Cache for transpiled modules (hash -> code)
const moduleStore = new Map<string, string>();

/**
 * Get the base URL for the module server
 */
export function getModuleServerBaseUrl(): string | null {
  if (moduleServerPort === null) {
    return null;
  }
  return `http://127.0.0.1:${moduleServerPort}`;
}

/**
 * Store a transpiled module for serving
 */
export function storeModule(hash: string, code: string): void {
  moduleStore.set(hash, code);
}

/**
 * Store a transpile result
 */
export function storeTranspileResult(result: TranspileResult): string {
  storeModule(result.hash, result.code);
  return `${getModuleServerBaseUrl()}/modules/${result.hash}.js`;
}

/**
 * Initialize the module server
 */
export async function ensureModuleServer(): Promise<number> {
  if (moduleServerPort !== null && moduleServer !== null) {
    return moduleServerPort;
  }

  return new Promise((resolve, reject) => {
    moduleApp = express();

    // CORS headers for cross-origin module loading
    moduleApp.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');

      // Set JavaScript content-type only for module routes, not /asset, /health, /preview
      const isModuleRoute = req.path.startsWith('/modules/')
        || req.path.startsWith('/virtual/')
        || req.path.startsWith('/vendor/');
      if (isModuleRoute) {
        res.header('Content-Type', 'application/javascript; charset=utf-8');
      }

      // Virtual and user-module routes are generated code — never let the
      // webview cache them across dev-server restarts, or stale bytes mask
      // main-process changes. (Fonts and vendor bundles set their own Cache-
      // Control and are content-addressed, so they're safe to cache.)
      if (req.path.startsWith('/virtual/') || req.path.startsWith('/modules/')) {
        res.header('Cache-Control', 'no-store, must-revalidate');
      }

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // Serve transpiled user modules
    moduleApp.get('/modules/:hash.js', (req: Request, res: Response) => {
      const hash = req.params.hash;
      log.debug(`Request for module: ${hash}`);
      const code = moduleStore.get(hash);

      if (code) {
        log.debug(`Serving module: ${hash}`, { bytes: code.length });
        res.send(code);
      } else {
        log.warn(`Module not found: ${hash}`);
        res.status(404).send(`// Module not found: ${hash}`);
      }
    });

    // Serve virtual module sub-paths (esm.sh appends sub-paths to alias URLs)
    // e.g. alias=react:http://localhost:3200/virtual/react.js
    //   -> import from 'react/jsx-runtime' becomes '/virtual/react.js/jsx-runtime'
    moduleApp.get('/virtual/react.js/jsx-runtime', (_req: Request, res: Response) => {
      log.debug('Serving virtual: react.js/jsx-runtime');
      res.send(getVirtualReactJsxRuntime());
    });

    moduleApp.get('/virtual/react.js/jsx-dev-runtime', (_req: Request, res: Response) => {
      log.debug('Serving virtual: react.js/jsx-dev-runtime');
      res.send(getVirtualReactJsxRuntime());
    });

    moduleApp.get('/virtual/remotion.js/no-react', (_req: Request, res: Response) => {
      log.debug('Serving virtual: remotion.js/no-react');
      res.send(getVirtualRemotionNoReactModule());
    });

    // Serve virtual React module
    moduleApp.get('/virtual/react.js', (_req: Request, res: Response) => {
      log.debug('Serving virtual: react.js');
      res.send(getVirtualReactModule());
    });

    // Serve virtual React JSX runtime
    moduleApp.get('/virtual/react-jsx-runtime.js', (_req: Request, res: Response) => {
      log.debug('Serving virtual: react-jsx-runtime.js');
      res.send(getVirtualReactJsxRuntime());
    });

    // Serve virtual React DOM module
    moduleApp.get('/virtual/react-dom.js', (_req: Request, res: Response) => {
      log.debug('Serving virtual: react-dom.js');
      res.send(getVirtualReactDomModule());
    });

    // Serve virtual Remotion module
    moduleApp.get('/virtual/remotion.js', (_req: Request, res: Response) => {
      log.debug('Serving virtual: remotion.js');
      res.send(getVirtualRemotionModule());
    });

    // Serve virtual @remotion/three shim (wraps ThreeCanvas children in
    // <Suspense fallback={null}> so async children like drei <Text> can't
    // blank the whole scene). Re-exports everything else from the vendor
    // bundle untouched.
    moduleApp.get('/virtual/remotion-three.js', (_req: Request, res: Response) => {
      log.debug('Serving virtual: remotion-three.js');
      res.send(getVirtualRemotionThreeModule());
    });

    // Serve the shot-kit pack as '@vidtsx/kit' (SHOT_QUALITY_DESIGN Q4). The
    // pack is bundled on first request and re-bundled only when its sources
    // change; missing/broken pack → 404 and shots simply can't import it.
    moduleApp.get('/virtual/vidtsx-kit.js', async (_req: Request, res: Response) => {
      log.debug('Serving virtual: vidtsx-kit.js');
      const baseUrl = getModuleServerBaseUrl();
      const bundle = baseUrl
        ? await bundleKitFromDir(path.join(getShotKitDir(), 'core'), baseUrl)
        : null;
      if (bundle) {
        res.send(bundle.code);
      } else {
        res.status(404).send('// @vidtsx/kit is not available (shot-kit pack missing or failed to bundle)');
      }
    });

    // Google Fonts proxy + on-disk cache (see font-proxy.ts).
    registerFontProxy(moduleApp);

    // Serve pre-bundled vendor ESM modules (three, @react-three/*, @remotion/three, ...)
    moduleApp.get('/vendor/:filename', (req: Request, res: Response) => {
      const filename = req.params.filename;
      // Reject anything that isn't a plain .js filename to prevent traversal.
      if (!/^[a-zA-Z0-9._-]+\.js$/.test(filename)) {
        log.warn(`Rejected vendor filename: ${filename}`);
        return res.status(400).send(`// Invalid vendor filename: ${filename}`);
      }
      const filePath = path.join(getVendorDir(), filename);
      if (!fsSync.existsSync(filePath)) {
        log.warn(`Vendor module not found: ${filename}`);
        return res.status(404).send(`// Vendor module not found: ${filename}`);
      }
      log.debug(`Serving vendor: ${filename}`);
      res.sendFile(filePath);
    });

    // Serve external assets (user video/audio files) via HTTP for Remotion preview
    // Remotion's Video component cannot access local files directly
    moduleApp.get('/asset', (req: Request, res: Response) => {
      const filePath = req.query.path as string;
      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).send('Missing or invalid path parameter');
      }

      // Basic security: only serve media files (video, audio, images)
      const ext = path.extname(filePath).toLowerCase();
      const allowedExtensions = [
        '.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.mts', '.m2ts', // video
        '.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.opus',         // audio
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif', // images
      ];
      if (!allowedExtensions.includes(ext)) {
        return res.status(400).send('Invalid file type');
      }

      // Check file exists
      if (!fsSync.existsSync(filePath)) {
        return res.status(404).send('File not found');
      }

      res.sendFile(path.resolve(filePath));
    });

    // Isolated preview page (runs Remotion Player in a separate process via site isolation)
    moduleApp.get('/preview', (_req: Request, res: Response) => {
      res.removeHeader('Content-Type');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.send(getPreviewHtml(moduleServerPort!, !app.isPackaged));
    });

    // Tone.js audio extraction page (renders user component with OfflineContext)
    moduleApp.get('/tone-extract', (_req: Request, res: Response) => {
      res.removeHeader('Content-Type');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(getToneExtractHtml(moduleServerPort!));
    });

    // Health check
    moduleApp.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', modules: moduleStore.size });
    });

    // Find available port starting from 3200
    const tryPort = (port: number): void => {
      moduleServer = moduleApp!.listen(port, '127.0.0.1', () => {
        moduleServerPort = port;
        log.info(`Module server running on port ${port}`);
        resolve(port);
      });

      moduleServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          moduleServer = null;
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    };

    tryPort(3200);
  });
}

/**
 * Clear all stored modules
 */
export function clearModuleStore(): void {
  moduleStore.clear();
}

/**
 * Cleanup on app quit
 */
export function cleanupModuleServer(): void {
  if (moduleServer) {
    moduleServer.close();
    moduleServer = null;
  }
  moduleApp = null;
  moduleServerPort = null;
  moduleStore.clear();
}
