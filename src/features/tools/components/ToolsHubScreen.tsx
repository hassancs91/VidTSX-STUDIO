import { useState } from 'react';
import { Workflow } from 'lucide-react';
import { openFlowRunForm, useFlowHandoffs } from '@renderer/hooks/flows/useFlowHandoffs';
import { builtinFlowTools } from '../services/flow-tools';
import { FrameExtractorScreen } from './FrameExtractorScreen';
import { AIChatScreen } from './AIChatScreen';
import { ThumbnailGeneratorScreen } from './ThumbnailGeneratorScreen';
import { ThumbnailTesterScreen } from './thumbnail-tester/ThumbnailTesterScreen';
import { VoiceAITesterScreen } from './VoiceAITesterScreen';
import { ImageAITesterScreen } from './ImageAITesterScreen';
import { LlmAITesterScreen } from './LlmAITesterScreen';
import { EmbeddingTesterScreen } from './EmbeddingTesterScreen';
import { ModerationTesterScreen } from './ModerationTesterScreen';

interface ToolCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const tools: ToolCard[] = [
  {
    id: 'ai-chat',
    name: 'AI Chat',
    description: 'Test and debug the AI engine. Chat with any provider, inspect thinking, measure response times.',
    icon: (
      <svg
        width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        <path d="M8 9h8" />
        <path d="M8 13h4" />
      </svg>
    ),
  },
  {
    id: 'frame-extractor',
    name: 'Frame Extractor',
    description: 'Extract frames from videos and GIFs at custom FPS, save as ZIP or individual images.',
    icon: (
      <svg
        width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9H21" />
        <path d="M7 5V9" />
        <path d="M12 5V9" />
        <path d="M17 5V9" />
        <path d="M10 13L10 17" />
        <path d="M14 13L14 17" />
      </svg>
    ),
  },
  {
    id: 'thumbnail-generator',
    name: 'YouTube Thumbnail Generator',
    description: 'Generate creative thumbnail image prompts using AI. Send directly to Image Studio for bulk generation.',
    icon: (
      <svg
        width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="2" y="4" width="20" height="12" rx="2" />
        <path d="M10 8L14 10L10 12V8Z" />
        <path d="M6 20L8 16" />
        <path d="M18 20L16 16" />
        <path d="M12 20V16" />
      </svg>
    ),
  },
  {
    id: 'thumbnail-tester',
    name: 'Thumbnail Tester',
    description: 'Preview your YouTube thumbnail in a realistic home page grid to see if it stands out among competitors.',
    icon: (
      <svg
        width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M2 7H22" />
        <rect x="4" y="9" width="7" height="5" rx="1" />
        <rect x="13" y="9" width="7" height="5" rx="1" />
        <path d="M8 20H16" />
        <path d="M12 17V20" />
      </svg>
    ),
  },
  {
    id: 'voice-ai-tester',
    name: 'Voice AI Tester',
    description: 'Test and debug local STT and TTS models. Generate speech, transcribe files, and stream live mic input.',
    icon: (
      <svg
        width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="9" y="2" width="6" height="11" rx="3" />
        <path d="M5 10a7 7 0 0014 0" />
        <path d="M12 17v3" />
        <path d="M8 21h8" />
      </svg>
    ),
  },
  {
    id: 'image-ai-tester',
    name: 'Image AI Tester',
    description: 'Test local Stable Diffusion models. Generate images with sd-cli, adjust parameters, and preview results.',
    icon: (
      <svg
        width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15L16 10L5 21" />
      </svg>
    ),
  },
  {
    id: 'llm-ai-tester',
    name: 'LLM Tester',
    description: 'Test local LLM models. Run completions and chat with GGUF models, stream tokens, and measure performance.',
    icon: (
      <svg
        width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M12 2L2 7L12 12L22 7L12 2Z" />
        <path d="M2 17L12 22L22 17" />
        <path d="M2 12L12 17L22 12" />
      </svg>
    ),
  },
  {
    id: 'embedding-tester',
    name: 'Embedding Tester',
    description: 'Test embedding models. Embed texts, view raw vectors, compare cosine similarity, and measure latency.',
    icon: (
      <svg
        width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx="6" cy="6" r="3" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="18" r="3" />
        <path d="M9 6H15" />
        <path d="M6 9V15" />
        <path d="M18 9V15" />
        <path d="M9 18H15" />
        <path d="M9 9L15 15" />
      </svg>
    ),
  },
  {
    id: 'moderation-tester',
    name: 'Moderation Tester',
    description: 'Test the content moderation engine. Enter prompts and see if they get flagged for prohibited content across 20 languages.',
    icon: (
      <svg
        width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M12 2L3.5 6v5c0 5.25 3.6 10.15 8.5 11.35C16.9 21.15 20.5 16.25 20.5 11V6L12 2z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

export function ToolsHubScreen() {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  // W8 Stage 6 (flows plan §0.1 item 3): the built-in flows beside the screens.
  const { flows, loaded: flowsLoaded } = useFlowHandoffs(null);
  const flowTools = builtinFlowTools(flows);

  if (activeTool === 'ai-chat') {
    return <AIChatScreen onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'frame-extractor') {
    return <FrameExtractorScreen onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'thumbnail-generator') {
    return <ThumbnailGeneratorScreen onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'thumbnail-tester') {
    return <ThumbnailTesterScreen onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'voice-ai-tester') {
    return <VoiceAITesterScreen onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'image-ai-tester') {
    return <ImageAITesterScreen onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'llm-ai-tester') {
    return <LlmAITesterScreen onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'embedding-tester') {
    return <EmbeddingTesterScreen onBack={() => setActiveTool(null)} />;
  }

  if (activeTool === 'moderation-tester') {
    return <ModerationTesterScreen onBack={() => setActiveTool(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">
          Tools
        </span>
      </div>

      {/* Tool Grid */}
      <div className="flex-1 overflow-auto p-4">
        <h2 className="text-[11px] font-medium text-text-muted mb-2">Screens</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className="flex flex-col items-start gap-3 p-4 rounded-[8px] bg-app-surface hover:bg-app-hover transition-colors text-left group"
              style={{ border: '0.5px solid var(--color-border)' }}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-[8px] bg-app-base text-text-muted group-hover:text-accent transition-colors">
                {tool.icon}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[12px] text-text-primary font-medium">
                  {tool.name}
                </p>
                <p className="text-[10px] text-text-dim leading-relaxed">
                  {tool.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Flows — the built-ins, each opening its run form on the Flows screen (§1.8). */}
        <h2 className="text-[11px] font-medium text-text-muted mt-6 mb-2" data-tools-flows-group>
          Flows
          <span className="text-text-dim"> · {flowTools.length}</span>
        </h2>
        {flowTools.length === 0 ? (
          <p className="text-[11px] text-text-dim">{flowsLoaded ? 'No built-in flows were found.' : 'Loading flows…'}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {flowTools.map((flow) => (
              <button
                key={flow.flowId}
                onClick={() => openFlowRunForm({ flowId: flow.flowId })}
                className="flex flex-col items-start gap-3 p-4 rounded-[8px] bg-app-surface hover:bg-app-hover transition-colors text-left group"
                style={{ border: '0.5px solid var(--color-border)' }}
                data-tools-flow={flow.flowId}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-[8px] bg-app-base text-text-muted group-hover:text-accent transition-colors">
                  <Workflow size={24} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[12px] text-text-primary font-medium">
                    {flow.name}
                    <span className="ml-1.5 text-[9px] px-1.5 py-[1px] rounded align-middle" style={{ background: '#085041', color: '#5DCAA5' }}>flow</span>
                  </p>
                  <p className="text-[10px] text-text-dim leading-relaxed">{flow.description}</p>
                  {flow.besides ? (
                    <p className="text-[10px] text-text-dim">
                      Beside the {flow.besides === 'thumbnail-generator' ? 'Thumbnail Generator' : 'Frame Extractor'} screen
                    </p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
