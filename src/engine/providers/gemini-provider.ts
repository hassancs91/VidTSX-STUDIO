import { GoogleGenAI, type Content, type Part } from "@google/genai";
import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamEvent } from "../types";
import { LLMEngineError } from "../types";
import { getHumanReadableError, getStatusCode } from "../utils";
import { logEngine } from "../../logging/log-engine";

const log = logEngine.createLogger('Gemini');

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;

  constructor(
    readonly id: string,
    private apiKey: string,
    private defaultModel: string
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  private buildContents(request: LLMRequest): Content[] {
    if (request.messages) {
      return request.messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
    }

    const parts: Part[] = [];

    if (request.images && request.images.length > 0) {
      for (const img of request.images) {
        parts.push({
          inlineData: { mimeType: img.mediaType, data: img.data },
        });
      }
    }

    parts.push({ text: request.prompt });

    return [{ role: 'user', parts }];
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const start = Date.now();
      const model = request.model || this.defaultModel;

      const response = await this.client.models.generateContent({
        model,
        contents: this.buildContents(request),
        config: {
          maxOutputTokens: request.maxTokens || 8192,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.systemPrompt ? { systemInstruction: request.systemPrompt } : {}),
        },
      });

      const text = response.text ?? '';
      const usage = response.usageMetadata;

      return {
        text,
        model,
        provider: this.id,
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        },
        durationMs: Date.now() - start,
      };
    } catch (error) {
      log.error('Generate failed', error, { providerId: this.id });
      const message = getHumanReadableError(error, this.id);
      throw new LLMEngineError(message, this.id, getStatusCode(error), error);
    }
  }

  async *streamGenerate(request: LLMRequest): AsyncIterable<LLMStreamEvent> {
    try {
      const start = Date.now();
      const model = request.model || this.defaultModel;
      let fullText = '';

      const response = await this.client.models.generateContentStream({
        model,
        contents: this.buildContents(request),
        config: {
          maxOutputTokens: request.maxTokens || 8192,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.systemPrompt ? { systemInstruction: request.systemPrompt } : {}),
        },
      });

      for await (const chunk of response) {
        const delta = chunk.text;
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
      log.error('Stream generate failed', error, { providerId: this.id });
      const message = getHumanReadableError(error, this.id);
      yield { type: 'error', error: message };
    }
  }
}
