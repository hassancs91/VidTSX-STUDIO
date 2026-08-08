// Per-asset transcription for the Studio: runs the app's configured STT
// engines through the provider-agnostic pipeline and writes the rich result
// to the project cache. Button-triggered only — never on import (transcribing
// b-roll/music/SFX would burn whisper minutes and AssemblyAI credits for
// nothing).

import fs from 'fs/promises';
import path from 'path';
import { findSttEntry } from '../../../shared/presets/stt-models';
import type { SttModelFeatures } from '../../../shared/presets/stt-models';
import type { StudioAssetTranscriptMeta } from '../../../shared/types/studio';
import type { SttUtterance, SttWord } from '../../../transcription-engine/types';
import { transcribeAudioFile } from '../stt/run-transcription';
import { extractAudioToWav, isAudioFile } from '../stt/extract-audio';
import { getProjectCacheDir } from './studio-paths';

export const TRANSCRIPT_DIR = 'transcripts';

export function transcriptRelPath(assetId: string): string {
  return `${TRANSCRIPT_DIR}/${assetId}.json`;
}

/**
 * On-disk transcript (cache/transcripts/<assetId>.json). Optional signals stay
 * absent when the engine didn't deliver them — `undefined` means "not
 * available", never `[]`.
 */
export interface StudioTranscriptFile {
  version: 1;
  createdAt: string;
  sttModelId: string;
  engine: 'whisper' | 'assemblyai';
  language?: string;
  /** What the run actually delivered (see StudioAssetTranscript.features). */
  features: SttModelFeatures;
  /** Source duration covered by the transcript, seconds. */
  duration: number;
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
  words?: SttWord[];
  utterances?: SttUtterance[];
}

export interface TranscribeAssetResult {
  relPath: string;
  meta: StudioAssetTranscriptMeta;
}

function metaFromFile(file: StudioTranscriptFile): StudioAssetTranscriptMeta {
  return {
    engine: file.engine,
    sttModelId: file.sttModelId,
    language: file.language,
    hasWords: (file.words?.length ?? 0) > 0,
    wordCount: file.words?.length,
    features: file.features,
  };
}

/** Read the cached transcript's metadata, or null when none exists. */
export async function readTranscriptMeta(
  projectId: string,
  assetId: string,
): Promise<StudioAssetTranscriptMeta | null> {
  const file = await readTranscriptFile(projectId, assetId);
  return file ? metaFromFile(file) : null;
}

export async function readTranscriptFile(
  projectId: string,
  assetId: string,
): Promise<StudioTranscriptFile | null> {
  try {
    const cacheDir = await getProjectCacheDir(projectId);
    const raw = await fs.readFile(path.join(cacheDir, transcriptRelPath(assetId)), 'utf-8');
    const parsed = JSON.parse(raw) as StudioTranscriptFile;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

/** Delete the cached transcript (an explicit re-transcribe starts clean). */
export async function deleteTranscript(projectId: string, assetId: string): Promise<void> {
  const cacheDir = await getProjectCacheDir(projectId);
  await fs.rm(path.join(cacheDir, transcriptRelPath(assetId)), { force: true });
}

/**
 * Transcribe one asset with the given STT catalog model and cache the result.
 * Requests verbatim disfluencies — auto-cut treats fillers as cut material —
 * which the engine honors only if it supports them (feature-gated upstream).
 */
export async function transcribeAsset(
  projectId: string,
  assetId: string,
  sourcePath: string,
  sttModelId: string,
  signal: AbortSignal,
  onProgress: (percent: number, message: string) => void,
): Promise<TranscribeAssetResult> {
  const entry = findSttEntry(sttModelId);
  if (!entry) throw new Error(`Unknown transcription model "${sttModelId}"`);
  if (entry.provider === 'openrouter') {
    throw new Error('This model returns plain text without timestamps — pick one with word timing.');
  }

  // ── 1. Extract audio (video sources only) ──
  let audioPath = sourcePath;
  let extracted: string | null = null;
  if (!isAudioFile(sourcePath)) {
    extracted = await extractAudioToWav(sourcePath, signal, (pct) => {
      onProgress(Math.round(pct * 0.1), 'Extracting audio…');
    });
    audioPath = extracted;
  }

  try {
    if (signal.aborted) throw new Error('aborted');

    // ── 2. Transcribe via the provider-agnostic pipeline ──
    const rich = await transcribeAudioFile({
      audioPath,
      sttModelId,
      verbatim: true,
      signal,
      onProgress: (percent, message) => onProgress(10 + Math.round(percent * 0.88), message),
    });
    if (signal.aborted) throw new Error('aborted');

    // ── 3. Cache the rich result ──
    onProgress(99, 'Saving transcript…');
    const file: StudioTranscriptFile = {
      version: 1,
      createdAt: new Date().toISOString(),
      sttModelId,
      engine: entry.provider === 'local-whisper' ? 'whisper' : 'assemblyai',
      language: rich.result.language,
      features: rich.features ?? entry.features,
      duration: rich.result.duration,
      text: rich.result.text,
      segments: rich.result.segments.map((s) => ({ start: s.start, end: s.end, text: s.text })),
      ...(rich.words && rich.words.length > 0 ? { words: rich.words } : {}),
      ...(rich.utterances && rich.utterances.length > 0 ? { utterances: rich.utterances } : {}),
    };

    const cacheDir = await getProjectCacheDir(projectId);
    const outputPath = path.join(cacheDir, transcriptRelPath(assetId));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(file), 'utf-8');

    return { relPath: transcriptRelPath(assetId), meta: metaFromFile(file) };
  } finally {
    if (extracted) {
      await fs.unlink(extracted).catch(() => {
        /* best-effort temp cleanup */
      });
    }
  }
}
