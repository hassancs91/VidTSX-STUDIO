import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent } from "../types";
import { LLMEngineError } from "../types";
import { getHumanReadableError, getStatusCode, RequestAbortRegistry, generateViaStream } from "../utils";
import { logEngine } from "../../logging/log-engine";

const log = logEngine.createLogger('OpenAICompat');

export class OpenAICompatProvider implements LLMProvider {
  private client: OpenAI;
  private aborts = new RequestAbortRegistry();

  constructor(
    readonly id: string,
    private apiKey: string,
    private baseURL: string,
    private defaultModel: string
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  private buildMessages(request: LLMRequest): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    if (request.messages) {
      for (const msg of request.messages) {
        messages.push({ role: msg.role, content: msg.content });
      }
      return messages;
    }

    const hasImages = request.images && request.images.length > 0;
    if (!hasImages) {
      messages.push({ role: 'user', content: request.prompt });
    } else {
      const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        ...request.images!.map((img): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
          type: 'image_url',
          image_url: { url: `data:${img.mediaType};base64,${img.data}` },
        })),
        { type: 'text', text: request.prompt },
      ];
      messages.push({ role: 'user', content });
    }

    return messages;
  }

  abort(): void {
    this.aborts.abortAll();
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (request.onTextDelta) return generateViaStream(this, request);
    const controller = this.aborts.open(request.signal);
    try {
      const start = Date.now();
      const model = request.model || this.defaultModel;

      const response = await this.client.chat.completions.create({
        model,
        max_completion_tokens: request.maxTokens || 8192,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        messages: this.buildMessages(request),
      }, { signal: controller.signal });

      const choice = response.choices[0];
      const text = choice?.message?.content ?? '';

      return {
        text,
        model: response.model,
        provider: this.id,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
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
      let fullText = '';

      const stream = await this.client.chat.completions.create({
        model,
        max_completion_tokens: request.maxTokens || 8192,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        messages: this.buildMessages(request),
        stream: true,
      }, { signal: controller.signal });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          yield { type: 'text', text: delta };
        }
      }

      yield {
        type: 'done',
        response: {
          text: fullText,
          model,
          provider: this.id,
          usage: { inputTokens: 0, outputTokens: 0 },
          durationMs: Date.now() - start,
        },
      };
    } catch (error) {
      if (controller.signal.aborted) {
        yield { type: 'error', error: 'Request cancelled' };
        return;
      }
      log.error('Stream generate failed', error, { providerId: this.id });
      const message = getHumanReadableError(error, this.id);
      yield { type: 'error', error: message };
    } finally {
      this.aborts.close(controller);
    }
  }
}
