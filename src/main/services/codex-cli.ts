import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  CodexCliBridge,
  CodexCliStatus,
  CodexGenerateRequest,
  CodexGenerateResult,
} from '../../image-engine/providers/codex-cli-provider';
import {
  buildCodexArgs,
  buildCodexInstruction,
  findLastAgentMessage,
  findThreadId,
  findUsage,
  isDoneMessage,
  isLoggedInOutput,
  parseCodexEvents,
  parseCodexVersion,
  pickHarvestedImage,
} from './codex-cli-protocol';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('CodexCli');

/** `codex login status` / `--version` are quick; generation is a whole agent turn (~40 s at low effort). */
const PROBE_TIMEOUT_MS = 30_000;
const GENERATE_TIMEOUT_MS = 600_000;
/** Focus-driven re-probes reuse a fresh-enough result instead of respawning. */
const PROBE_CACHE_TTL_MS = 60_000;
/** The harvest accepts files a little older than our clock's start stamp. */
const HARVEST_CLOCK_SLOP_MS = 5_000;

const CONTENT_TYPE_BY_EXT: Record<string, CodexGenerateResult['contentType']> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Drives the OpenAI Codex CLI (`codex exec`) headlessly for image generation
 * (docs/ai-models-redesign.md §3.7): generation bills the user's ChatGPT plan
 * through the CLI's own login; install and sign-in stay manual (the Providers
 * row explains, never automates). The `agy` service's shape: probe cached
 * 60 s, concurrency 1 through a promise chain, harvest from the CLI's own
 * output folder.
 */
class CodexCliService implements CodexCliBridge {
  private cached: CodexCliStatus | null = null;

  private probePromise: Promise<CodexCliStatus> | null = null;

  private queueTail: Promise<unknown> = Promise.resolve();

  /**
   * `--ephemeral` keeps app runs out of `codex resume` (no session file).
   * Verified 2026-09-17 on codex-cli 0.154.0: the image tool still writes
   * generated_images/<thread_id>/exec-*.png with it (38 s, DONE) — Status.md,
   * AI MODELS REDESIGN P5.
   */
  ephemeral = true;

  /**
   * The native binary inside the npm global package (the `codex.cmd` shim
   * needs a shell, and a shell means quoting a multi-line prompt). Overridable
   * with VIDTSX_CODEX_BINARY for other layouts.
   */
  getBinaryCandidates(): string[] {
    const override = process.env.VIDTSX_CODEX_BINARY;
    if (override) return [override];
    if (process.platform === 'win32') {
      const npmRoot = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules');
      const pkg = path.join(npmRoot, '@openai', 'codex');
      return [
        path.join(pkg, 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'),
        path.join(pkg, 'vendor', 'x86_64-pc-windows-msvc', 'codex', 'codex.exe'),
      ];
    }
    return ['/usr/local/bin/codex', '/opt/homebrew/bin/codex', path.join(os.homedir(), '.npm-global', 'bin', 'codex')];
  }

  private codexHome(): string {
    return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  }

  /** Where the image tool writes: $CODEX_HOME/generated_images/<thread_id>/exec-<uuid>.png */
  private generatedImagesDir(threadId: string): string {
    return path.join(this.codexHome(), 'generated_images', threadId);
  }

  getCachedStatus(): CodexCliStatus | null {
    return this.cached;
  }

  async ensureProbed(): Promise<CodexCliStatus> {
    return this.cached ?? this.probeStatus(true);
  }

  async probeStatus(force = false): Promise<CodexCliStatus> {
    if (!force && this.cached && Date.now() - this.cached.probedAt < PROBE_CACHE_TTL_MS) {
      return this.cached;
    }
    if (this.probePromise) return this.probePromise;
    this.probePromise = this.doProbe().finally(() => {
      this.probePromise = null;
    });
    return this.probePromise;
  }

  private async doProbe(): Promise<CodexCliStatus> {
    let binaryPath = '';
    for (const candidate of this.getBinaryCandidates()) {
      if (await exists(candidate)) {
        binaryPath = candidate;
        break;
      }
    }
    if (!binaryPath) {
      this.cached = {
        installed: false,
        authenticated: false,
        binaryPath: this.getBinaryCandidates()[0] ?? '',
        detail: 'npm global package @openai/codex not found',
        probedAt: Date.now(),
      };
      return this.cached;
    }

    let version: string | undefined;
    let authenticated = false;
    let detail: string | undefined;
    try {
      const v = await this.run(binaryPath, ['--version'], PROBE_TIMEOUT_MS);
      version = parseCodexVersion(v.stdout) ?? undefined;
      const status = await this.run(binaryPath, ['login', 'status'], PROBE_TIMEOUT_MS);
      authenticated = status.code === 0 && isLoggedInOutput(status.stdout, status.stderr);
      if (!authenticated) {
        detail =
          `${status.stdout}\n${status.stderr}`.trim().split(/\r?\n/).filter(Boolean).pop() ||
          `codex login status exited with code ${status.code}`;
      }
    } catch (err) {
      detail = err instanceof Error ? err.message : 'codex failed to run';
    }

    this.cached = { installed: true, authenticated, binaryPath, version, detail, probedAt: Date.now() };
    log.info('Probe complete', { installed: true, authenticated, version, detail });
    return this.cached;
  }

  generateImage(request: CodexGenerateRequest): Promise<CodexGenerateResult> {
    // Chain onto the queue tail; a failed predecessor must not poison the queue.
    const run = this.queueTail.catch(() => {}).then(() => this.doGenerate(request));
    this.queueTail = run.catch(() => {});
    return run;
  }

  private async doGenerate(request: CodexGenerateRequest): Promise<CodexGenerateResult> {
    if (request.signal?.aborted) throw new Error('Image generation cancelled');
    const status = await this.ensureProbed();
    if (!status.installed) throw new Error('The Codex CLI is not installed.');

    const cwd = path.join(os.tmpdir(), 'vidtsx-codex', randomUUID());
    await fs.mkdir(cwd, { recursive: true });
    const lastMessagePath = path.join(cwd, 'last.txt');
    const args = buildCodexArgs({
      instruction: buildCodexInstruction({
        prompt: request.prompt,
        size: request.size,
        referenceCount: request.referencePaths?.length ?? 0,
      }),
      cwd,
      lastMessagePath,
      referencePaths: request.referencePaths,
      ephemeral: this.ephemeral,
    });
    const startedAt = Date.now();

    try {
      const result = await this.run(status.binaryPath, args, GENERATE_TIMEOUT_MS, request.signal);
      const events = parseCodexEvents(result.stdout);
      const threadId = findThreadId(events);
      const lastMessage =
        findLastAgentMessage(events) ?? (await fs.readFile(lastMessagePath, 'utf8').catch(() => '')).trim();
      if (!threadId) {
        const hint = result.stderr.trim().split(/\r?\n/).filter(Boolean).pop();
        throw new Error(
          `codex produced no thread id (exit ${result.code}, ${events.length} events parsed${hint ? `; ${hint}` : ''})`,
        );
      }

      // Proof of success is the file, never an event: harvest the thread folder.
      const dir = this.generatedImagesDir(threadId);
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      const candidates: Array<{ name: string; mtimeMs: number }> = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const stat = await fs.stat(path.join(dir, entry.name));
        candidates.push({ name: entry.name, mtimeMs: stat.mtimeMs });
      }
      const picked = pickHarvestedImage(candidates, startedAt - HARVEST_CLOCK_SLOP_MS);
      if (!picked) {
        const said = lastMessage && !isDoneMessage(lastMessage) ? lastMessage : null;
        throw new Error(
          `The image was not generated (nothing new in ${dir}).${said ? ` Codex said: ${said}` : ''}`,
        );
      }

      const image = await fs.readFile(path.join(dir, picked));
      const contentType = CONTENT_TYPE_BY_EXT[path.extname(picked).toLowerCase()] ?? 'image/png';
      const usage = findUsage(events) ?? undefined;
      log.info('Image harvested', { threadId, file: picked, bytes: image.length, usage, ms: Date.now() - startedAt });
      return { image, contentType, threadId, usage };
    } finally {
      fs.rm(cwd, { recursive: true, force: true }).catch(() => {});
    }
  }

  private run(binaryPath: string, args: string[], timeoutMs: number, signal?: AbortSignal): Promise<RunResult> {
    return new Promise<RunResult>((resolve, reject) => {
      // An OPENAI_API_KEY in the environment would route the run to metered
      // API billing — the opposite of this provider's point — so the child
      // never sees it (the agy precedent for GEMINI_API_KEY).
      const env = { ...process.env };
      if (env.OPENAI_API_KEY) {
        log.warn('Stripping OPENAI_API_KEY from the codex environment (subscription billing)');
        delete env.OPENAI_API_KEY;
      }

      // stdin MUST be closed: Codex reads it otherwise ("Reading additional input from stdin…").
      const child = spawn(binaryPath, args, {
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
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
          reject(new Error(`codex timed out after ${Math.round(timeoutMs / 1000)}s`));
        } else {
          resolve({ code, stdout, stderr });
        }
      });
    });
  }
}

export const codexCliService = new CodexCliService();
