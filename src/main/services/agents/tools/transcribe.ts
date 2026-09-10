// `transcribe` — a video or audio artifact through the app's STT pipeline
// (flows plan §1.2, W8 Stage 3): the same `transcribeAudioFile` the Transcribe
// screen, the Studio and auto-cut use, so provider registration, feature
// gating and the usage row are one code path. The W4 keyterms come from the
// run brand's vocabulary plus the active vocabulary memories, and the alias
// post-pass corrects the words the same way the Studio's transcriber does.
//
// The transcript is a `document` artifact — the readable Markdown — whose
// payload names the JSON beside it (segments, words, timings) for
// `caption_video`. No new artifact kind (§0.1 rule: `ARTIFACT_KINDS` grows
// only when a viewer needs it; the document viewer shows this fine).

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { SttWord } from '../../../../transcription-engine/types';
import { findSttEntry, sttEntriesWithTimestamps } from '../../../../shared/presets/stt-models';
import { readBrand } from '../../library/brand-store';
import { getLibraryRoot } from '../../library/library-paths';
import { listMemories } from '../../studio/agent-memory';
import { applyAliasPostpass, buildAliasRules, replaceAliasesInText } from '../../stt/alias-postpass';
import { extractAudioToWav, isAudioFile } from '../../stt/extract-audio';
import { composeKeyterms } from '../../stt/keyterms';
import { transcribeAudioFile, type TranscribeAudioFileParams } from '../../stt/run-transcription';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { resolveAudioFile, resolveVideoFile } from './port-media';
import { reserveWorkspaceFile } from './workspace-files';

export const DEFAULT_FLOW_STT_MODEL = 'assemblyai/universal';

const schema = {
  video: z.string().optional().describe('A "video" artifact id to transcribe.'),
  audio: z.string().optional().describe('An "audio" artifact id to transcribe, instead of a video.'),
  sttModelId: z.string().optional().describe(`STT catalog id (default ${DEFAULT_FLOW_STT_MODEL}).`),
  language: z.string().optional().describe('ISO code, or empty for auto-detect.'),
  title: z.string().optional().describe('Names the transcript document.'),
};

interface TranscribeArgs {
  video?: string;
  audio?: string;
  sttModelId?: string;
  language?: string;
  title?: string;
}

export interface TranscribeDeps {
  transcribe(params: TranscribeAudioFileParams): ReturnType<typeof transcribeAudioFile>;
  extractAudio(inputPath: string, signal: AbortSignal, onProgress: (pct: number) => void): Promise<string>;
  brandVocabulary(brandId: string | undefined): Promise<Array<{ term: string; aliases?: string[] }>>;
  memories(): ReturnType<typeof listMemories>;
}

const defaultDeps: TranscribeDeps = {
  transcribe: (params) => transcribeAudioFile(params),
  extractAudio: (inputPath, signal, onProgress) => extractAudioToWav(inputPath, signal, onProgress),
  async brandVocabulary(brandId) {
    if (!brandId) return [];
    const brand = await readBrand(getLibraryRoot(), brandId);
    return brand?.vocabulary ?? [];
  },
  memories: () => listMemories(),
};

let deps: TranscribeDeps = defaultDeps;
export function setTranscribeDepsForTests(next: TranscribeDeps | null): void {
  deps = next ?? defaultDeps;
}

function stamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const transcribeTool: AgentToolDef<TranscribeArgs> = {
  id: 'transcribe',
  description:
    'Transcribe a video or audio artifact with the configured speech-to-text model (AssemblyAI, ElevenLabs Scribe or local Whisper). Returns a "document" artifact holding the transcript, with word timings kept for captioning. Cloud models cost cents per minute.',
  schema,
  ports: {
    label: 'Transcribe',
    category: 'audio',
    inputs: [
      { id: 'video', label: 'Video', dataType: 'video', argKey: 'video' },
      { id: 'audio', label: 'Audio', dataType: 'audio', argKey: 'audio' },
    ],
    outputs: [
      { id: 'transcript', label: 'Transcript', dataType: 'transcript', from: 'artifact' },
      { id: 'text', label: 'Text', dataType: 'text', from: 'field:text' },
    ],
    configSchema: [
      {
        kind: 'select',
        key: 'sttModelId',
        label: 'Model',
        options: sttEntriesWithTimestamps().map((e) => ({ value: e.id, label: `${e.name} — ${e.priceText}` })),
      },
      { kind: 'text', key: 'language', label: 'Language (optional)', placeholder: 'auto' },
      { kind: 'text', key: 'title', label: 'Title', placeholder: 'Transcript' },
    ],
    defaultConfig: { sttModelId: DEFAULT_FLOW_STT_MODEL, language: '', title: 'Transcript' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    const sttModelId = args.sttModelId?.trim() || DEFAULT_FLOW_STT_MODEL;
    const entry = findSttEntry(sttModelId);
    if (!entry) return toolText(`Unknown transcription model "${sttModelId}".`, true);
    if (entry.provider === 'openrouter') {
      return toolText('That model returns plain text without timestamps — pick one with word timing.', true);
    }
    let sourcePath: string;
    let sourceTitle: string;
    try {
      if (args.video) {
        const { artifact, absPath } = await resolveVideoFile(ctx, args.video);
        sourcePath = absPath;
        sourceTitle = artifact.title;
      } else if (args.audio) {
        const { artifact, absPath } = await resolveAudioFile(ctx, args.audio);
        sourcePath = absPath;
        sourceTitle = artifact.title;
      } else {
        return toolText('Connect a video or an audio to transcribe.', true);
      }
    } catch (err) {
      return toolText(err instanceof Error ? err.message : String(err), true);
    }

    // W4 priming: brand vocabulary + vocabulary memories, and the alias rules
    // the post-pass applies. Each source degrades to empty, never blocks.
    const vocabulary = await deps.brandVocabulary(ctx.brandId).catch(() => []);
    const memories = await deps.memories().catch(() => []);
    const scope = { brandVocabulary: vocabulary, memories, ...(ctx.brandId ? { brandId: ctx.brandId } : {}) };
    const composed = composeKeyterms(scope);
    const aliasRules = buildAliasRules(scope);
    if (composed.keyterms.length > 0) {
      ctx.emitProgress(`${composed.keyterms.length} keyterms (brand ${composed.counts.brand}, memory ${composed.counts.memory})`);
    }

    let extracted: string | null = null;
    try {
      let audioPath = sourcePath;
      if (!isAudioFile(sourcePath)) {
        ctx.emitProgress('Extracting audio…');
        extracted = await deps.extractAudio(sourcePath, ctx.signal, () => {});
        audioPath = extracted;
      }
      ctx.emitProgress(`Transcribing with ${entry.name}…`);
      let lastQuarter = -1;
      const rich = await deps.transcribe({
        audioPath,
        sttModelId,
        ...(args.language?.trim() ? { language: args.language.trim() } : {}),
        ...(composed.keyterms.length > 0 ? { keyterms: composed.keyterms } : {}),
        featureSource: ctx.featureSource ?? 'agent',
        signal: ctx.signal,
        onProgress: (percent, message) => {
          const quarter = Math.floor(percent / 25);
          if (quarter !== lastQuarter) {
            lastQuarter = quarter;
            ctx.emitProgress(`${message} ${percent}%`);
          }
        },
      });

      const words: SttWord[] | undefined = rich.words ? applyAliasPostpass(rich.words, aliasRules).words : undefined;
      const text = replaceAliasesInText(rich.result.text, aliasRules);
      const segments = rich.result.segments.map((s) => ({ start: s.start, end: s.end, text: replaceAliasesInText(s.text, aliasRules) }));
      const duration = rich.result.duration || segments.at(-1)?.end || 0;
      const title = args.title?.trim() || `Transcript — ${sourceTitle}`;

      const json = await reserveWorkspaceFile(ctx.workspaceDir, 'transcripts', title, '.json', 'transcript');
      await fs.writeFile(
        json.absPath,
        JSON.stringify(
          {
            version: 1,
            createdAt: new Date().toISOString(),
            sttModelId,
            engine: entry.provider,
            language: rich.result.language,
            duration,
            text,
            segments,
            ...(words ? { words } : {}),
            ...(rich.utterances ? { utterances: rich.utterances } : {}),
            keytermCount: composed.keyterms.length,
          },
          null,
          2,
        ),
        'utf-8',
      );
      const md = await reserveWorkspaceFile(ctx.workspaceDir, 'transcripts', path.basename(json.relPath, '.json'), '.md', 'transcript');
      const lines = [
        `# ${title}`,
        '',
        `_${entry.name} · ${duration.toFixed(1)} s · ${segments.length} segments${words ? ` · ${words.length} words` : ''}_`,
        '',
        ...segments.map((s) => `**[${stamp(s.start)}]** ${s.text.trim()}`),
        '',
      ];
      await fs.writeFile(md.absPath, lines.join('\n'), 'utf-8');

      return {
        ...toolText(`Transcript ready: ${md.relPath} (${segments.length} segments, ${duration.toFixed(1)} s${words ? `, ${words.length} words` : ''}).`),
        fields: { text },
        artifact: {
          kind: 'document',
          title: title.slice(0, 80),
          payload: {
            relPath: md.relPath,
            transcript: {
              jsonRelPath: json.relPath,
              sttModelId,
              ...(rich.result.language ? { language: rich.result.language } : {}),
              durationSeconds: duration,
              segmentCount: segments.length,
              hasWords: Boolean(words && words.length > 0),
            },
          },
        },
      };
    } catch (err) {
      return toolText(`Transcription failed: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      if (extracted) await fs.unlink(extracted).catch(() => {});
    }
  },
};
