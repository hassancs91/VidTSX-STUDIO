import { existsSync } from 'fs';
import type {
  LlmModelDefinition,
  LlmCompletionRequest,
  LlmChatRequest,
  LlmGenerationResult,
  LlmTokenEvent,
  LlmGpuInfo,
  GpuBackend,
} from './types';
import { LLM_MODEL_CATALOG } from './model-registry';

// ─── Lazy-loaded node-llama-cpp ────────────────────────────────────

type LlamaModule = typeof import('node-llama-cpp');
let llamaModule: LlamaModule | null = null;
let llamaLoadAttempted = false;

async function loadLlamaCpp(): Promise<LlamaModule | null> {
  if (llamaLoadAttempted) return llamaModule;
  llamaLoadAttempted = true;
  try {
    llamaModule = await import('node-llama-cpp');
  } catch {
    llamaModule = null;
  }
  return llamaModule;
}

// ─── Engine ────────────────────────────────────────────────────────

class LlmLocalEngine {
  private modelsBasePath = '';
  private activeModelId: string | null = null;

  // node-llama-cpp instances (one model at a time)
  private llamaInstance: Awaited<ReturnType<LlamaModule['getLlama']>> | null = null;
  private loadedModel: unknown | null = null;
  private modelContext: unknown | null = null;
  private completionSequence: unknown | null = null;

  // Chat sessions for multi-turn (sessionId -> { session, sequence })
  private sessions = new Map<string, { session: unknown; sequence: unknown }>();
  private nextSessionId = 1;

  // Cancellation
  private activeAbortController: AbortController | null = null;

  // GPU info cache
  private gpuInfo: LlmGpuInfo | null = null;

  initialize(modelsBasePath: string): void {
    this.modelsBasePath = modelsBasePath;
  }

  async isAvailable(): Promise<boolean> {
    const mod = await loadLlamaCpp();
    return mod !== null;
  }

  getModelsBasePath(): string {
    return this.modelsBasePath;
  }

  getModelInfo(modelId: string): LlmModelDefinition | undefined {
    return LLM_MODEL_CATALOG.find((m) => m.id === modelId);
  }

  getAvailableModels(): LlmModelDefinition[] {
    return LLM_MODEL_CATALOG.filter((m) => !m.hidden);
  }

  getActiveModelId(): string | null {
    return this.activeModelId;
  }

  getGpuInfo(): LlmGpuInfo | null {
    return this.gpuInfo;
  }

  async detectGpu(): Promise<LlmGpuInfo> {
    const mod = await loadLlamaCpp();
    if (!mod) {
      this.gpuInfo = { backend: 'cpu' };
      return this.gpuInfo;
    }

    try {
      const llama = await mod.getLlama({ gpu: 'auto' });
      const gpuType = llama.gpu; // "cuda" | "vulkan" | "metal" | false

      let backend: GpuBackend = 'cpu';
      if (gpuType === 'cuda') backend = 'cuda';
      else if (gpuType === 'vulkan') backend = 'vulkan';
      else if (gpuType === 'metal') backend = 'metal';

      let deviceName: string | undefined;
      let vramMb: number | undefined;

      if (gpuType) {
        try {
          const deviceNames = await llama.getGpuDeviceNames();
          deviceName = deviceNames[0];
        } catch { /* ignore */ }

        try {
          const vramState = await llama.getVramState();
          vramMb = Math.round(vramState.total / (1024 * 1024));
        } catch { /* ignore */ }
      }

      this.gpuInfo = { backend, deviceName, vramMb };

      // Don't keep this llama instance — loadModel will create a fresh one
      await llama.dispose();
      return this.gpuInfo;
    } catch {
      this.gpuInfo = { backend: 'cpu' };
      return this.gpuInfo;
    }
  }

  async loadModel(modelId: string, modelFilePath: string): Promise<void> {
    const mod = await loadLlamaCpp();
    if (!mod) {
      throw new Error('node-llama-cpp is not available');
    }

    if (!existsSync(modelFilePath)) {
      throw new Error(`Model file not found: ${modelFilePath}`);
    }

    const modelDef = this.getModelInfo(modelId);
    if (!modelDef) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    // Unload current model first
    await this.unloadModel();

    // Create Llama instance (auto-detects best GPU backend)
    this.llamaInstance = await mod.getLlama({ gpu: 'auto' });

    // Load model
    this.loadedModel = await this.llamaInstance.loadModel({
      modelPath: modelFilePath,
    });

    // Create context with reasonable KV cache size (cap at 4096 to save memory)
    const contextSize = Math.min(modelDef.contextLength, 4096);
    this.modelContext = await (this.loadedModel as { createContext: (opts: { contextSize: number }) => Promise<unknown> }).createContext({
      contextSize,
    });

    this.activeModelId = modelId;
  }

  async unloadModel(): Promise<void> {
    // Dispose all sessions
    this.clearAllSessions();

    if (this.completionSequence) {
      (this.completionSequence as { dispose: () => void }).dispose();
      this.completionSequence = null;
    }

    if (this.modelContext) {
      await (this.modelContext as { dispose: () => Promise<void> }).dispose();
      this.modelContext = null;
    }

    if (this.loadedModel) {
      await (this.loadedModel as { dispose: () => Promise<void> }).dispose();
      this.loadedModel = null;
    }

    if (this.llamaInstance) {
      await this.llamaInstance.dispose();
      this.llamaInstance = null;
    }

    this.activeModelId = null;
  }

  async generateCompletion(
    requestId: string,
    request: LlmCompletionRequest,
    onToken?: (event: LlmTokenEvent) => void,
  ): Promise<LlmGenerationResult> {
    if (!this.modelContext || !this.loadedModel) {
      throw new Error('No model loaded');
    }

    const mod = await loadLlamaCpp();
    if (!mod) throw new Error('node-llama-cpp not available');

    this.activeAbortController = new AbortController();
    const { signal } = this.activeAbortController;

    const params = request.params ?? {};
    const maxTokens = params.maxTokens ?? 2048;

    let fullText = '';
    let tokensGenerated = 0;
    const startTime = Date.now();

    // Free all sequence slots before creating a fresh one
    this.clearAllSessions();
    if (this.completionSequence) {
      (this.completionSequence as { dispose: () => void }).dispose();
      this.completionSequence = null;
    }
    const ctx = this.modelContext as { getSequence: () => unknown };
    this.completionSequence = ctx.getSequence();

    try {
      const completionEngine = new mod.LlamaCompletion({
        contextSequence: this.completionSequence as never,
      });

      const result = await completionEngine.generateCompletion(request.prompt, {
        maxTokens,
        temperature: params.temperature ?? 0.7,
        topP: params.topP ?? 0.9,
        topK: params.topK ?? 40,
        repeatPenalty: params.repeatPenalty !== undefined ? {
          penalty: params.repeatPenalty,
        } : undefined,
        signal,
        customStopTriggers: params.stop,
        onToken: (tokens: unknown[]) => {
          const tokenText = (this.loadedModel as { detokenize: (t: unknown) => string }).detokenize(tokens);
          fullText += tokenText;
          tokensGenerated += tokens.length;

          if (onToken) {
            onToken({ requestId, token: tokenText, text: fullText });
          }
        },
      });

      const durationMs = Date.now() - startTime;
      const tokensPerSecond = durationMs > 0 ? (tokensGenerated / durationMs) * 1000 : 0;

      return {
        text: typeof result === 'string' ? result : fullText,
        tokensGenerated,
        tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
        stopReason: signal.aborted ? 'cancelled' : 'stop',
      };
    } catch (err) {
      if (signal.aborted) {
        const durationMs = Date.now() - startTime;
        return {
          text: fullText,
          tokensGenerated,
          tokensPerSecond: durationMs > 0 ? Math.round((tokensGenerated / durationMs) * 1000 * 10) / 10 : 0,
          stopReason: 'cancelled',
        };
      }
      throw err;
    } finally {
      this.activeAbortController = null;
    }
  }

  async generateChat(
    requestId: string,
    request: LlmChatRequest,
    onToken?: (event: LlmTokenEvent) => void,
  ): Promise<LlmGenerationResult> {
    if (!this.modelContext || !this.loadedModel) {
      throw new Error('No model loaded');
    }

    const mod = await loadLlamaCpp();
    if (!mod) throw new Error('node-llama-cpp not available');

    this.activeAbortController = new AbortController();
    const { signal } = this.activeAbortController;

    const params = request.params ?? {};
    const maxTokens = params.maxTokens ?? 2048;

    // Find or create session
    let sessionId = request.sessionId;
    let session: unknown;

    if (sessionId && this.sessions.has(sessionId)) {
      session = this.sessions.get(sessionId)!.session;
    } else {
      // Dispose completion sequence to free the slot for chat
      if (this.completionSequence) {
        (this.completionSequence as { dispose: () => void }).dispose();
        this.completionSequence = null;
      }

      // Clear any previous sessions to free sequence slots
      this.clearAllSessions();

      sessionId = String(this.nextSessionId++);
      const context = this.modelContext as {
        getSequence: () => unknown;
      };
      const sequence = context.getSequence();

      const chatSession = new mod.LlamaChatSession({
        contextSequence: sequence as never,
      });
      this.sessions.set(sessionId, { session: chatSession, sequence });
      session = chatSession;
    }

    // Build the latest user message
    const lastMessage = request.messages[request.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('Last message must be from user');
    }

    // If there's a system message, set it on the first prompt
    const systemMessage = request.messages.find((m) => m.role === 'system');

    let fullText = '';
    let tokensGenerated = 0;
    const startTime = Date.now();

    try {
      const chatSession = session as {
        prompt: (text: string, options: Record<string, unknown>) => Promise<string>;
      };

      const result = await chatSession.prompt(lastMessage.content, {
        maxTokens,
        temperature: params.temperature ?? 0.7,
        topP: params.topP ?? 0.9,
        topK: params.topK ?? 40,
        repeatPenalty: params.repeatPenalty !== undefined ? {
          penalty: params.repeatPenalty,
        } : undefined,
        signal,
        ...(systemMessage ? { systemPrompt: systemMessage.content } : {}),
        onToken: (tokens: unknown) => {
          const tokenText = (this.loadedModel as { detokenize: (t: unknown) => string }).detokenize(tokens);
          fullText += tokenText;
          tokensGenerated += Array.isArray(tokens) ? tokens.length : 1;

          if (onToken) {
            onToken({ requestId, token: tokenText, text: fullText });
          }
        },
      });

      const durationMs = Date.now() - startTime;
      const tokensPerSecond = durationMs > 0 ? (tokensGenerated / durationMs) * 1000 : 0;

      return {
        text: typeof result === 'string' ? result : fullText,
        tokensGenerated,
        tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
        stopReason: signal.aborted ? 'cancelled' : 'stop',
        sessionId,
      };
    } catch (err) {
      if (signal.aborted) {
        const durationMs = Date.now() - startTime;
        return {
          text: fullText,
          tokensGenerated,
          tokensPerSecond: durationMs > 0 ? Math.round((tokensGenerated / durationMs) * 1000 * 10) / 10 : 0,
          stopReason: 'cancelled',
          sessionId,
        };
      }
      throw err;
    } finally {
      this.activeAbortController = null;
    }
  }

  cancelGeneration(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  clearSession(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      (entry.sequence as { dispose: () => void }).dispose();
      this.sessions.delete(sessionId);
    }
  }

  clearAllSessions(): void {
    for (const entry of this.sessions.values()) {
      try {
        (entry.sequence as { dispose: () => void }).dispose();
      } catch { /* ignore — may already be disposed */ }
    }
    this.sessions.clear();
    this.nextSessionId = 1;
  }

  async dispose(): Promise<void> {
    this.cancelGeneration();
    await this.unloadModel();
  }
}

export const llmLocalEngine = new LlmLocalEngine();
