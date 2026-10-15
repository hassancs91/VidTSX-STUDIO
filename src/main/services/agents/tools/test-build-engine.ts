// Test-only: a fake `BuildJobEngine` for the composition tools (P3 part 4).
// It behaves like tsxJobEngine where the tools can see it: `queued` is
// emitted before start() returns the id, then a running snapshot, then a
// version on disk (`vN.tsx` + `vN.src/` + `vN.stills/`, in the owner's `into`
// folder or the `editOf` folder) and a final snapshot. Imported by `*.test.ts`
// files only.

import fs from 'fs/promises';
import path from 'path';
import type { TsxBuildJobIpc, TsxBuildStillIpc, TsxJobIpc, TsxJobStartRequest } from '../../../../shared/ipc/types';
import type { BuildJobEngine } from '../../tsx-jobs/build-and-wait';
import type { TsxJobOwner } from '../../tsx-jobs/tsx-build-job';

export interface FakeBuildOptions {
  /** done (default), error, or hang until cancelled. */
  outcome?: 'done' | 'error' | 'hang';
  error?: string;
  code?: string;
  /** Model-size frames the last look rendered. */
  frames?: number[];
  summary?: string;
}

export interface FakeBuildEngine extends BuildJobEngine {
  builds: Array<{ jobId: string; request: TsxJobStartRequest; owner?: TsxJobOwner }>;
  events: TsxJobIpc[];
  cancelled: string[];
  options: FakeBuildOptions;
}

export const FAKE_BUILD_CODE = "import {AbsoluteFill} from 'remotion';\nexport const compositionConfig = {};";

async function nextVersion(folder: string): Promise<number> {
  const names = await fs.readdir(folder).catch(() => [] as string[]);
  const versions = names.map((n) => /^v(\d+)\.tsx$/i.exec(n)).filter((m): m is RegExpExecArray => m !== null).map((m) => Number(m[1]));
  return versions.length ? Math.max(...versions) + 1 : 1;
}

export function fakeBuildEngine(options: FakeBuildOptions = {}): FakeBuildEngine {
  const eventListeners = new Set<(job: TsxJobIpc) => void>();
  const streamListeners = new Set<(jobId: string, chunk: string) => void>();
  const cancels = new Map<string, () => void>();
  let n = 0;
  const engine: FakeBuildEngine = {
    builds: [],
    events: [],
    cancelled: [],
    options,
    start(request, owner) {
      if (request.kind !== 'build' || !request.build) return { error: 'A build job needs its build settings' };
      const jobId = `job-${++n}`;
      engine.builds.push({ jobId, request, ...(owner ? { owner } : {}) });
      const build: TsxBuildJobIpc = {
        budget: request.build.budget,
        edit: Boolean(request.build.editOf),
        phase: 'preparing',
        round: 0,
        roundsMax: 3,
        checks: 0,
        turns: 0,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        elapsedMs: 0,
        stills: [],
      };
      const job: TsxJobIpc = {
        id: jobId,
        kind: 'build',
        ...(owner ? { origin: owner.origin } : {}),
        prompt: request.prompt,
        status: 'queued',
        progress: { step: 'queued', label: 'Queued', percent: 0 },
        build,
        createdAt: Date.now(),
      };
      const emit = () => {
        const copy = structuredClone(job);
        engine.events.push(copy);
        for (const l of eventListeners) l(copy);
      };
      emit();
      void (async () => {
        await Promise.resolve();
        job.status = 'generating';
        job.progress = { step: 'rendering', label: 'Round 1/3 · Rendering frames', percent: 30 };
        emit();
        for (const l of streamListeners) l(jobId, 'Designing.');
        if (options.outcome === 'hang') {
          await new Promise<void>((resolve) => cancels.set(jobId, resolve));
          job.status = 'cancelled';
          job.progress = { step: 'cancelled', label: 'Cancelled', percent: 30 };
          emit();
          return;
        }
        if (options.outcome === 'error') {
          job.status = 'error';
          job.error = options.error ?? 'Build failed';
          emit();
          return;
        }
        const folder = owner?.into ?? request.build!.editOf!.folderPath;
        const version = await nextVersion(folder);
        const tsxPath = path.join(folder, `v${version}.tsx`);
        await fs.writeFile(tsxPath, options.code ?? FAKE_BUILD_CODE, 'utf-8');
        await fs.mkdir(path.join(folder, `v${version}.src`), { recursive: true });
        await fs.writeFile(path.join(folder, `v${version}.src`, 'index.tsx'), options.code ?? FAKE_BUILD_CODE, 'utf-8');
        const stillsDir = path.join(folder, `v${version}.stills`);
        await fs.mkdir(stillsDir, { recursive: true });
        const stills: TsxBuildStillIpc[] = [];
        for (const frame of options.frames ?? [0, 30, 60, 90, 119]) {
          const file = path.join(stillsDir, `r02-f${String(frame).padStart(3, '0')}.jpg`);
          await fs.writeFile(file, `jpeg-${frame}`);
          stills.push({ round: 2, frame, size: 'model', path: file });
        }
        const phone = path.join(stillsDir, 'phone1-f000.jpg');
        await fs.writeFile(phone, 'jpeg-phone');
        stills.push({ round: 2, frame: 0, size: 'phone', path: phone });
        job.status = 'done';
        job.progress = { step: 'done', label: 'Complete', percent: 100 };
        job.folderPath = folder;
        job.versionPath = tsxPath;
        job.build = {
          ...build,
          phase: 'done',
          round: 2,
          checks: 4,
          finished: true,
          stills,
          ...(options.summary ? { summary: options.summary } : {}),
        };
        emit();
      })();
      return { jobId };
    },
    cancel(jobId) {
      engine.cancelled.push(jobId);
      cancels.get(jobId)?.();
      return { success: true };
    },
    onEvent(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    onStream(listener) {
      streamListeners.add(listener);
      return () => streamListeners.delete(listener);
    },
  };
  return engine;
}
