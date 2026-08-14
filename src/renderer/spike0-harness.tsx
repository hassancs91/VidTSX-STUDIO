/**
 * Spike 0 — packaged-preview experiment (docs/studio/TSX_SHOTS_DESIGN.md D4).
 *
 * Answers: in a PACKAGED build (renderer on a file:// origin with
 * webSecurity: true), can the renderer dynamic-import() a transpiled TSX
 * module from the module server (http://127.0.0.1:32xx), mount it inside an
 * in-app @remotion/player <Player>, and have useCurrentFrame() inside the
 * module track the host Player (shared React/Remotion via
 * setupVirtualModuleGlobals())?
 *
 * Invoke-only: nothing here runs until window.__runSpike0(tsxPath) is called
 * (DevTools console in dev; CDP Runtime.evaluate against a packaged build —
 * see docs/ui-automation-cdp.md). The result lands in window.__SPIKE0__ and
 * on the overlay itself. Not wired to any UI action; safe to leave installed.
 */
import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import type { PlayerRef } from '@remotion/player';
import { setupVirtualModuleGlobals } from '@features/player';
import type { CompositionConfig } from '@features/player';

interface Spike0Sample {
  tMs: number;
  playerFrame: number;
  moduleFrame: number | null;
}

interface Spike0Report {
  phase: 'idle' | 'transpiling' | 'importing' | 'sampling' | 'done' | 'error';
  moduleUrl: string | null;
  error: string | null;
  samples: Spike0Sample[];
  verdict: 'PASS' | 'FAIL' | null;
  detail: string | null;
}

const SAMPLE_INTERVAL_MS = 200;
const SAMPLE_COUNT = 20;

function computeVerdict(samples: Spike0Sample[]): { verdict: 'PASS' | 'FAIL'; detail: string } {
  const moduleFrames = samples
    .map((s) => s.moduleFrame)
    .filter((f): f is number => f !== null);
  if (moduleFrames.length === 0) {
    return { verdict: 'FAIL', detail: 'module never rendered a frame readout' };
  }
  const distinct = new Set(moduleFrames).size;
  const inSync = samples.filter(
    (s) => s.moduleFrame !== null && Math.abs(s.moduleFrame - s.playerFrame) <= 2
  ).length;
  const syncRatio = inSync / samples.length;
  const detail = `${distinct} distinct module frames over ${samples.length} samples; ${inSync}/${samples.length} within 2 frames of host Player`;
  // Tracking = the module's useCurrentFrame() advances AND matches the host
  // Player's clock. A frozen frame (context mismatch → always 0) or a
  // free-running mismatch both fail.
  if (distinct >= 5 && syncRatio >= 0.8) {
    return { verdict: 'PASS', detail };
  }
  return { verdict: 'FAIL', detail };
}

function Spike0Overlay({
  component: Comp,
  config,
  onDone,
}: {
  component: ComponentType<Record<string, unknown>>;
  config: CompositionConfig;
  onDone: (samples: Spike0Sample[]) => void;
}) {
  const playerRef = useRef<PlayerRef>(null);
  const [status, setStatus] = useState('sampling…');

  useEffect(() => {
    const samples: Spike0Sample[] = [];
    const started = performance.now();
    const timer = setInterval(() => {
      const playerFrame = playerRef.current?.getCurrentFrame() ?? -1;
      const el = document.getElementById('spike0-module-frame');
      const raw = el?.getAttribute('data-frame');
      const moduleFrame = raw !== null && raw !== undefined ? Number(raw) : null;
      samples.push({ tMs: Math.round(performance.now() - started), playerFrame, moduleFrame });
      setStatus(`sample ${samples.length}/${SAMPLE_COUNT} — player=${playerFrame} module=${moduleFrame ?? '∅'}`);
      if (samples.length >= SAMPLE_COUNT) {
        clearInterval(timer);
        onDone(samples);
      }
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 99999,
        background: '#1a1a1e',
        border: '1px solid #7F77DD',
        borderRadius: 8,
        padding: 8,
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 12,
      }}
    >
      <div id="spike0-status" style={{ marginBottom: 6 }}>
        SPIKE 0 — {status}
      </div>
      <Player
        ref={playerRef}
        component={Comp}
        durationInFrames={config.durationInFrames}
        fps={config.fps}
        compositionWidth={config.width}
        compositionHeight={config.height}
        style={{ width: 320, height: (320 * config.height) / config.width }}
        autoPlay
        loop
      />
    </div>
  );
}

async function runSpike0(tsxPath: string): Promise<Spike0Report> {
  const report: Spike0Report = {
    phase: 'idle',
    moduleUrl: null,
    error: null,
    samples: [],
    verdict: null,
    detail: null,
  };
  (window as unknown as Record<string, unknown>).__SPIKE0__ = report;

  try {
    await setupVirtualModuleGlobals();

    report.phase = 'transpiling';
    const res = await window.api.moduleTranspile({ filePath: tsxPath });
    if (!res.success || !res.moduleUrl) {
      report.phase = 'error';
      report.error = `transpile failed: ${res.error ?? 'unknown'}`;
      return report;
    }
    report.moduleUrl = res.moduleUrl;

    report.phase = 'importing';
    let mod: { default: ComponentType<Record<string, unknown>> };
    try {
      mod = (await import(/* @vite-ignore */ `${res.moduleUrl}?spike0=1`)) as {
        default: ComponentType<Record<string, unknown>>;
      };
    } catch (err) {
      report.phase = 'error';
      const e = err as Error;
      report.error = `import() failed: ${e.name}: ${e.message}\n${e.stack ?? ''}`;
      return report;
    }
    if (typeof mod.default !== 'function') {
      report.phase = 'error';
      report.error = `module imported but default export is ${typeof mod.default}`;
      return report;
    }

    const config: CompositionConfig = res.compositionConfig ?? {
      id: 'spike0',
      durationInFrames: 150,
      fps: 30,
      width: 1280,
      height: 720,
    };

    report.phase = 'sampling';
    const host = document.createElement('div');
    host.id = 'spike0-overlay-host';
    document.body.appendChild(host);
    const root = createRoot(host);

    const samples = await new Promise<Spike0Sample[]>((resolve) => {
      root.render(<Spike0Overlay component={mod.default} config={config} onDone={resolve} />);
    });

    report.samples = samples;
    const { verdict, detail } = computeVerdict(samples);
    report.verdict = verdict;
    report.detail = detail;
    report.phase = 'done';
    const statusEl = document.getElementById('spike0-status');
    if (statusEl) statusEl.textContent = `SPIKE 0 — ${verdict}: ${detail}`;
    return report;
  } catch (err) {
    report.phase = 'error';
    report.error = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
    return report;
  }
}

/**
 * Register the invoke-only Spike 0 global. Called once from main.tsx.
 */
export function installSpike0Harness(): void {
  (window as unknown as Record<string, unknown>).__runSpike0 = runSpike0;
}
