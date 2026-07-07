export interface OpenRouterClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface OpenRouterChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenRouterContentPart[];
}

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterChatMessage[];
  modalities?: Array<'text' | 'image'>;
  imageConfig?: { aspect_ratio?: string };
  n?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
}

export interface OpenRouterChatResult {
  text?: string;
  /** Generated images as data URIs (from message.images[].image_url.url). */
  images: Array<{ dataUri: string }>;
  usage?: OpenRouterUsage;
  raw: unknown;
}

export type OpenRouterAudioFormat =
  | 'mp3'
  | 'wav'
  | 'flac'
  | 'm4a'
  | 'ogg'
  | 'webm'
  | 'aac';

export interface OpenRouterTranscriptionRequest {
  model: string;
  /** Raw base64 audio bytes (not a data URI). */
  audioBase64: string;
  format: OpenRouterAudioFormat;
  language?: string;
  temperature?: number;
}

export interface OpenRouterTranscriptionResult {
  text: string;
  usage?: OpenRouterUsage;
  raw: unknown;
}

/** Raw chat/completions response shape (shared by chat + image endpoints). */
export interface OpenRouterChatApiResponse {
  choices?: Array<{
    message: {
      role: string;
      content?: string;
      images?: Array<{ type: 'image_url'; image_url: { url: string } }>;
    };
  }>;
  usage?: OpenRouterUsage;
  error?: { message?: string; type?: string; code?: number };
}
