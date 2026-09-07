import { logEngine } from '../../../logging/log-engine';
import { BytePlusHttpError } from './errors';
import type {
  BytePlusClientOptions,
  BytePlusCreateTaskBody,
  BytePlusCreateTaskResult,
  BytePlusTask,
} from './types';

const log = logEngine.createLogger('BytePlusArk');

/** International (ap-southeast) ModelArk endpoint. */
export const BYTEPLUS_ARK_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';

interface ArkErrorBody {
  error?: { code?: string; message?: string };
  message?: string;
}

/**
 * Client for BytePlus ModelArk's async video generation tasks API. Auth is a
 * plain bearer API key, so it fits the shared BYOK credential store — the
 * Volcengine (China) sibling needs AK/SK request signing and is deferred
 * (docs/video-providers-plan.md D2); swapping to it is a base-URL plus
 * auth-strategy change here, not a new client.
 */
export class BytePlusArkClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: BytePlusClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? BYTEPLUS_ARK_BASE_URL).replace(/\/+$/, '');
  }

  /** POST /contents/generations/tasks — returns the task id to poll. */
  async createTask(
    body: BytePlusCreateTaskBody,
    signal?: AbortSignal,
  ): Promise<BytePlusCreateTaskResult> {
    const data = await this.request<BytePlusCreateTaskResult>(
      '/contents/generations/tasks',
      { method: 'POST', body },
      signal,
    );
    if (!data.id) throw new BytePlusHttpError('ModelArk returned a task with no id');
    return data;
  }

  /** GET /contents/generations/tasks/{id} — status, output URL, token usage. */
  async getTask(taskId: string, signal?: AbortSignal): Promise<BytePlusTask> {
    return this.request<BytePlusTask>(
      `/contents/generations/tasks/${encodeURIComponent(taskId)}`,
      { method: 'GET' },
      signal,
    );
  }

  /**
   * DELETE /contents/generations/tasks/{id} — cancels a queued task, deletes
   * the record of a finished one. A running task cannot be cancelled.
   */
  async deleteTask(taskId: string, signal?: AbortSignal): Promise<void> {
    await this.request<unknown>(
      `/contents/generations/tasks/${encodeURIComponent(taskId)}`,
      { method: 'DELETE' },
      signal,
    );
  }

  /**
   * GET /contents/generations/tasks — the cheapest call that proves a key
   * works, which is what the Providers page "Test" button needs: it lists
   * recent tasks and generates nothing.
   */
  async listTasks(signal?: AbortSignal): Promise<{ items?: BytePlusTask[] }> {
    return this.request<{ items?: BytePlusTask[] }>(
      '/contents/generations/tasks?page_size=1',
      { method: 'GET' },
      signal,
    );
  }

  private async request<TResponse>(
    path: string,
    init: { method: 'GET' | 'POST' | 'DELETE'; body?: unknown },
    signal?: AbortSignal,
  ): Promise<TResponse> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal,
      });
    } catch (error) {
      log.error('Network error connecting to BytePlus ModelArk', error);
      throw new BytePlusHttpError(
        'Network error connecting to BytePlus ModelArk',
        undefined,
        undefined,
        error,
      );
    }

    if (!response.ok) {
      let message = `BytePlus ModelArk returned ${response.status}`;
      let code: string | undefined;
      try {
        const body = (await response.json()) as ArkErrorBody;
        code = body.error?.code;
        message = body.error?.message ?? body.message ?? message;
      } catch {
        // Non-JSON error body — keep the status-code message.
      }
      log.error('BytePlus ModelArk API error', new Error(message), {
        status: response.status,
        ...(code ? { code } : {}),
      });
      throw new BytePlusHttpError(message, response.status, code);
    }

    // DELETE returns 200/204 with an empty body.
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as TResponse;
  }
}
