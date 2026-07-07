import fs from 'fs/promises';
import path from 'path';
import type { LogEntry, LogConfig } from './log-types';

export class LogWriter {
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private currentDate: string = '';
  private currentFilePath: string = '';
  private config: LogConfig;
  private flushing = false;

  constructor(config: LogConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.config.logDir, { recursive: true });
    this.updateCurrentFile();

    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[LogWriter] Flush failed:', err);
      });
    }, this.config.flushIntervalMs);

    // Cleanup old logs on init and every hour
    this.cleanupOldLogs().catch(() => {});
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldLogs().catch(() => {});
    }, 60 * 60 * 1000);
  }

  append(entry: LogEntry): void {
    this.buffer.push(entry);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.flushing) return;
    this.flushing = true;

    const entries = this.buffer.splice(0);
    try {
      this.updateCurrentFile();
      await this.rotateIfNeeded();

      const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
      await fs.appendFile(this.currentFilePath, lines, 'utf-8');
    } catch (err) {
      // Put entries back at the front on failure
      this.buffer.unshift(...entries);
      console.error('[LogWriter] Write failed:', err);
    } finally {
      this.flushing = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    await this.flush();
  }

  private updateCurrentFile(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.currentFilePath = path.join(this.config.logDir, `vidtsx-${today}.log`);
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.currentFilePath);
      const sizeMB = stats.size / (1024 * 1024);
      if (sizeMB >= this.config.maxFileSizeMB) {
        // Find next available suffix
        let suffix = 1;
        while (true) {
          const rotatedPath = this.currentFilePath.replace('.log', `.${suffix}.log`);
          try {
            await fs.access(rotatedPath);
            suffix++;
          } catch {
            // File doesn't exist, use this name
            await fs.rename(this.currentFilePath, rotatedPath);
            break;
          }
        }
      }
    } catch {
      // File doesn't exist yet, no rotation needed
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDir);
      const cutoff = Date.now() - this.config.maxAgeDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith('vidtsx-') || !file.endsWith('.log')) continue;
        const filePath = path.join(this.config.logDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtimeMs < cutoff) {
            await fs.unlink(filePath);
          }
        } catch {
          // Skip files that can't be stat'd
        }
      }
    } catch {
      // Log dir might not exist yet
    }
  }
}
