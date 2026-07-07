/**
 * Generates the HTML page for Tone.js audio extraction.
 *
 * This page runs in a hidden BrowserWindow. It loads the user's composition,
 * renders it with Tone.js bound to an OfflineContext, then captures the
 * resulting AudioBuffer as a WAV file encoded in base64.
 *
 * Mirrors the pattern of preview-html.ts but optimized for audio extraction.
 */

export function getToneExtractHtml(port: number): string {
  const baseUrl = `http://127.0.0.1:${port}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
</head>
<body>
  <div id="root"></div>

  <script type="module">
    const BASE_URL = ${JSON.stringify(baseUrl)};

    // ── Parse query params ───────────────────────────────────────────────
    const params = new URLSearchParams(location.search);
    const moduleUrl = params.get('moduleUrl');
    const duration = parseFloat(params.get('duration') || '10');
    const fps = parseInt(params.get('fps') || '30', 10);
    const width = parseInt(params.get('width') || '1920', 10);
    const height = parseInt(params.get('height') || '1080', 10);
    const durationInFrames = parseInt(params.get('durationInFrames') || String(Math.ceil(duration * fps)), 10);
    const sampleRate = parseInt(params.get('sampleRate') || '44100', 10);

    if (!moduleUrl) {
      window.__TONE_EXTRACT_RESULT__ = { success: false, error: 'Missing moduleUrl parameter' };
      throw new Error('Missing moduleUrl');
    }

    // ── WAV encoding utilities ───────────────────────────────────────────
    function writeString(view, offset, str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    function audioBufferToWav(buffer) {
      const numChannels = buffer.numberOfChannels;
      const length = buffer.length;
      const bytesPerSample = 2;
      const blockAlign = numChannels * bytesPerSample;
      const dataSize = length * blockAlign;
      const headerSize = 44;
      const totalSize = headerSize + dataSize;

      const arrayBuffer = new ArrayBuffer(totalSize);
      const view = new DataView(arrayBuffer);

      // RIFF header
      writeString(view, 0, 'RIFF');
      view.setUint32(4, totalSize - 8, true);
      writeString(view, 8, 'WAVE');

      // fmt chunk
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, buffer.sampleRate, true);
      view.setUint32(28, buffer.sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, 16, true);

      // data chunk
      writeString(view, 36, 'data');
      view.setUint32(40, dataSize, true);

      // Interleave channels and convert float32 to int16
      const channels = [];
      for (let c = 0; c < numChannels; c++) {
        channels.push(buffer.getChannelData(c));
      }

      let offset = 44;
      for (let i = 0; i < length; i++) {
        for (let c = 0; c < numChannels; c++) {
          const sample = Math.max(-1, Math.min(1, channels[c][i]));
          const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          view.setInt16(offset, int16, true);
          offset += 2;
        }
      }

      return arrayBuffer;
    }

    function arrayBufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
      }
      return btoa(binary);
    }

    // ── Main extraction flow ─────────────────────────────────────────────
    //
    // Many Tone.js compositions trigger notes per-frame via useCurrentFrame()
    // rather than scheduling upfront on Tone.Transport. To capture these, we:
    //   1. Create a Tone.OfflineContext for the final audio render
    //   2. Patch the context's currentTime/now() to return the current frame's time
    //   3. Mount the component in a Player and seek through every frame
    //   4. Each frame triggers useEffect → triggerAttackRelease → scheduled
    //      at the correct time in the offline buffer (via this.context.currentTime)
    //   5. Call offlineCtx.render() to process all scheduled events
    //
    // Each step is wrapped in its own try/catch so we can report which step failed.
    //
    var currentStep = 'init';
    var seekErrors = 0;
    var playerRef = null;

    function failStep(step, err) {
      window.__TONE_EXTRACT_RESULT__ = {
        success: false,
        error: (err && err.message) ? err.message : String(err),
        debug: {
          step: step,
          stack: err && err.stack ? String(err.stack) : undefined,
        },
      };
    }

    // Progress breadcrumbs — use console.warn so they pass our main-process
    // filter (which drops info/log to avoid the virtual-remotion flood).
    var mark = function(label) {
      console.warn('[tone-extract] ' + label + ' @ ' + Math.round(performance.now()) + 'ms');
    };

    try {
      mark('start');
      // Step 1: Load preview runtime (React, Remotion, Player)
      currentStep = 'loadRuntime';
      const runtime = await import(BASE_URL + '/vendor/preview-runtime.js');
      const { React, ReactDOM, createRoot, Remotion, Player } = runtime;
      mark('runtime loaded');

      // Step 2: Set window globals (needed by virtual modules)
      currentStep = 'setGlobals';
      window.__VIDTSX_REACT__ = React;
      window.__VIDTSX_REACT_DOM__ = ReactDOM;
      window.__VIDTSX_JSX_RUNTIME__ = runtime.jsxRuntime;
      window.__VIDTSX_REMOTION__ = Remotion;
      window.__VIDTSX_REMOTION_NO_REACT__ = runtime.RemotionNoReact;
      window.__VIDTSX_MODULE_SERVER_URL__ = BASE_URL;

      // Step 3: Import Tone.js from esm.sh (same URL as user code gets)
      currentStep = 'importTone';
      const Tone = await import('https://esm.sh/tone@15.1.22');
      mark('tone imported');

      // Step 4: Create OfflineContext and set as Tone's global context
      currentStep = 'createOfflineContext';
      const offlineCtx = new Tone.OfflineContext(2, duration, sampleRate);

      currentStep = 'setContext';
      Tone.setContext(offlineCtx);
      mark('context set');

      // Step 5: Patch instance-level time methods on the OfflineContext.
      // Tone.js instruments call this.context.currentTime / this.context.lookAhead
      // internally via this.now(). We shadow currentTime with a getter that
      // returns our frame-based time, and also override now() as a backup.
      // We do NOT patch Tone.now / Tone.immediate — those are module namespace
      // exports which are frozen per ES spec and throw TypeError on assignment.
      currentStep = 'patchContext';
      let currentFrameTime = 0;

      Object.defineProperty(offlineCtx, 'currentTime', {
        get: function() { return currentFrameTime; },
        configurable: true,
      });

      const originalCtxNow = offlineCtx.now;
      offlineCtx.now = function() { return currentFrameTime; };

      // Step 6: Import user module (cache-busted)
      currentStep = 'importUserModule';
      const mod = await import(moduleUrl + '?t=' + Date.now());
      const Component = mod.default
        || mod[Object.keys(mod).find(function(k) { return typeof mod[k] === 'function'; })];

      if (!Component) {
        throw new Error('No component found in user module');
      }
      mark('user module imported');

      // Step 7: Mount component in Player (provides Remotion context)
      currentStep = 'mountPlayer';
      const container = document.getElementById('root');
      const root = createRoot(container);

      const h = React.createElement;
      root.render(
        h(Player, {
          ref: function(ref) { playerRef = ref; },
          component: Component,
          durationInFrames: durationInFrames,
          fps: fps,
          compositionWidth: width,
          compositionHeight: height,
          style: { width: '1px', height: '1px', opacity: 0 },
          controls: false,
        })
      );

      // Wait for initial mount + synth creation in useEffect
      await new Promise(function(r) { setTimeout(r, 800); });
      mark('mounted + 800ms wait done');

      // Wait for any async Tone.js setup (Reverb impulse generation,
      // sample loading, etc.) to complete before iterating frames.
      // BUT cap it at 3s — Tone.Reverb uses a nested OfflineContext that
      // can hang in some configurations, and we'd rather proceed without
      // reverb ready than time out the whole extraction.
      currentStep = 'waitForToneLoaded';
      try {
        if (typeof Tone.loaded === 'function') {
          await Promise.race([
            Tone.loaded(),
            new Promise(function(_, reject) {
              setTimeout(function() { reject(new Error('Tone.loaded exceeded 3s')); }, 3000);
            }),
          ]);
          mark('Tone.loaded resolved');
        } else {
          mark('Tone.loaded not available, skipping');
        }
      } catch (e) {
        console.warn('[tone-extract] Tone.loaded skipped: ' + (e && e.message ? e.message : e));
      }

      // Step 8: Iterate through every frame
      // Each seek triggers a React re-render → useEffect fires → notes are
      // scheduled at currentFrameTime in the offline audio buffer.
      //
      // IMPORTANT: hidden Electron windows throttle both setTimeout and
      // requestAnimationFrame to ~1Hz, which made each frame take 1 full
      // second. MessageChannel is the one primitive that is NEVER throttled
      // (React's own scheduler uses it for this reason). We use it to yield
      // to the event loop so React can commit renders + run useEffects
      // between seekTo calls, without incurring throttling.
      currentStep = 'frameLoop';
      mark('frameLoop start (' + durationInFrames + ' frames)');
      window.__TONE_EXTRACT_PROGRESS__ = { sub: 'frames', percent: 0 };

      var mc = new MessageChannel();
      var yieldResolve = null;
      mc.port1.onmessage = function() {
        if (yieldResolve) {
          var r = yieldResolve;
          yieldResolve = null;
          r();
        }
      };
      var yieldToReact = function() {
        return new Promise(function(resolve) {
          yieldResolve = resolve;
          mc.port2.postMessage(null);
        });
      };

      for (var f = 0; f < durationInFrames; f++) {
        currentFrameTime = f / fps;
        if (playerRef) {
          try {
            playerRef.seekTo(f);
          } catch (e) {
            seekErrors++;
          }
        }
        // Two yields: one for React to commit the render, one for useEffect
        // to fire after the commit. Both are non-throttled MessageChannel ticks.
        await yieldToReact();
        await yieldToReact();
        if (f % 5 === 0 || f === durationInFrames - 1) {
          window.__TONE_EXTRACT_PROGRESS__ = {
            sub: 'frames',
            percent: Math.round(((f + 1) / durationInFrames) * 100),
          };
        }
        if (f > 0 && f % 30 === 0) {
          mark('frameLoop @ frame ' + f + '/' + durationInFrames);
        }
      }
      mark('frameLoop done');
      window.__TONE_EXTRACT_PROGRESS__ = { sub: 'encoding', percent: 0 };

      // Step 9: Restore original time behavior for offline render
      currentStep = 'restoreContext';
      offlineCtx.now = originalCtxNow;
      delete offlineCtx.currentTime; // Remove instance override, fall back to prototype

      // Start Transport if user code scheduled events on it (belt-and-suspenders)
      try {
        const transport = Tone.getTransport();
        if (transport.state !== 'started') {
          transport.start(0);
        }
      } catch (_) {}

      // Step 10: Render offline audio (processes all scheduled events)
      currentStep = 'offlineRender';
      mark('offlineRender start');
      const audioBuffer = await offlineCtx.render();
      mark('offlineRender done');

      // Step 11: Convert to WAV and base64 encode
      currentStep = 'encodeWav';
      const wavArrayBuffer = audioBufferToWav(audioBuffer);
      const wavBase64 = arrayBufferToBase64(wavArrayBuffer);

      // Check if audio contains non-silence
      var peakAmplitude = 0;
      var rawBuffer = audioBuffer.get ? audioBuffer.get() : audioBuffer;
      if (rawBuffer && rawBuffer.getChannelData) {
        var ch0 = rawBuffer.getChannelData(0);
        for (var s = 0; s < ch0.length; s += 100) {
          var abs = Math.abs(ch0[s]);
          if (abs > peakAmplitude) peakAmplitude = abs;
        }
      }

      // Step 12: Signal completion
      window.__TONE_EXTRACT_RESULT__ = {
        success: true,
        wavBase64: wavBase64,
        debug: {
          durationInFrames: durationInFrames,
          seekErrors: seekErrors,
          peakAmplitude: peakAmplitude,
          wavBytes: wavArrayBuffer.byteLength,
          hadPlayerRef: !!playerRef,
        },
      };

    } catch (err) {
      failStep(currentStep, err);
    }
  </script>
</body>
</html>`;
}
