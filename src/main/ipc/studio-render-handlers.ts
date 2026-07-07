import type { IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../logging/log-engine';
import { IPC } from '../../shared/ipc/channels';
import { renderComposition } from '../services/remotion-renderer';
import { bundleComposition, ensureBundlerServer } from '../services/remotion-bundler';
import { generateStudioEntry } from '../services/studio-composition-wrapper';
import {
  getOutputFolder,
  getRenderTimeoutSeconds,
  getRenderDefaultGpuBackend,
  getRenderDefaultHardwareAcceleration,
} from '../services/settings';
import type {
  StudioRenderStartRequest,
  StudioRenderStartResponse,
  StudioRenderInput,
  RenderPhase,
} from '../../shared/ipc/types';

const log = logEngine.createLogger('StudioRender');

function assetUrl(port: number, filePath: string): string {
  return `http://127.0.0.1:${port}/asset?path=${encodeURIComponent(filePath)}`;
}

function extForCodec(codec: string): string {
  switch (codec) {
    case 'h265':
    case 'h264':
      return 'mp4';
    case 'vp8':
    case 'vp9':
      return 'webm';
    case 'prores':
      return 'mov';
    case 'gif':
      return 'gif';
    default:
      return 'mp4';
  }
}

// Rescale every frame value to a different target fps so timing is preserved
// when the user picks a non-original fps in the export modal. The input is built
// in frames at the project fps; multiplying by targetFps/inputFps keeps each
// clip/overlay at the same wall-clock position. No-op when fps is unchanged.
function rescaleInputToFps(input: StudioRenderInput, targetFps: number): StudioRenderInput {
  if (targetFps === input.fps || input.fps <= 0) return input;
  const r = targetFps / input.fps;
  const sf = (n: number) => Math.round(n * r);
  // Rescale each animation arrow's clip-local frame positions in lockstep.
  const sfAnims = (anims: StudioRenderInput['videoClips'][number]['animations']) =>
    anims?.map((a) => ({
      ...a,
      startFrames: sf(a.startFrames),
      durationFrames: Math.max(1, sf(a.durationFrames)),
    }));
  return {
    ...input,
    fps: targetFps,
    durationInFrames: Math.max(1, sf(input.durationInFrames)),
    videoClips: input.videoClips.map((c) => ({
      ...c,
      startFrame: sf(c.startFrame),
      durationInFrames: sf(c.durationInFrames),
      inPointFrames: sf(c.inPointFrames),
      transitionIn: c.transitionIn
        ? { ...c.transitionIn, durationInFrames: sf(c.transitionIn.durationInFrames) }
        : undefined,
      transitionOut: c.transitionOut
        ? { ...c.transitionOut, durationInFrames: sf(c.transitionOut.durationInFrames) }
        : undefined,
      animations: sfAnims(c.animations),
    })),
    audioClips: input.audioClips.map((c) => ({
      ...c,
      startFrame: sf(c.startFrame),
      durationInFrames: sf(c.durationInFrames),
      inPointFrames: sf(c.inPointFrames),
    })),
    imageClips: input.imageClips.map((c) => ({
      ...c,
      startFrame: sf(c.startFrame),
      durationInFrames: sf(c.durationInFrames),
      animations: sfAnims(c.animations),
    })),
    textClips: input.textClips.map((c) => ({
      ...c,
      startFrame: sf(c.startFrame),
      durationInFrames: sf(c.durationInFrames),
      animations: sfAnims(c.animations),
    })),
    slots: input.slots.map((s) => ({
      ...s,
      startFrame: sf(s.startFrame),
      durationInFrames: sf(s.durationInFrames),
      inPointFrames: sf(s.inPointFrames),
    })),
  };
}

// Build the serializable inputProps fed to StudioComposition at render time.
// Mirrors StudioScreen's playerInputProps, except video clip URLs point at the
// bundler asset server and slot components are injected statically in the entry.
function buildInputProps(input: StudioRenderInput, port: number): Record<string, unknown> {
  // The composition's AnimationArrow only needs the frame window + endpoints +
  // easing; drop preset/direction from the render arrows to keep props lean.
  const toArrows = (anims: StudioRenderInput['videoClips'][number]['animations']) =>
    anims?.map((a) => ({
      startFrames: a.startFrames,
      durationFrames: a.durationFrames,
      from: a.from,
      to: a.to,
      easing: a.easing,
    }));
  return {
    videoUrl: '',
    showVideo: true,
    segments: input.captions?.segments,
    styleId: input.captions?.styleId,
    baseSettings: input.captions?.baseSettings,
    styleConfigs: input.captions?.styleConfigs,
    tsxOverlays: input.slots.map((s) => ({
      id: s.id,
      startFrame: s.startFrame,
      durationInFrames: s.durationInFrames,
      inPointFrames: s.inPointFrames,
      transform: s.transform,
    })),
    videoClips: input.videoClips.map((c) => ({
      id: c.id,
      url: assetUrl(port, c.filePath),
      startFrame: c.startFrame,
      durationInFrames: c.durationInFrames,
      inPointFrames: c.inPointFrames,
      transform: c.transform,
      muted: c.muted,
      volume: c.volume,
      effects: c.effects,
      transitionIn: c.transitionIn,
      transitionOut: c.transitionOut,
      animations: toArrows(c.animations),
    })),
    imageClips: input.imageClips.map((c) => ({
      id: c.id,
      url: assetUrl(port, c.filePath),
      startFrame: c.startFrame,
      durationInFrames: c.durationInFrames,
      transform: c.transform,
      animations: toArrows(c.animations),
    })),
    // Text clips render to DOM/CSS — no asset file, so pass them straight through.
    textClips: input.textClips.map((c) => ({
      id: c.id,
      text: c.text,
      style: c.style,
      startFrame: c.startFrame,
      durationInFrames: c.durationInFrames,
      transform: c.transform,
      animations: toArrows(c.animations),
    })),
    audioClips: input.audioClips.map((c) => ({
      id: c.id,
      url: assetUrl(port, c.filePath),
      startFrame: c.startFrame,
      durationInFrames: c.durationInFrames,
      inPointFrames: c.inPointFrames,
      volume: c.volume,
    })),
  };
}

export async function handleStudioRenderStart(
  event: IpcMainInvokeEvent,
  data: StudioRenderStartRequest
): Promise<StudioRenderStartResponse> {
  const rawInput = data.input;
  if (!rawInput || !rawInput.projectId) {
    return { success: false, error: 'Missing render input' };
  }
  if (
    rawInput.videoClips.length === 0 &&
    rawInput.slots.length === 0 &&
    (rawInput.imageClips?.length ?? 0) === 0 &&
    (rawInput.textClips?.length ?? 0) === 0 &&
    (rawInput.audioClips?.length ?? 0) === 0
  ) {
    return {
      success: false,
      error: 'Nothing to render — add at least one visible clip, image, text, audio, or overlay',
    };
  }

  // Apply the chosen target fps (rescales frame values) up front so the entry,
  // inputProps, and renderComposition all agree on timing.
  const targetFps = data.fps && data.fps > 0 ? data.fps : rawInput.fps;
  const input = rescaleInputToFps(rawInput, targetFps);

  const jobId = randomUUID();
  const webContents = event.sender;

  // Resolve output path: explicit (the queue supplies one with the right
  // extension), or default-folder + project/timestamp name.
  let outputPath = data.outputPath;
  if (!outputPath) {
    const dir = await getOutputFolder();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = extForCodec(data.codec ?? 'h264');
    outputPath = path.join(dir, `studio-${input.projectId}-${stamp}.${ext}`);
  }
  const finalOutputPath = outputPath;

  const sendProgress = (
    percent: number,
    phase: RenderPhase,
    message?: string,
    framesRendered?: number,
    totalFrames?: number
  ): void => {
    if (webContents.isDestroyed()) return;
    webContents.send(IPC.RENDER_PROGRESS, {
      jobId,
      phase,
      percent,
      framesRendered,
      totalFrames,
      message,
    });
  };

  const sendComplete = (
    success: boolean,
    outPath?: string,
    fileSize?: number,
    error?: string
  ): void => {
    if (webContents.isDestroyed()) return;
    webContents.send(IPC.RENDER_COMPLETE, { jobId, success, outputPath: outPath, fileSize, error });
  };

  sendProgress(0, 'preparing', 'Preparing...');

  // Detached prep + render. The IPC call returns the jobId immediately; the
  // caller observes progress/completion via the shared RENDER_* events.
  void (async () => {
    let cleanup: (() => Promise<void>) | undefined;
    try {
      await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });

      const port = await ensureBundlerServer();

      // Build the (serializable) composition props now — the bundler port is up,
      // so clip asset URLs can be constructed. These get embedded into the entry.
      const inputProps = buildInputProps(input, port);

      sendProgress(0, 'preparing', 'Generating composition...');
      const entry = await generateStudioEntry({
        input,
        inputProps,
        fontProxyBaseUrl: `http://127.0.0.1:${port}`,
      });
      cleanup = entry.cleanup;

      sendProgress(0, 'bundling', 'Bundling composition...');
      const bundleResult = await bundleComposition(entry.entryPath, {
        skipWrapper: true,
        onProgress: (p) =>
          sendProgress(Math.round(p * 100), 'bundling', 'Bundling composition...'),
      });
      if (!bundleResult.success || !bundleResult.serveUrl) {
        if (cleanup) await cleanup().catch(() => {});
        sendComplete(false, undefined, undefined, bundleResult.error || 'Bundling failed');
        return;
      }

      sendProgress(0, 'rendering', 'Starting render...');
      const renderTimeoutSeconds = await getRenderTimeoutSeconds();
      // Per-render settings from the export modal win over persisted defaults.
      const gpuBackend = data.gpuBackend ?? (await getRenderDefaultGpuBackend());
      const hardwareAcceleration =
        data.hardwareAcceleration ?? (await getRenderDefaultHardwareAcceleration());

      await renderComposition(
        {
          bundleUrl: bundleResult.serveUrl,
          compositionId: 'studio',
          outputPath: finalOutputPath,
          codec: data.codec ?? 'h264',
          width: input.width,
          height: input.height,
          fps: input.fps,
          durationInFrames: input.durationInFrames,
          crf: data.crf,
          muted: data.muted,
          scale: data.scale,
          everyNthFrame: data.everyNthFrame,
          numberOfGifLoops: data.numberOfGifLoops,
          transparent: data.transparent,
          cpuUsage: data.cpuUsage,
          inputProps,
          gpuBackend,
          hardwareAcceleration,
          timeoutInMilliseconds: renderTimeoutSeconds * 1000,
        },
        (progressEvent) => {
          sendProgress(
            progressEvent.percent,
            'rendering',
            undefined,
            progressEvent.framesRendered,
            progressEvent.totalFrames
          );
        },
        (completeEvent) => {
          sendComplete(
            completeEvent.success,
            completeEvent.outputPath,
            completeEvent.fileSize,
            completeEvent.error
          );
          if (cleanup) cleanup().catch(() => {});
        },
        jobId
      );
    } catch (err) {
      if (cleanup) await cleanup().catch(() => {});
      const message = err instanceof Error ? err.message : String(err);
      log.error('Studio render failed', { error: message });
      sendComplete(false, undefined, undefined, message);
    }
  })();

  return { success: true, jobId, outputPath: finalOutputPath };
}
