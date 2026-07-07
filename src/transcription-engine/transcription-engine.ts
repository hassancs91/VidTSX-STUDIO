import type {
  ProviderTranscribeRequest,
  SttProviderConfig,
  SttRichResult,
  TranscriptionProvider,
} from './types';
import { TranscriptionEngineError } from './types';
import { LocalWhisperProvider } from './providers/local-whisper-provider';
import { AssemblyAiProvider } from './providers/assemblyai-provider';
import { OpenRouterSttProvider } from './providers/openrouter-stt-provider';
import { logEngine } from '../logging/log-engine';

const log = logEngine.createLogger('SttEngine');

class TranscriptionEngine {
  private providers = new Map<string, TranscriptionProvider>();

  register(config: SttProviderConfig): void {
    if (!config.enabled) return;

    // Local whisper needs no API key; remote providers do.
    if (config.type !== 'local-whisper' && !config.apiKey) {
      throw new Error(`API key required for transcription provider "${config.id}"`);
    }

    let provider: TranscriptionProvider;
    if (config.type === 'local-whisper') {
      provider = new LocalWhisperProvider(config.id);
    } else if (config.type === 'assemblyai') {
      provider = new AssemblyAiProvider(config.id, config.apiKey);
    } else if (config.type === 'openrouter') {
      provider = new OpenRouterSttProvider(config.id, config.apiKey);
    } else {
      throw new Error(`Unknown transcription provider type: ${config.type}`);
    }

    this.providers.set(config.id, provider);
    log.info('Provider registered', { providerId: config.id, type: config.type });
  }

  unregister(id: string): void {
    this.providers.delete(id);
  }

  getProvider(id: string): TranscriptionProvider | undefined {
    return this.providers.get(id);
  }

  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async transcribeWith(
    providerId: string,
    req: ProviderTranscribeRequest,
  ): Promise<SttRichResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new TranscriptionEngineError(
        `Transcription provider "${providerId}" not registered`,
        providerId,
      );
    }
    return provider.transcribe(req);
  }
}

export const transcriptionEngine = new TranscriptionEngine();
