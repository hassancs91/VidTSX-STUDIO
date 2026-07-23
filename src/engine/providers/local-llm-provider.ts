import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent } from "../types";
import { LLMEngineError } from "../types";
import { logEngine } from "../../logging/log-engine";
import type { LlmChatMessage } from "../../llm-engine/types";
import { llmLocalEngine } from "../../llm-engine";

const log = logEngine.createLogger('LocalLlmProvider');

const NO_MODEL_MSG =
  "No local model is loaded. Load one in AI Models → Text before using the Local provider.";

/**
 * Bridges the node-llama-cpp local engine into the cloud LLMEngine provider
 * interface, so features like the Creator can target local models with zero
 * API keys. The local engine holds ONE llama context, so requests serialize
 * through an internal queue — parallel jobs on this provider run one at a
 * time rather than interleaving tokens.
 */
export class LocalLlmProvider implements LLMProvider {
  readonly id: string;

  private queue: Promise<unknown> = Promise.resolve();
  private requestCounter = 0;
  private cancelled = new Set<string>();

  constructor(id: string) {
    this.id = id;
  }

  private buildMessages(request: LLMRequest): LlmChatMessage[] {
    const messages: LlmChatMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    if (request.messages && request.messages.length > 0) {
      messages.push(...request.messages);
    } else {
      messages.push({ role: 'user', content: request.prompt });
    }
    return messages;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const requestId = `${this.id}_${++this.requestCounter}`;

    const run = async (): Promise<LLMResponse> => {
      if (request.signal?.aborted || this.cancelled.has(requestId)) {
        this.cancelled.delete(requestId);
        throw new LLMEngineError("Request cancelled", this.id);
      }
      if (!llmLocalEngine.getActiveModelId()) {
        throw new LLMEngineError(NO_MODEL_MSG, this.id);
      }

      const onAbort = () => llmLocalEngine.cancelGeneration();
      request.signal?.addEventListener("abort", onAbort, { once: true });

      const start = Date.now();
      try {
        const result = await llmLocalEngine.generateChat(requestId, {
          messages: this.buildMessages(request),
          params: {
            ...(request.maxTokens ? { maxTokens: request.maxTokens } : { maxTokens: 8192 }),
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          },
        }, request.onTextDelta ? (event) => {
          try { request.onTextDelta!(event.token); } catch { /* ignore UI callback errors */ }
        } : undefined);

        if (result.stopReason === 'cancelled') {
          throw new LLMEngineError("Request cancelled", this.id);
        }

        return {
          text: result.text,
          model: llmLocalEngine.getActiveModelId() ?? 'local',
          provider: this.id,
          usage: { inputTokens: 0, outputTokens: result.tokensGenerated },
          durationMs: Date.now() - start,
          debugLog: [`[engine] local generation — ${result.tokensGenerated} tokens @ ${result.tokensPerSecond} tok/s`],
        };
      } catch (error) {
        if (error instanceof LLMEngineError) throw error;
        log.error('Local generation failed', error);
        throw new LLMEngineError(error instanceof Error ? error.message : 'Local generation failed', this.id, undefined, error);
      } finally {
        request.signal?.removeEventListener("abort", onAbort);
      }
    };

    // Serialize behind whatever is already queued (single llama context)
    const resultPromise = this.queue.then(run, run);
    this.queue = resultPromise.catch(() => {});
    return resultPromise;
  }

  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamEvent> {
    const chunks: string[] = [];
    try {
      const response = await this.generate({
        ...request,
        onTextDelta: (delta) => chunks.push(delta),
      });
      for (const chunk of chunks) {
        yield { type: "text", text: chunk };
      }
      yield { type: "done", response };
    } catch (error) {
      yield { type: "error", error: error instanceof Error ? error.message : 'Local generation failed' };
    }
  }

  abort(): void {
    llmLocalEngine.cancelGeneration();
  }
}
