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
import type { StudioShot } from '../../../shared/types/studio';
import { buildShotPlanProposal, SHOTS_PER_PASS_CAP } from '../../../shared/studio/shot-proposal';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { llmEngine } from '../../../engine';
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
import { shotGenerator } from './shot-generator';
import { LIBRARY_REF_PREFIX } from './shot-asset-refs';
import { loadProject } from './project-store';
import { listMemories } from './agent-memory';
import { composeMemoryBlock } from './agent-memory-prompt';
import { addProposal, hasPendingProposal } from './agent-memory-proposals';
import { MEMORY_TEXT_LIMITS } from '../../../shared/types/studio-memory';
import { generateImageAsset } from '../library/generate-image-asset';
import { captureWebpage } from '../library/capture';

const log = logEngine.createLogger('StudioAgent');

// Editorial policy + shot craft/entry policy — composed into the system
// prompt by runLlmGenerate (policy in skills, contracts in tool schemas).
const AGENT_SKILL_IDS = ['studio-clean-cut', 'studio-make-tsx'];
// A bulk shots pass is up to 10 generate calls + a proposal + conversation.
const AGENT_MAX_TURNS = 32;
const ALLOWED_TOOLS = [
  'mcp__studio__get_transcript',
  'mcp__studio__propose_cuts',
  'mcp__studio__generate_tsx_shot',
  'mcp__studio__propose_shots',
  'mcp__studio__generate_image',
  'mcp__studio__capture_webpage',
  'mcp__studio__propose_memory',
];

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
      const mcpServer = toolsAvailable ? this.buildTools(req, abort.signal, providerId) : null;
      const memoryBlock = await this.buildMemoryBlock(req.projectId);

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
          ...(toolsAvailable ? { allowedTools: ALLOWED_TOOLS } : {}),
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

  private buildTools(req: StudioAgentSendRequest, signal: AbortSignal, providerId?: string) {
    // Live per-run state shared by the tools: one proposal per turn (cuts OR
    // shots — kind-agnostic, matching the renderer's one-open-review rule),
    // the shots generated this pass, and the per-pass generation cap.
    let proposalCreated = false;
    const generatedShots = new Map<string, StudioShot>();

    const getTranscript = tool(
      'get_transcript',
      "Read a media asset's word-level transcript as a takes view: numbered segments split on speech pauses, pause durations between them, filler words marked inline with exact second bounds. Pass startSeconds/endSeconds to read only a range (bulk shot passes should read slices, not the whole thing).",
      {
        assetId: z.string().describe('Asset id from the project inventory'),
        startSeconds: z.number().optional().describe('Read only words at/after this source time'),
        endSeconds: z.number().optional().describe('Read only words before this source time'),
      },
      async (args) => {
        const asset = req.assets.find((a) => a.id === args.assetId);
        const range =
          args.startSeconds !== undefined || args.endSeconds !== undefined
            ? ` ${args.startSeconds ?? 0}s–${args.endSeconds !== undefined ? `${args.endSeconds}s` : 'end'}`
            : '';
        this.emit({
          projectId: req.projectId,
          kind: 'tool',
          tool: 'get_transcript',
          ...(asset ? { detail: `${asset.name}${range}` } : {}),
        });
        const file = await readTranscriptFile(req.projectId, args.assetId);
        if (!file) {
          return text(`No transcript for asset ${args.assetId} — ask the user to transcribe it first (Inspector → Transcript).`, true);
        }
        if (!file.words || file.words.length === 0) {
          return text('The transcript has no word timestamps, so an editorial pass cannot be authored from it. Recommend re-transcribing with AssemblyAI.', true);
        }
        const from = args.startSeconds ?? 0;
        const to = args.endSeconds ?? Number.POSITIVE_INFINITY;
        const words = file.words.filter((w) => w.start >= from && w.start < to);
        if (words.length === 0) {
          return text(`No words between ${from}s and ${args.endSeconds ?? 'end'}s — the transcript covers 0–${file.duration.toFixed(1)}s.`, true);
        }
        const header: string[] = [];
        if (!file.features.verbatimDisfluencies) {
          header.push(
            'NOTE: this transcript is NOT verbatim — the engine tidied fillers away, so filler cuts cannot be found reliably. Retake/false-start detection still works.',
          );
        }
        header.push(formatTakesView(asset?.name ?? args.assetId, words));
        return text(header.join('\n\n'));
      },
    );

    const generateTsxShot = tool(
      'generate_tsx_shot',
      'Generate ONE TSX shot (cutaway/overlay/title) through the full generation pipeline — takes a minute or more. Anchor it to a transcript span (assetId + sourceStart/sourceEnd, source seconds on word bounds) to bake word-synced timings; titles REQUIRE an anchor. Call once per shot, then call propose_shots ONCE with all of them.',
      {
        kind: z.enum(['cutaway', 'overlay', 'title']),
        brief: z.string().describe('What the shot should show — a concrete visual brief, self-contained'),
        name: z.string().optional().describe('Short display name (2-4 words) for the pool'),
        assetId: z.string().optional().describe('Anchor asset (required for title shots)'),
        sourceStart: z.number().optional().describe('Anchor span start, source seconds'),
        sourceEnd: z.number().optional().describe('Anchor span end, source seconds'),
        durationSeconds: z.number().optional().describe('Shot length; defaults to the anchor span length, else 5'),
        assetRefs: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            'Media INSIDE the shot: key → asset ref. Keys become assets.<key> in the generated code (letters/digits/underscore). Values: a project asset id from the inventory, or a "library:<path>" ref returned by generate_image / capture_webpage. Images and video only.',
          ),
      },
      async (args) => {
        if (req.reviewOpen || proposalCreated) {
          return text('A proposal is already open in the review panel. Ask the user to apply or reject it first — do not generate shots that cannot be proposed.', true);
        }
        if (generatedShots.size >= SHOTS_PER_PASS_CAP) {
          return text(`This pass already generated ${SHOTS_PER_PASS_CAP} shots (the per-pass cap). Propose what you have, and ask the user before starting another pass.`, true);
        }
        const anchored = args.assetId !== undefined;
        if (anchored && (args.sourceStart === undefined || args.sourceEnd === undefined || args.sourceEnd <= args.sourceStart)) {
          return text('An anchored shot needs sourceStart < sourceEnd (source seconds, on word bounds from the transcript).', true);
        }
        if (args.kind === 'title' && !anchored) {
          return text('Title shots are word-synced — anchor them to a transcript span (assetId + sourceStart/sourceEnd).', true);
        }
        if (anchored && !req.assets.some((a) => a.id === args.assetId)) {
          return text(`Unknown asset id ${args.assetId}. Use an id from the project inventory.`, true);
        }
        if (args.assetRefs) {
          const badPlain = Object.entries(args.assetRefs).filter(
            ([, v]) => !v.startsWith(LIBRARY_REF_PREFIX) && !req.assets.some((a) => a.id === v),
          );
          if (badPlain.length > 0) {
            return text(
              `Unknown asset ref value(s): ${badPlain.map(([k, v]) => `${k}=${v}`).join(', ')}. Use a project asset id from the inventory, or the "library:<path>" ref returned by generate_image / capture_webpage.`,
              true,
            );
          }
        }
        this.emit({
          projectId: req.projectId,
          kind: 'tool',
          tool: 'generate_tsx_shot',
          detail: args.name ?? args.brief.slice(0, 60),
        });
        try {
          const shot = await shotGenerator.generate({
            projectId: req.projectId,
            kind: args.kind,
            brief: args.brief,
            ...(args.name ? { name: args.name } : {}),
            ...(anchored
              ? {
                  anchor: {
                    assetId: args.assetId!,
                    sourceStart: args.sourceStart!,
                    sourceEnd: args.sourceEnd!,
                  },
                }
              : {}),
            ...(args.durationSeconds !== undefined ? { durationSeconds: args.durationSeconds } : {}),
            ...(args.assetRefs && Object.keys(args.assetRefs).length > 0
              ? { assetRefs: args.assetRefs }
              : {}),
            ...(providerId ? { providerId } : {}),
            origin: { by: 'agent' },
            signal,
          });
          generatedShots.set(shot.id, shot);
          const seconds = shot.config
            ? (shot.config.durationInFrames / shot.config.fps).toFixed(1)
            : '?';
          return text(
            `Shot ready: id "${shot.id}" (${shot.kind}, ${seconds} s, v${shot.activeVersion}). ` +
              `Generated ${generatedShots.size}/${SHOTS_PER_PASS_CAP} this pass. ` +
              'When every shot of this pass is done, call propose_shots ONCE with all of them.',
          );
        } catch (err) {
          return text(`Shot generation failed: ${err instanceof Error ? err.message : String(err)}`, true);
        }
      },
    );

    const proposeShots = tool(
      'propose_shots',
      'Submit the shots generated this pass as ONE shot-plan proposal for the review panel, where the user previews and accepts/rejects each before anything lands on the timeline. Call at most once per pass, with ALL the generated shots.',
      {
        items: z
          .array(
            z.object({
              shotId: z.string().describe('Id returned by generate_tsx_shot'),
              mode: z.enum(['cutaway', 'overlay']).optional().describe('Compositing intent; defaults from the shot kind'),
              timelineStart: z.number().optional().describe('Timeline seconds — UNANCHORED shots only (anchored ones place themselves)'),
              note: z.string().optional().describe('What this shot shows / why here — shown in the review list'),
            }),
          )
          .min(1),
        summary: z.string().describe('One line describing the pass, shown in the review header'),
      },
      async (args) => {
        this.emit({
          projectId: req.projectId,
          kind: 'tool',
          tool: 'propose_shots',
          detail: `${args.items.length} shot${args.items.length === 1 ? '' : 's'}`,
        });
        if (req.reviewOpen || proposalCreated) {
          return text('A proposal is already open in the review panel. Ask the user to apply or reject it first, then try again.', true);
        }
        const unknown = args.items.filter((i) => !generatedShots.has(i.shotId));
        if (unknown.length > 0) {
          return text(`Unknown shot id(s): ${unknown.map((i) => i.shotId).join(', ')} — propose only shots generated this pass.`, true);
        }
        const proposal = buildShotPlanProposal(
          args.items.map((item) => ({
            shot: generatedShots.get(item.shotId)!,
            ...(item.mode ? { mode: item.mode } : {}),
            ...(item.timelineStart !== undefined ? { timelineStart: item.timelineStart } : {}),
            ...(item.note ? { note: item.note } : {}),
          })),
          args.summary,
        );
        proposalCreated = true;
        this.emit({ projectId: req.projectId, kind: 'proposal', proposal });
        return text(
          `Shot plan proposed: ${args.items.length} shot${args.items.length === 1 ? '' : 's'} now in the review panel. ` +
            'Summarize what you made for the user and let them review — do not call propose_shots again.',
        );
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

    const generateImage = tool(
      'generate_image',
      'Generate an image with the configured image provider and file it into the app-wide asset library (origin: generated, the prompt becomes its description, auto-tagged with the project\'s active brand). Additive — no proposal. Returns a "library:<path>" ref to use in generate_tsx_shot assetRefs.',
      {
        prompt: z.string().describe('What the image shows — concrete and visual; saved as the asset description'),
        folder: z.string().optional().describe("Library folder to file into (default 'generated')"),
        aspect: z.enum(['square', 'landscape', 'portrait']).optional().describe('Default landscape (1280×720)'),
      },
      async (args) => {
        this.emit({
          projectId: req.projectId,
          kind: 'tool',
          tool: 'generate_image',
          detail: args.prompt.slice(0, 60),
        });
        try {
          // The active brand tags the output; a project without one (or a
          // stale id) simply files untagged.
          let brandId: string | undefined;
          try {
            brandId = (await loadProject(req.projectId)).settings.brandId;
          } catch {
            brandId = undefined;
          }
          const asset = await generateImageAsset({
            prompt: args.prompt,
            ...(args.folder ? { folder: args.folder } : {}),
            ...(args.aspect ? { aspect: args.aspect } : {}),
            ...(brandId ? { brandId } : {}),
            signal,
          });
          return text(
            `Image saved to the library: ${LIBRARY_REF_PREFIX}${asset.relPath} (${asset.width}×${asset.height}${asset.brandId ? `, brand: ${asset.brandId}` : ''}). ` +
              `To use it inside a shot, pass it in generate_tsx_shot assetRefs, e.g. { "image1": "${LIBRARY_REF_PREFIX}${asset.relPath}" }.`,
          );
        } catch (err) {
          return text(`Image generation failed: ${err instanceof Error ? err.message : String(err)}`, true);
        }
      },
    );

    const captureWebpageTool = tool(
      'capture_webpage',
      'Screenshot a webpage into the asset library (origin: captured, description: page title + URL) — screenshot material for shots. Hidden by default; pass visible=true for login-walled pages (the window opens for the user to log in and navigate, then THEY click "Capture now" — can take minutes). Returns a "library:<path>" ref for generate_tsx_shot assetRefs.',
      {
        url: z.string().describe('The http(s) page to capture'),
        viewport: z.enum(['landscape', 'portrait', 'desktop']).optional().describe('landscape 1280×720 (default), portrait 390×844, desktop 1440×900 — CSS pixels, rendered at 2×'),
        fullPage: z.boolean().optional().describe('Capture the full page height (capped ~8000 px) instead of one viewport'),
        visible: z.boolean().optional().describe('Open the window visibly and wait for the user to log in / navigate and click Capture'),
      },
      async (args) => {
        this.emit({
          projectId: req.projectId,
          kind: 'tool',
          tool: 'capture_webpage',
          detail: `${args.url}${args.visible ? ' (visible)' : ''}`,
        });
        try {
          const result = await captureWebpage({
            url: args.url,
            ...(args.viewport ? { viewport: args.viewport } : {}),
            ...(args.fullPage !== undefined ? { fullPage: args.fullPage } : {}),
            ...(args.visible !== undefined ? { visible: args.visible } : {}),
            signal,
          });
          return text(
            `Captured "${result.title || result.url}" → ${LIBRARY_REF_PREFIX}${result.relPath} (${result.width}×${result.height}). ` +
              `To use it inside a shot, pass it in generate_tsx_shot assetRefs, e.g. { "screenshot1": "${LIBRARY_REF_PREFIX}${result.relPath}" }.`,
          );
        } catch (err) {
          return text(`Webpage capture failed: ${err instanceof Error ? err.message : String(err)}`, true);
        }
      },
    );

    // One memory proposal per turn (its own flag — independent of the
    // cuts/shots review panel; the card lives in the chat, not the Inspector).
    let memoryProposalCreated = false;

    const proposeMemory = tool(
      'propose_memory',
      'Propose ONE durable memory (rule / vocabulary / profile) when the user states a GENERAL preference. Never applied directly — it becomes a card the user accepts, edits, or rejects. Do not treat it as remembered until they accept.',
      {
        kind: z.enum(['rule', 'vocabulary', 'profile']),
        text: z
          .string()
          .describe(
            'The memory as the agent will read it back: rules are one imperative sentence; vocabulary is the CORRECT spelling; profile is a durable fact about the user/channel.',
          ),
        aliases: z
          .array(z.string())
          .optional()
          .describe('vocabulary only — the misspellings this entry corrects'),
      },
      async (args) => {
        this.emit({
          projectId: req.projectId,
          kind: 'tool',
          tool: 'propose_memory',
          detail: args.text.slice(0, 60),
        });
        if (memoryProposalCreated || hasPendingProposal(req.projectId)) {
          return text(
            "A memory proposal is already waiting for the user's decision. Do not propose another until they answer it.",
            true,
          );
        }
        const trimmed = args.text.replace(/\s+/g, ' ').trim();
        if (!trimmed) return text('A memory proposal needs text.', true);
        const limit = MEMORY_TEXT_LIMITS[args.kind];
        if (trimmed.length > limit) {
          return text(`A ${args.kind} memory is limited to ${limit} characters — shorten it.`, true);
        }
        try {
          // The active set is in the prompt, but guard anyway: a duplicate
          // card teaches the user to reject reflexively.
          const existing = await listMemories();
          const duplicate = existing.find(
            (m) => m.active && m.kind === args.kind && m.text.toLowerCase() === trimmed.toLowerCase(),
          );
          if (duplicate) {
            return text('That is already in the active memory set — do not propose it again.', true);
          }
          const proposal = addProposal({
            projectId: req.projectId,
            kind: args.kind,
            text: trimmed,
            ...(args.aliases ? { aliases: args.aliases } : {}),
          });
          memoryProposalCreated = true;
          this.emit({ projectId: req.projectId, kind: 'memory-proposal', proposal });
          return text(
            'Proposal shown to the user as a card in this panel — they may accept, edit, or reject it. ' +
              'Do not treat it as remembered yet, and do not propose another this turn.',
          );
        } catch (err) {
          return text(err instanceof Error ? err.message : String(err), true);
        }
      },
    );

    return createSdkMcpServer({
      name: 'studio',
      version: '1.0.0',
      tools: [getTranscript, proposeCuts, generateTsxShot, proposeShots, generateImage, captureWebpageTool, proposeMemory],
    });
  }
}

export const studioAgent = new StudioAgentService();
