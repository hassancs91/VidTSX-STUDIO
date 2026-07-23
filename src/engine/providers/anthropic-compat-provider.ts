import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages";
import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent } from "../types";
import { LLMEngineError } from "../types";
import { getHumanReadableError, getStatusCode, RequestAbortRegistry } from "../utils";
import { logEngine } from "../../logging/log-engine";

const log = logEngine.createLogger('AnthropicCompat');

export class AnthropicCompatProvider implements LLMProvider {
  private client: Anthropic;
  private aborts = new RequestAbortRegistry();

  constructor(
    readonly id: string,
    private apiKey: string,
    private baseURL: string,
    private defaultModel: string
  ) {
    this.client = new Anthropic({ apiKey, baseURL });
  }

  private buildMessages(request: LLMRequest): MessageParam[] {
    if (request.messages) return request.messages;

    const hasImages = request.images && request.images.length > 0;
    if (!hasImages) {
      return [{ role: 'user' as const, content: request.prompt }];
    }

    return [{
      role: 'user' as const,
      content: [
        ...request.images!.map((img) => ({
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
        })),
        { type: 'text' as const, text: request.prompt },
      ],
    }];
  }

  abort(): void {
    this.aborts.abortAll();
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const controller = this.aborts.open(request.signal);
    try {
      const start = Date.now();
      const model = request.model || this.defaultModel;
      const thinkingEnabled = request.thinking && request.thinking.type !== "disabled";
      const budgetTokens = request.thinking?.budgetTokens || 10240;
      const maxTokens = request.maxTokens || 8192;

      const response = await this.client.messages.create({
        model,
        max_tokens: thinkingEnabled ? maxTokens + budgetTokens : maxTokens,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
        ...(!thinkingEnabled && request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(thinkingEnabled
          ? { thinking: request.thinking!.type === "adaptive"
              ? { type: "adaptive" as const }
              : { type: "enabled" as const, budget_tokens: budgetTokens }
            }
          : {}),
        messages: this.buildMessages(request),
      }, { signal: controller.signal });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        text,
        model: response.model,
        provider: this.id,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        durationMs: Date.now() - start,
      };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new LLMEngineError("Request cancelled", this.id, undefined, error);
      }
      log.error('Generate failed', error, { providerId: this.id });
      const message = getHumanReadableError(error, this.id);
      throw new LLMEngineError(message, this.id, getStatusCode(error), error);
    } finally {
      this.aborts.close(controller);
    }
  }

  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamEvent> {
    const controller = this.aborts.open(request.signal);
    try {
      const start = Date.now();
      const model = request.model || this.defaultModel;
      let fullText = "";
      const thinkingEnabled = request.thinking && request.thinking.type !== "disabled";
      const budgetTokens = request.thinking?.budgetTokens || 10240;
      const maxTokens = request.maxTokens || 8192;

      const stream = this.client.messages.stream({
        model,
        max_tokens: thinkingEnabled ? maxTokens + budgetTokens : maxTokens,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
        ...(!thinkingEnabled && request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(thinkingEnabled
          ? { thinking: request.thinking!.type === "adaptive"
              ? { type: "adaptive" as const }
              : { type: "enabled" as const, budget_tokens: budgetTokens }
            }
          : {}),
        messages: this.buildMessages(request),
      }, { signal: controller.signal });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          yield { type: "text", text: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();

      yield {
        type: "done",
        response: {
          text: fullText,
          model: finalMessage.model,
          provider: this.id,
          usage: {
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
          },
          durationMs: Date.now() - start,
        },
      };
    } catch (error) {
      if (controller.signal.aborted) {
        yield { type: "error", error: "Request cancelled" };
        return;
      }
      log.error('Stream generate failed', error, { providerId: this.id });
      const message = getHumanReadableError(error, this.id);
      yield { type: "error", error: message };
    } finally {
      this.aborts.close(controller);
    }
  }
}
