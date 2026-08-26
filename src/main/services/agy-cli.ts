import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type {
  AgyCliBridge,
  AgyCliStatus,
  AgyGenerateRequest,
  AgyGenerateResult,
} from '../../image-engine/providers/gemini-cli-provider';
import {
  buildAgyInstruction,
  parseAgyEvents,
  findConversationId,
  isGenerateImageDone,
  findAgentResponse,
  pickHarvestedImage,
} from './agy-cli-protocol';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('AgyCli');

/** `agy models` is a quick credential check; generation spawns a full agent. */
const PROBE_TIMEOUT_MS = 30_000;
const GENERATE_TIMEOUT_MS = 300_000;
/** Focus-driven re-probes reuse a fresh-enough result instead of respawning. */
const PROBE_CACHE_TTL_MS = 60_000;

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Drives the Antigravity CLI (`agy`) headlessly — the app-owned TypeScript
 * port of the `gen-image.ps1` recipe (we do not depend on the user's skills
 * folder). Generation bills the Google AI Pro/Ultra subscription via the
 * CLI's own keyring credentials; install and sign-in stay manual and
 * interactive (the setup card explains, never automates).
 *
 * Concurrency 1: each generate call spawns a whole agent process, so requests
 * queue behind a promise chain (the local sd-cli queue precedent).
 */
class AgyCliService implements AgyCliBridge {
  private cached: AgyCliStatus | null = null;

  private probePromise: Promise<AgyCliStatus> | null = null;

  private queueTail: Promise<unknown> = Promise.resolve();

  getBinaryPath(): string {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'agy', 'bin', 'agy.exe');
  }

  /** Where agy writes generated images: ~\.gemini\antigravity-cli\brain\<conv>\ */
  private getBrainDir(): string {
    return path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain');
  }

  getCachedStatus(): AgyCliStatus | null {
    return this.cached;
  }

  /** Probe once and remember — availability gating for getSupportedModels(). */
  async ensureProbed(): Promise<AgyCliStatus> {
    return this.cached ?? this.probeStatus(true);
  }

  /**
   * Detect the binary and probe auth (`agy models` succeeding is proof the
   * cached Google credentials work). Non-forced calls reuse a recent result
   * so window-focus re-probes don't respawn the CLI every few seconds.
   */
  async probeStatus(force = false): Promise<AgyCliStatus> {
    if (!force && this.cached && Date.now() - this.cached.probedAt < PROBE_CACHE_TTL_MS) {
      return this.cached;
    }
    if (this.probePromise) return this.probePromise;
    this.probePromise = this.doProbe().finally(() => {
      this.probePromise = null;
    });
    return this.probePromise;
  }

  private async doProbe(): Promise<AgyCliStatus> {
    const binaryPath = this.getBinaryPath();
    let installed = false;
    try {
      await fs.access(binaryPath);
      installed = true;
    } catch {
      // Not installed.
    }
    if (!installed) {
      this.cached = { installed: false, authenticated: false, binaryPath, probedAt: Date.now() };
      return this.cached;
    }

    let authenticated = false;
    let detail: string | undefined;
    try {
      const result = await this.run(['models'], PROBE_TIMEOUT_MS);
      authenticated = result.code === 0;
      if (!authenticated) {
        detail = result.stderr.trim().split(/\r?\n/).pop() || `agy models exited with code ${result.code}`;
      }
    } catch (err) {
      detail = err instanceof Error ? err.message : 'agy models failed to run';
    }

    this.cached = { installed, authenticated, binaryPath, detail, probedAt: Date.now() };
    log.info('Probe complete', { installed, authenticated, detail });
    return this.cached;
  }

  generateImage(request: AgyGenerateRequest): Promise<AgyGenerateResult> {
    // Chain onto the queue tail; a failed predecessor must not poison the queue.
    const run = this.queueTail.catch(() => {}).then(() => this.doGenerate(request));
    this.queueTail = run.catch(() => {});
    return run;
  }

  private async doGenerate(request: AgyGenerateRequest): Promise<AgyGenerateResult> {
    if (request.signal?.aborted) throw new Error('Image generation cancelled');

    const imageName = `vidtsx_${Date.now().toString(36)}`;
    const instruction = buildAgyInstruction({
      prompt: request.prompt,
      imageName,
      aspect: request.aspect,
      referencePaths: request.referencePaths,
    });

    const args = ['-p', instruction];
    // The agent needs read access to the reference files' directories.
    const refDirs = new Set((request.referencePaths ?? []).map((p) => path.dirname(p)));
    for (const dir of refDirs) args.push('--add-dir', dir);
    args.push('--output-format', 'stream-json');

    const result = await this.run(args, GENERATE_TIMEOUT_MS, request.signal);
    const events = parseAgyEvents(result.stdout);

    const conversationId = findConversationId(events);
    if (!conversationId) {
      const hint = result.stderr.trim().split(/\r?\n/).pop();
      throw new Error(
        `agy produced no conversation id (exit ${result.code}, ${events.length} events parsed${hint ? `; ${hint}` : ''})`,
      );
    }

    // Exit code 0 lies: headless mode soft-denies tools and still exits 0.
    if (!isGenerateImageDone(events)) {
      const said = findAgentResponse(events);
      throw new Error(
        `The image was not generated (the agent denied, refused, or rejected the request).${said ? ` Agent said: ${said}` : ''}`,
      );
    }

    // Harvest the newest image NON-recursively — .tempmediaStorage\ holds
    // copies of the input references and must not be searched.
    const convDir = path.join(this.getBrainDir(), conversationId);
    const entries = await fs.readdir(convDir, { withFileTypes: true });
    const candidates: Array<{ name: string; mtimeMs: number }> = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const stat = await fs.stat(path.join(convDir, entry.name));
      candidates.push({ name: entry.name, mtimeMs: stat.mtimeMs });
    }
    const picked = pickHarvestedImage(candidates);
    if (!picked) {
      throw new Error(`agy reported success but no image was found in ${convDir}`);
    }

    const image = await fs.readFile(path.join(convDir, picked));
    log.info('Image harvested', { conversationId, file: picked, bytes: image.length });
    return { image, conversationId };
  }

  private run(args: string[], timeoutMs: number, signal?: AbortSignal): Promise<RunResult> {
    return new Promise<RunResult>((resolve, reject) => {
      // A stray GEMINI_API_KEY/GOOGLE_API_KEY can silently route generation to
      // metered billing — the opposite of this provider's point — so the child
      // never sees them.
      const env = { ...process.env };
      if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) {
        log.warn('Stripping GEMINI_API_KEY/GOOGLE_API_KEY from the agy environment (subscription billing)');
      }
      delete env.GEMINI_API_KEY;
      delete env.GOOGLE_API_KEY;

      const child = spawn(this.getBinaryPath(), args, { env, windowsHide: true });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let aborted = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
      const onAbort = () => {
        aborted = true;
        child.kill();
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (aborted) {
          reject(new Error('Image generation cancelled'));
        } else if (timedOut) {
          reject(new Error(`agy timed out after ${Math.round(timeoutMs / 1000)}s`));
        } else {
          resolve({ code, stdout, stderr });
        }
      });
    });
  }
}

export const agyCliService = new AgyCliService();
