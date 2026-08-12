// The Studio editing agent: runs Assistant-tab chat turns through the LLM
// engine with typed in-process tools (Agent SDK MCP server). The agent reads
// verbatim transcripts and PROPOSES editorial cuts — the proposal is pushed to
// the renderer, which feeds it into the same review UI as Auto Cut. The agent
// never edits the timeline; the user's review is the hard gate.

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type {
  StudioAgentEvent,
  StudioAgentSendRequest,
  StudioAgentSendResponse,
} from '../../../shared/ipc/types/studio';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { getLlmProviders } from '../settings';
import { logEngine } from '../../../logging/log-engine';
import { readTranscriptFile } from './asset-transcriber';
import { loadRmsEnvelope } from './cut-plan-runner';
import { formatTakesView } from './transcript-takes-view';
import {
  EDITORIAL_CATEGORIES,
  buildEditorialProposal,
  snapEditorialCuts,
} from './editorial-cuts';

const log = logEngine.createLogger('StudioAgent');

const AGENT_SKILL_ID = 'studio-clean-cut';
const AGENT_MAX_TURNS = 24;
const ALLOWED_TOOLS = ['mcp__studio__get_transcript', 'mcp__studio__propose_cuts'];

type Listener = (event: StudioAgentEvent) => void;

function text(content: string, isError = false) {
  return { content: [{ type: 'text' as const, text: content }], ...(isError ? { isError: true } : {}) };
}

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
      const toolsAvailable = await this.resolveToolSupport(req.providerId);
      const mcpServer = toolsAvailable ? this.buildTools(req) : null;

      const result = await runLlmGenerate(
        {
          prompt: req.prompt,
          messages: [...req.history, { role: 'user', content: req.prompt }],
          systemPrompt: buildSystemPrompt(toolsAvailable),
          skillIds: [AGENT_SKILL_ID],
          maxTurns: AGENT_MAX_TURNS,
          featureSource: 'auto-cut',
          ...(req.providerId ? { providerId: req.providerId } : {}),
          ...(req.model ? { model: req.model } : {}),
          ...(toolsAvailable ? { allowedTools: ALLOWED_TOOLS } : {}),
        },
        abort.signal,
        (delta) => this.emit({ projectId: req.projectId, kind: 'delta', text: delta }),
        mcpServer ? { mcpServers: { studio: mcpServer } } : undefined,
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

  private buildTools(req: StudioAgentSendRequest) {
    // Live per-run state shared by both tools: one proposal per turn, and a
    // refusal while the review panel already shows one.
    let proposalCreated = false;

    const getTranscript = tool(
      'get_transcript',
      "Read a media asset's word-level transcript as a takes view: numbered segments split on speech pauses, pause durations between them, filler words marked inline with exact second bounds.",
      { assetId: z.string().describe('Asset id from the project inventory') },
      async (args) => {
        const asset = req.assets.find((a) => a.id === args.assetId);
        this.emit({
          projectId: req.projectId,
          kind: 'tool',
          tool: 'get_transcript',
          ...(asset ? { detail: asset.name } : {}),
        });
        const file = await readTranscriptFile(req.projectId, args.assetId);
        if (!file) {
          return text(`No transcript for asset ${args.assetId} — ask the user to transcribe it first (Inspector → Transcript).`, true);
        }
        if (!file.words || file.words.length === 0) {
          return text('The transcript has no word timestamps, so an editorial pass cannot be authored from it. Recommend re-transcribing with AssemblyAI.', true);
        }
        const header: string[] = [];
        if (!file.features.verbatimDisfluencies) {
          header.push(
            'NOTE: this transcript is NOT verbatim — the engine tidied fillers away, so filler cuts cannot be found reliably. Retake/false-start detection still works.',
          );
        }
        header.push(formatTakesView(asset?.name ?? args.assetId, file.words));
        return text(header.join('\n\n'));
      },
    );

    const proposeCuts = tool(
      'propose_cuts',
      'Submit editorial cuts for one asset as source-time spans (seconds). Spans are snapped to the real audio and land in the review panel where the user accepts or vetoes each cut. Call at most once per pass, with ALL the cuts.',
      {
        assetId: z.string().describe('Asset id from the project inventory'),
        cuts: z
          .array(
            z.object({
              start: z.number().describe('Span start, source seconds (use word bounds from the transcript)'),
              end: z.number().describe('Span end, source seconds'),
              category: z.enum(EDITORIAL_CATEGORIES),
              note: z.string().describe('Why this goes and which take wins — shown to the user'),
            }),
          )
          .min(1),
        summary: z.string().describe('One line describing the pass, shown in the review header'),
      },
      async (args) => {
        this.emit({
          projectId: req.projectId,
          kind: 'tool',
          tool: 'propose_cuts',
          detail: `${args.cuts.length} cut${args.cuts.length === 1 ? '' : 's'}`,
        });
        if (req.reviewOpen || proposalCreated) {
          return text('A cut proposal is already open in the review panel. Ask the user to apply or reject it first, then try again.', true);
        }
        const asset = req.assets.find((a) => a.id === args.assetId);
        if (!asset) {
          return text(`Unknown asset id ${args.assetId}. Use an id from the project inventory.`, true);
        }
        const file = await readTranscriptFile(req.projectId, args.assetId);
        if (!file?.words || file.words.length === 0) {
          return text('No word-level transcript for this asset — call get_transcript first.', true);
        }

        let envelope;
        try {
          envelope = await loadRmsEnvelope(req.projectId, args.assetId, asset.path);
        } catch (err) {
          log.error('Editorial pass: envelope load failed', err);
          return text('Could not load the audio envelope for this asset, so cut edges cannot be snapped. Ask the user to re-import or check the source file.', true);
        }

        const snapped = snapEditorialCuts({
          spans: args.cuts,
          words: file.words,
          duration: envelope.duration(),
          envelope,
          features: file.features,
        });
        if (snapped.items.length === 0) {
          return text(`No usable cuts survived validation (${snapped.notes.join('; ') || 'all spans empty or out of range'}). Check the span times against the transcript.`, true);
        }

        const proposal = buildEditorialProposal({
          assetId: args.assetId,
          items: snapped.items,
          removedSeconds: snapped.removedSeconds,
          sourceDuration: envelope.duration(),
          engine: file.engine,
          summary: args.summary,
          qaNotes: snapped.notes,
        });
        proposalCreated = true;
        this.emit({ projectId: req.projectId, kind: 'proposal', proposal });

        const counts = new Map<string, number>();
        for (const item of snapped.items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
        const breakdown = [...counts.entries()].map(([cat, n]) => `${n} ${cat}`).join(', ');
        return text(
          `Proposal created: ${snapped.items.length} cuts (−${snapped.removedSeconds.toFixed(1)} s; ${breakdown}). ` +
            `${snapped.notes.length > 0 ? `Adjustments: ${snapped.notes.join('; ')}. ` : ''}` +
            'It is now in the review panel — summarize your findings for the user and let them review. Do not call propose_cuts again.',
        );
      },
    );

    return createSdkMcpServer({ name: 'studio', version: '1.0.0', tools: [getTranscript, proposeCuts] });
  }
}

export const studioAgent = new StudioAgentService();
