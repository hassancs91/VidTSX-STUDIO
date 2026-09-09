// The Studio editing agent: runs Assistant-tab chat turns through the LLM
// engine with typed in-process tools (Agent SDK MCP server, assembled from
// `agent-tools/`). The agent reads verbatim transcripts and PROPOSES edits —
// every proposal is pushed to the renderer, which feeds it into the same
// review UI as the toolbar buttons. The agent never edits the timeline; the
// user's review is the hard gate.

import type {
  StudioAgentEvent,
  StudioAgentSendRequest,
  StudioAgentSendResponse,
} from '../../../shared/ipc/types/studio';
import { THINKING_CONFIGS } from '../../../shared/tsx-engine/thinking-config';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { llmEngine } from '../../../engine';
import { getLlmProviders } from '../settings';
import { logEngine } from '../../../logging/log-engine';
import { loadProject } from './project-store';
import { listMemories } from './agent-memory';
import { composeMemoryBlock } from './agent-memory-prompt';
import { STUDIO_ALLOWED_TOOLS, buildStudioToolServer, createTurnState } from './agent-tools';

const log = logEngine.createLogger('StudioAgent');

// Editorial policy + shot craft/entry policy — composed into the system
// prompt by runLlmGenerate (policy in skills, contracts in tool schemas).
const AGENT_SKILL_IDS = ['studio-clean-cut', 'studio-make-tsx'];
// A bulk shots pass is up to 10 generate calls + a proposal + conversation;
// the W3 end-to-end run adds transcribe, auto cut, b-roll, captions and
// export on top, each with a card — 32 was too few for eight steps.
const AGENT_MAX_TURNS = 64;

type Listener = (event: StudioAgentEvent) => void;

class StudioAgentService {
  private listeners = new Set<Listener>();

  /** One in-flight turn per project. */
  private runs = new Map<string, AbortController>();

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: StudioAgentEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  cancel(projectId: string): boolean {
    const abort = this.runs.get(projectId);
    if (!abort) return false;
    abort.abort();
    return true;
  }

  async send(req: StudioAgentSendRequest, buildSystemPrompt: (toolsAvailable: boolean) => string): Promise<StudioAgentSendResponse> {
    if (this.runs.has(req.projectId)) {
      return { success: false, error: 'The assistant is already working on this project — cancel it first.' };
    }
    const abort = new AbortController();
    this.runs.set(req.projectId, abort);
    try {
      // H2: a per-project provider that no longer exists must not error every
      // turn — fall back to the app default, matching the Inspector's
      // "(unavailable — agent uses the app default)" label.
      const providerId =
        req.providerId && llmEngine.getProviders().includes(req.providerId)
          ? req.providerId
          : undefined;
      if (req.providerId && !providerId) {
        log.warn('Project provider not registered — using app default', {
          requested: req.providerId,
        });
      }

      const toolsAvailable = await this.resolveToolSupport(providerId);
      const mcpServer = toolsAvailable
        ? buildStudioToolServer({
            req,
            signal: abort.signal,
            ...(providerId ? { providerId } : {}),
            emit: (event) => this.emit(event),
            state: createTurnState(),
          })
        : null;
      const memoryBlock = await this.buildMemoryBlock(req.projectId);
      // The thinking dial maps to the engine's thinking + effort pair exactly
      // as the Creator's does; the provider drops both on models without them.
      const thinking = THINKING_CONFIGS[req.thinking ?? 'off'] ?? {};

      const extras = {
        ...(mcpServer ? { mcpServers: { studio: mcpServer } } : {}),
        ...(memoryBlock ? { trailingSystemPrompt: memoryBlock } : {}),
      };
      const result = await runLlmGenerate(
        {
          prompt: req.prompt,
          messages: [...req.history, { role: 'user', content: req.prompt }],
          systemPrompt: buildSystemPrompt(toolsAvailable),
          skillIds: AGENT_SKILL_IDS,
          maxTurns: AGENT_MAX_TURNS,
          featureSource: 'auto-cut',
          ...(providerId ? { providerId } : {}),
          ...(req.model ? { model: req.model } : {}),
          ...(thinking.thinking ? { thinking: thinking.thinking } : {}),
          ...(thinking.effort ? { effort: thinking.effort } : {}),
          ...(toolsAvailable ? { allowedTools: [...STUDIO_ALLOWED_TOOLS] } : {}),
        },
        abort.signal,
        (delta) => this.emit({ projectId: req.projectId, kind: 'delta', text: delta }),
        Object.keys(extras).length > 0 ? extras : undefined,
      );

      return {
        success: result.success,
        toolsAvailable,
        ...(result.text !== undefined ? { text: result.text } : {}),
        ...(result.error !== undefined ? { error: result.error } : {}),
      };
    } finally {
      this.runs.delete(req.projectId);
    }
  }

  /** Active in-scope memories, composed as the LAST system-prompt block —
   *  after the skills — so a memory edit never re-writes the skill text out
   *  of the prompt cache. Memory must never break a turn: any failure here
   *  logs and the turn runs without it. */
  private async buildMemoryBlock(projectId: string): Promise<string | undefined> {
    try {
      const memories = await listMemories();
      let brandId: string | undefined;
      try {
        brandId = (await loadProject(projectId)).settings.brandId;
      } catch {
        brandId = undefined; // No project brand — app-wide memories still apply.
      }
      const composed = composeMemoryBlock(memories, { ...(brandId ? { brandId } : {}) });
      if (composed.rulesOverflowBy > 0) {
        log.warn('Memory rules alone exceed the prompt budget — block emitted whole', {
          overflowChars: composed.rulesOverflowBy,
        });
      }
      // No silent caps: truncation must be visible somewhere.
      if (composed.droppedProfile || composed.droppedVocabulary > 0) {
        log.warn('Memory block truncated to fit the prompt budget', {
          droppedProfile: composed.droppedProfile,
          droppedVocabulary: composed.droppedVocabulary,
        });
      }
      return composed.block || undefined;
    } catch (err) {
      log.warn('Agent memory unavailable for this turn', {
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }

  /** Typed tools ride the Agent SDK; other provider types get chat only. */
  private async resolveToolSupport(providerId?: string): Promise<boolean> {
    try {
      const { providers, activeProvider } = await getLlmProviders();
      const id = providerId || activeProvider;
      const config = providers.find((p) => p.id === id);
      // Unknown config (e.g. fresh subscription default) — the presets are
      // predominantly agent-sdk, so assume tools work; worst case the model
      // simply never sees a tool call succeed.
      return config ? config.type === 'agent-sdk' : true;
    } catch {
      return true;
    }
  }
}

export const studioAgent = new StudioAgentService();
