// Mechanical-analysis pipeline for one video clip — the shared spine for all
// downstream skills (auto-cut planner today; plan-tsx, plan-sfx, plan-transitions
// later). Cheap to re-run only the AI judgment layer because this output is
// persisted to disk + DB and reused.
//
//   1) extract audio
//   2) transcribe via the transcription engine (local whisper by default;
//      AssemblyAI adds speakers + highlights + sentiments)
//   3) detect silences (ffmpeg silencedetect)
//   4) compute per-utterance prosody (ffmpeg astats)
//
// Stage 5 (Claude planner) lives in plan-cuts.ts and is invoked separately —
// the user runs Analyze first, then optionally Auto-cut against the cached
// analysis. Pre-cut videos skip Auto-cut entirely.

import { writeFile } from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import type {
  StudioAnalysisJson,
  StudioAnalysisUtterance,
  StudioAnalysisWord,
  StudioAnalyzeStage,
} from '../../../shared/ipc/types';
import { extractAudio, getAutoCutDir } from './extract-audio';
import { detectSilences } from './silences';
import { computeProsody, type UtteranceRange } from './prosody';
import { transcribeAudioFile } from '../stt/run-transcription';
import { DEFAULT_STT_MODEL } from '../../../shared/presets/stt-models';

const log = logEngine.createLogger('auto-cut/analyze');

const FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'erm', 'hmm', 'ah', 'uhh', 'umm',
]);

export interface AnalyzeOptions {
  projectId: string;
  clipId: string;
  videoPath: string;
  durationSeconds: number;
  /** STT catalog id; defaults to local whisper. */
  sttModelId?: string;
  signal?: AbortSignal;
  onProgress?: (stage: StudioAnalyzeStage, percent: number, message: string) => void;
}

export interface AnalyzeResult {
  analysis: StudioAnalysisJson;
  workspaceDir: string;
  analysisPath: string;
}

// Stage weights: extract=5, transcribe=75, silences=5, prosody=15. Sums to 100.
const WEIGHT = { extract: 5, transcribe: 75, silences: 5, prosody: 15 };
const OFFSET = {
  extract: 0,
  transcribe: WEIGHT.extract,
  silences: WEIGHT.extract + WEIGHT.transcribe,
  prosody: WEIGHT.extract + WEIGHT.transcribe + WEIGHT.silences,
};

function stagePercent(
  stage: StudioAnalyzeStage,
  fractionInStage: number
): number {
  const weight = WEIGHT[stageKey(stage)];
  const offset = OFFSET[stageKey(stage)];
  return Math.min(99, Math.round(offset + weight * Math.max(0, Math.min(1, fractionInStage))));
}

function stageKey(s: StudioAnalyzeStage): keyof typeof WEIGHT {
  switch (s) {
    case 'extract-audio': return 'extract';
    case 'transcribe': return 'transcribe';
    case 'silences': return 'silences';
    case 'prosody': return 'prosody';
  }
}

export async function runMechanicalAnalysis(opts: AnalyzeOptions): Promise<AnalyzeResult> {
  const report = (
    stage: StudioAnalyzeStage,
    fractionInStage: number,
    message: string,
  ) => {
    opts.onProgress?.(stage, stagePercent(stage, fractionInStage), message);
  };

  // ── 1. Extract audio ──
  if (opts.signal?.aborted) throw new Error('aborted');
  report('extract-audio', 0, 'Extracting audio from your video…');
  const { audioPath, cached } = await extractAudio({
    videoPath: opts.videoPath,
    projectId: opts.projectId,
    signal: opts.signal,
  });
  report('extract-audio', 1, cached ? 'Reusing extracted audio' : 'Audio ready');
  log.info('analyze audio ready', { projectId: opts.projectId, audioPath, cached });

  // ── 2. Transcribe via the transcription engine ──
  if (opts.signal?.aborted) throw new Error('aborted');
  const sttModelId = opts.sttModelId ?? DEFAULT_STT_MODEL;
  report('transcribe', 0.05, 'Starting transcription…');
  log.info('analyze transcription started', { sttModelId });

  const abortController = new AbortController();
  const onAbort = () => abortController.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });

  let job;
  try {
    job = await transcribeAudioFile({
      audioPath,
      sttModelId,
      detectSpeakers: true,
      enableHighlights: true,
      enableSentiment: true,
      signal: abortController.signal,
      onProgress: (percent, message) => {
        // Provider progress (0..100) maps into the 5%..98% slice of this stage.
        report('transcribe', 0.05 + (percent / 100) * 0.93, message);
      },
    });
  } finally {
    opts.signal?.removeEventListener('abort', onAbort);
  }

  // ── 3. Detect silences ──
  if (opts.signal?.aborted) throw new Error('aborted');
  report('silences', 0.2, 'Finding pauses and silences…');
  const silences = await detectSilences({ audioPath, signal: opts.signal });
  report('silences', 1, `Found ${silences.length} ${silences.length === 1 ? 'pause' : 'pauses'}`);

  // ── 4. Compute prosody ──
  if (opts.signal?.aborted) throw new Error('aborted');
  const utterances = job.utterances ?? [];
  const words = job.words ?? [];

  const utteranceRanges: UtteranceRange[] = utterances.map((u) => {
    const wordsInUtterance = words.filter((w) => w.start >= u.start && w.end <= u.end);
    return {
      start: u.start,
      end: u.end,
      wordCount: wordsInUtterance.length || (u.text || '').split(/\s+/).filter(Boolean).length,
    };
  });

  report('prosody', 0, 'Analyzing pacing and delivery…');
  const prosodyByUtterance =
    utteranceRanges.length > 0
      ? await computeProsody({
          audioPath,
          utterances: utteranceRanges,
          signal: opts.signal,
          onProgress: (done, total) => {
            report('prosody', done / total, `Analyzing delivery… (${done}/${total} lines)`);
          },
        })
      : [];
  report('prosody', 1, 'Delivery analyzed');

  // ── Build StudioAnalysisJson ──
  const analysisUtterances: StudioAnalysisUtterance[] = utterances.map((u, i) => {
    const wordsInUtterance: StudioAnalysisWord[] = words
      .filter((w) => w.start >= u.start && w.end <= u.end)
      .map((w) => ({
        text: w.text,
        start: round3(w.start),
        end: round3(w.end),
        confidence: round3(w.confidence ?? 0),
      }));

    const disfluencies = wordsInUtterance
      .filter((w) => FILLER_WORDS.has(w.text.replace(/[^\w]/g, '').toLowerCase()))
      .map((w) => ({
        type: 'filler',
        text: w.text,
        start: w.start,
        end: w.end,
      }));

    const prosody = prosodyByUtterance[i] ?? {
      meanRms: 0,
      rmsVariance: 0,
      speakingRateWpm: 0,
    };

    const sentiment = job.sentiments?.find(
      (s) => s.start >= u.start - 0.05 && s.end <= u.end + 0.05
    )?.sentiment as 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | undefined;

    return {
      id: i,
      speaker: u.speaker,
      start: round3(u.start),
      end: round3(u.end),
      text: u.text,
      confidence: 0,
      sentiment: sentiment ?? 'NEUTRAL',
      words: wordsInUtterance,
      disfluencies,
      prosody,
    };
  });

  const totalWords = analysisUtterances.reduce((n, u) => n + u.words.length, 0);
  const totalDisfluencies = analysisUtterances.reduce(
    (n, u) => n + u.disfluencies.length,
    0
  );
  const rmsVals = analysisUtterances
    .map((u) => u.prosody.meanRms)
    .filter((v) => v > 0);
  const rateVals = analysisUtterances
    .map((u) => u.prosody.speakingRateWpm)
    .filter((v) => v > 0);
  const avgEnergy = rmsVals.length > 0 ? mean(rmsVals) : 0;
  const avgSpeakingRate = rateVals.length > 0 ? mean(rateVals) : 0;

  const analysis: StudioAnalysisJson = {
    source: {
      filePath: opts.videoPath,
      duration: round3(opts.durationSeconds),
      sampleRate: 16000,
    },
    utterances: analysisUtterances,
    silences,
    highlights: (job.highlights ?? []).map((h) => ({
      text: h.text,
      count: h.count,
      rank: Math.round((h.rank ?? 0) * 1e4) / 1e4,
      timestamps: [],
    })),
    stats: {
      totalWords,
      totalDisfluencies,
      avgSpeakingRate: round1(avgSpeakingRate),
      avgEnergy: round5(avgEnergy),
    },
    generatedAt: Date.now(),
  };

  // Persist analysis.json to the workspace so downstream Claude agents can
  // Read it via tool use (mirrors the original skill's `python analyze.py`).
  const workspaceDir = getAutoCutDir(opts.projectId);
  const analysisPath = path.join(workspaceDir, 'analysis.json');
  await writeFile(analysisPath, JSON.stringify(analysis, null, 2), 'utf-8');

  return { analysis, workspaceDir, analysisPath };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
function round5(n: number) {
  return Math.round(n * 1e5) / 1e5;
}
function mean(xs: number[]) {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
