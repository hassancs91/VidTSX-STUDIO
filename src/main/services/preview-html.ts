/**
 * Generates the self-contained HTML page for the isolated preview webview.
 *
 * This page runs in a separate renderer process (Electron webview = guaranteed
 * process isolation) and hosts the Remotion Player for user TSX compositions.
 *
 * Communication with the parent uses the previewBridge API exposed by the
 * preview-preload.ts script via contextBridge.
 *
 * React/Remotion/Player are loaded from a single vendor bundle
 * (preview-runtime.js) to guarantee shared module instances.
 */

export function getPreviewHtml(port: number, isDev: boolean): string {
  const baseUrl = `http://127.0.0.1:${port}`;
  // Unique per request so we can verify the webview isn't serving a cached
  // version of the HTML when debugging preview-quality wiring.
  const htmlBuildId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1920" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #0a0a0e; }
    #status {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      color: #888; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; z-index: 10; background: #0a0a0e;
    }
    #status.hidden { display: none; }
    .spinner {
      width: 16px; height: 16px; border: 2px solid #555; border-top-color: #7c6ef6;
      border-radius: 50%; animation: spin 0.6s linear infinite; margin-bottom: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="status">
    <div style="text-align:center">
      <div class="spinner" style="margin:0 auto 8px"></div>
      <div>Loading preview runtime...</div>
    </div>
  </div>

  <script type="module">
    const BASE_URL = ${JSON.stringify(baseUrl)};
    const HTML_BUILD_ID = ${JSON.stringify(htmlBuildId)};
    const DIAG_ENABLED = ${isDev ? 'true' : 'false'};
    if (DIAG_ENABLED) console.log('[preview] html build id', HTML_BUILD_ID);
    const statusEl = document.getElementById('status');
    const rootEl = document.getElementById('root');

    // ── Communication bridge ──────────────────────────────────────────────
    const send = window.previewBridge
      ? function(msg) { window.previewBridge.sendToParent(msg); }
      : function(msg) { window.parent.postMessage(msg, '*'); };

    // ── Quality-aware overrides ──────────────────────────────────────────
    // Must run BEFORE the preview-runtime bundle loads. currentScale is
    // mutated later by load / setPreviewQuality.
    let currentScale = 0.5; // 0.5 = Low, 0.75 = Medium, 1 = High
    const BASE_DPR = window.devicePixelRatio || 1;

    // (a) window.devicePixelRatio override — helps any WebGL lib that reads it
    // directly (e.g. raw Three.js, Babylon). R3F ignores this because its
    // default dpr is a range [1, 2] chosen adaptively, so (b) below is the
    // load-bearing part.
    try {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        get: function() { return BASE_DPR * currentScale; },
      });
    } catch (err) {
      console.warn('[preview] devicePixelRatio override failed:', err);
    }

    // (b) Canvas + WebGL patch — the universal lever that works for any
    // WebGL renderer (Three.js, Babylon, raw WebGL). We scale BOTH:
    //   - canvas.width / canvas.height setters → smaller drawing buffer
    //   - gl.viewport() / gl.scissor() calls   → matching smaller viewport
    // Scaling both together keeps Three.js's (or any renderer's) internal
    // math consistent with the actual buffer, so there's no crop.
    // Three.js's setPixelRatio is defined on instances (not the prototype),
    // so we can't reach it via Renderer.prototype — this lower-level patch
    // bypasses that entirely.
    let canvasPatchStatus = 'pending';
    let viewportCallCount = 0;
    let viewportLastArgs = null;
    try {
      const canvasProto = HTMLCanvasElement.prototype;
      const widthDesc = Object.getOwnPropertyDescriptor(canvasProto, 'width');
      const heightDesc = Object.getOwnPropertyDescriptor(canvasProto, 'height');
      const origGetContext = canvasProto.getContext;
      const webglCanvases = new WeakSet();

      canvasProto.getContext = function(contextType) {
        const isGL =
          contextType === 'webgl' ||
          contextType === 'webgl2' ||
          contextType === 'experimental-webgl';
        if (isGL) {
          webglCanvases.add(this);
        }
        const ctx = origGetContext.apply(this, arguments);
        if (isGL && ctx && !ctx.__vidtsxPatched) {
          ctx.__vidtsxPatched = true;
          const origViewport = ctx.viewport.bind(ctx);
          const origScissor = ctx.scissor.bind(ctx);
          ctx.viewport = function(x, y, w, h) {
            viewportCallCount += 1;
            const sx = Math.round(x * currentScale);
            const sy = Math.round(y * currentScale);
            const sw = Math.max(1, Math.round(w * currentScale));
            const sh = Math.max(1, Math.round(h * currentScale));
            viewportLastArgs = { req: [x, y, w, h], applied: [sx, sy, sw, sh] };
            return origViewport(sx, sy, sw, sh);
          };
          ctx.scissor = function(x, y, w, h) {
            return origScissor(
              Math.round(x * currentScale),
              Math.round(y * currentScale),
              Math.max(1, Math.round(w * currentScale)),
              Math.max(1, Math.round(h * currentScale)),
            );
          };
        }
        return ctx;
      };

      Object.defineProperty(canvasProto, 'width', {
        configurable: true,
        get: widthDesc.get,
        set: function(value) {
          if (webglCanvases.has(this) && currentScale < 1) {
            widthDesc.set.call(this, Math.max(1, Math.round(value * currentScale)));
          } else {
            widthDesc.set.call(this, value);
          }
        },
      });

      Object.defineProperty(canvasProto, 'height', {
        configurable: true,
        get: heightDesc.get,
        set: function(value) {
          if (webglCanvases.has(this) && currentScale < 1) {
            heightDesc.set.call(this, Math.max(1, Math.round(value * currentScale)));
          } else {
            heightDesc.set.call(this, value);
          }
        },
      });

      canvasPatchStatus = 'installed';
      if (DIAG_ENABLED) console.log('[preview] canvas + gl.viewport patch installed');
    } catch (err) {
      canvasPatchStatus = 'failed: ' + (err && err.message || err);
      console.warn('[preview] canvas scaling patch failed:', err);
    }

    // ── Step 1: Load preview runtime (single vendor bundle) ───────────────
    let runtime;
    try {
      runtime = await import(BASE_URL + '/vendor/preview-runtime.js');
    } catch (err) {
      statusEl.innerHTML = '<div style="color:#ff4444;padding:20px;font-family:monospace;white-space:pre-wrap">'
        + 'Failed to load preview runtime:\\n' + (err.message || err) + '</div>';
      send({ type: 'error', error: 'Failed to load preview runtime: ' + (err.message || err) });
      throw err;
    }

    const { React, ReactDOM, createRoot, jsxRuntime, Remotion, RemotionNoReact, Player } = runtime;

    // ── Step 2: Set window globals for virtual modules ────────────────────
    // Must run BEFORE loading /vendor/three.js below — that bundle's shim
    // transitively imports /vendor/react-three-fiber.js which needs React
    // via window.__VIDTSX_REACT__ at module-init time.
    window.__VIDTSX_REACT__ = React;
    window.__VIDTSX_REACT_DOM__ = ReactDOM;
    window.__VIDTSX_JSX_RUNTIME__ = jsxRuntime;
    window.__VIDTSX_REMOTION__ = Remotion;
    window.__VIDTSX_REMOTION_NO_REACT__ = RemotionNoReact;

    // ── Step 2b: Patch Three.js setPixelRatio ─────────────────────────────
    // The load-bearing piece of the preview-quality feature. All compositions
    // share a single THREE instance at /vendor/three.js (see build-vendor.mjs
    // EXTERNAL_MAP), and ESM is deduped by URL, so patching the prototype
    // here cascades to every composition's WebGLRenderer. We scale whatever
    // pixel ratio Three.js is asked to use (by R3F, or user code) by
    // currentScale — Three.js then consistently shrinks canvas.width AND
    // sets gl.viewport to match, so there's no viewport mismatch (no crop).
    let threePatchStatus = 'pending';
    let spxrCallCount = 0;
    let spxrLastRequested = null;
    let spxrLastApplied = null;
    try {
      const THREE = await import(BASE_URL + '/vendor/three.js');
      const Renderer = THREE && THREE.WebGLRenderer;
      if (Renderer && Renderer.prototype && typeof Renderer.prototype.setPixelRatio === 'function') {
        const origSetPixelRatio = Renderer.prototype.setPixelRatio;
        Renderer.prototype.setPixelRatio = function(value) {
          const requested = typeof value === 'number' ? value : 1;
          const applied = requested * currentScale;
          spxrCallCount += 1;
          spxrLastRequested = requested;
          spxrLastApplied = applied;
          if (DIAG_ENABLED) console.log('[preview] setPixelRatio #' + spxrCallCount + ' requested=' + requested + ' applied=' + applied);
          return origSetPixelRatio.call(this, applied);
        };
        threePatchStatus = 'installed';
        if (DIAG_ENABLED) console.log('[preview] THREE.WebGLRenderer.setPixelRatio patched for quality scaling');
      } else {
        threePatchStatus = 'no-setPixelRatio';
        console.warn('[preview] THREE.WebGLRenderer.setPixelRatio not found — quality scaling inactive for three');
      }
    } catch (err) {
      threePatchStatus = 'load-failed: ' + (err && err.message || err);
      console.warn('[preview] failed to load/patch /vendor/three.js:', err);
    }

    // ── Step 3: Preview app state ─────────────────────────────────────────
    let playerRef = null;
    let currentConfig = null;
    let currentInputProps = null;
    let currentLoop = false;
    let currentRate = 1;
    let playerKey = 0; // bumped to force a full Player re-mount so R3F re-reads dpr
    let reactRoot = null;
    let currentComponent = null;

    // ── Step 4: Render helper ─────────────────────────────────────────────
    function renderPlayer(Component, config) {
      currentComponent = Component;
      currentConfig = config;
      if (!reactRoot) {
        reactRoot = createRoot(rootEl);
      }
      doRender();
    }

    function doRender() {
      if (!currentComponent || !currentConfig) return;
      const h = React.createElement;
      const config = currentConfig;
      // Preview quality is applied via window.devicePixelRatio (see override
      // at top of script). The Player renders at native composition dims.
      // playerKey forces a full re-mount on quality change so R3F re-measures
      // with the new dpr — it reads dpr once at Canvas mount.
      reactRoot.render(h(Player, {
        key: playerKey,
        ref: function(ref) {
          playerRef = ref;
          if (ref) startFrameReporting(ref);
        },
        component: currentComponent,
        inputProps: currentInputProps || undefined,
        durationInFrames: config.durationInFrames,
        fps: config.fps,
        compositionWidth: config.width,
        compositionHeight: config.height,
        loop: currentLoop,
        playbackRate: currentRate,
        style: { width: '100%', height: '100%' },
        controls: false,
        errorFallback: function(props) {
          var msg = props.error ? props.error.message : 'Unknown render error';
          send({ type: 'error', error: msg });
          return h('div', {
            style: { color: '#ff4444', padding: '20px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' },
          }, msg);
        },
      }));
    }

    // ── Canvas-size diagnostic ────────────────────────────────────────────
    // Periodically inspect all <canvas> elements and report their backing-buffer
    // dimensions to the parent. Lets us verify whether the dpr override is
    // actually shrinking WebGL canvases at Low quality.
    let lastCanvasSnapshot = '';
    function collectCanvasInfo() {
      const canvases = document.querySelectorAll('canvas');
      const items = [];
      for (var i = 0; i < canvases.length; i++) {
        var c = canvases[i];
        items.push({ width: c.width, height: c.height });
      }
      return {
        dpr: window.devicePixelRatio,
        scale: currentScale,
        count: items.length,
        canvases: items,
        threePatch: threePatchStatus,
        canvasPatch: canvasPatchStatus,
        viewportCalls: viewportCallCount,
        viewportLastArgs: viewportLastArgs,
        spxrCalls: spxrCallCount,
        spxrLastRequested: spxrLastRequested,
        spxrLastApplied: spxrLastApplied,
        htmlBuildId: HTML_BUILD_ID,
      };
    }
    function reportCanvasInfo() {
      const info = collectCanvasInfo();
      const snapshot = JSON.stringify(info);
      if (snapshot === lastCanvasSnapshot) return;
      lastCanvasSnapshot = snapshot;
      if (DIAG_ENABLED) console.log('[preview] canvas snapshot', info);
      send({ type: 'canvasInfo', info: info });
    }
    if (DIAG_ENABLED) setInterval(reportCanvasInfo, 1000);

    // ── Step 5: Frame reporting ───────────────────────────────────────────
    let frameRafId = null;
    function startFrameReporting(ref) {
      if (frameRafId) cancelAnimationFrame(frameRafId);
      let lastFrame = -1;
      let lastPlaying = null;

      function tick() {
        if (!ref) return;
        try {
          const frame = ref.getCurrentFrame();
          const playing = ref.isPlaying();
          if (frame !== lastFrame) {
            lastFrame = frame;
            send({ type: 'frameChange', frame: frame });
          }
          if (playing !== lastPlaying) {
            lastPlaying = playing;
            send({ type: playing ? 'playing' : 'paused' });
          }
        } catch (_) { /* player may not be ready yet */ }
        frameRafId = requestAnimationFrame(tick);
      }
      tick();
    }

    // ── Step 6: Command handler ───────────────────────────────────────────
    function handleCommand(msg) {
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'load': {
          statusEl.className = '';
          statusEl.innerHTML = '<div style="text-align:center"><div class="spinner" style="margin:0 auto 8px"></div><div>Loading component...</div></div>';
          if (typeof msg.quality === 'number' && msg.quality > 0) {
            currentScale = msg.quality;
          }
          currentInputProps = msg.inputProps || null;
          (async function() {
            try {
              var moduleUrl = msg.moduleUrl + '?t=' + Date.now();
              var mod = await import(moduleUrl);
              var Component = mod.default || mod[Object.keys(mod).find(function(k) { return typeof mod[k] === 'function'; })];
              if (!Component) throw new Error('No default export or component function found in module');
              renderPlayer(Component, msg.config);
              statusEl.className = 'hidden';
              send({ type: 'loaded' });
            } catch (err) {
              statusEl.innerHTML = '<div style="color:#ff4444;padding:20px;font-family:monospace;font-size:12px;white-space:pre-wrap;max-width:80%;overflow:auto">'
                + 'Component error:\\n' + (err.message || err) + '</div>';
              send({ type: 'error', error: err.message || String(err) });
            }
          })();
          break;
        }
        case 'play':
          try { playerRef && playerRef.play(); } catch (_) {}
          break;
        case 'pause':
          try { playerRef && playerRef.pause(); } catch (_) {}
          break;
        case 'seek':
          try { playerRef && playerRef.seekTo(msg.frame); } catch (_) {}
          break;
        case 'toggle':
          try {
            if (playerRef) {
              if (playerRef.isPlaying()) playerRef.pause();
              else playerRef.play();
            }
          } catch (_) {}
          break;
        case 'setInputProps':
          currentInputProps = msg.value || null;
          doRender();
          break;
        case 'setLoop':
          currentLoop = !!msg.value;
          doRender();
          break;
        case 'setPlaybackRate':
          currentRate = msg.value || 1;
          doRender();
          break;
        case 'setPreviewQuality':
          if (typeof msg.value === 'number' && msg.value > 0 && msg.value !== currentScale) {
            currentScale = msg.value;
            // Force full Player re-mount so R3F's <Canvas> re-reads the new
            // window.devicePixelRatio and re-allocates its WebGL buffer.
            playerKey += 1;
            doRender();
          }
          break;
        case 'ping':
          send({ type: 'pong' });
          break;
      }
    }

    // Listen for commands from preload bridge (webview) or postMessage (iframe fallback)
    if (window.previewBridge) {
      window.previewBridge.onCommand(handleCommand);
    } else {
      window.addEventListener('message', function(e) { handleCommand(e.data); });
    }

    // ── Step 7: Global error handlers ─────────────────────────────────────
    window.addEventListener('error', function(e) {
      send({ type: 'error', error: e.message || 'Unknown error' });
    });
    window.addEventListener('unhandledrejection', function(e) {
      var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled promise rejection';
      send({ type: 'error', error: msg });
    });

    // ── Step 8: Signal ready ──────────────────────────────────────────────
    statusEl.innerHTML = '<div style="text-align:center"><div class="spinner" style="margin:0 auto 8px"></div><div>Ready</div></div>';
    send({ type: 'ready' });
  </script>
</body>
</html>`;
}
