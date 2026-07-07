import type { TsxSuggestion, TsxSuggestionCategory } from '../../shared/ipc/types';

const VALID_CATEGORIES: TsxSuggestionCategory[] = [
  'text-overlay',
  'lower-third',
  'highlight',
  'callout',
  'data-visual',
  'custom',
];

interface VideoContext {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
}

interface PresetContext {
  name: string;
  content: string;
}

interface AnalysisPromptContext {
  video: VideoContext;
  // Brand markdown (voice, colors, aesthetic). Optional.
  brand?: string;
  // Composable editing guidelines. All non-empty entries are appended.
  presets?: PresetContext[];
}

function formatBrandSection(brand: string | undefined): string {
  const trimmed = brand?.trim();
  if (!trimmed) return '';
  return `\n\n--- BRAND PROFILE (style & voice the suggestions must respect) ---\n${trimmed}\n--- END BRAND PROFILE ---`;
}

function formatPresetsSection(presets: PresetContext[] | undefined): string {
  if (!presets || presets.length === 0) return '';
  const blocks = presets
    .map((p) => p.content?.trim())
    .filter((c): c is string => !!c && c.length > 0)
    .map((c, i) => `### Guideline ${i + 1}\n${c}`)
    .join('\n\n');
  if (!blocks) return '';
  return `\n\n--- EDITING GUIDELINES (rules the suggestions must follow) ---\n${blocks}\n--- END EDITING GUIDELINES ---`;
}

export function buildTsxAnalysisSystemPrompt(ctx: AnalysisPromptContext | VideoContext): string {
  // Accept the legacy VideoContext shape for backward compat with any callers
  // that haven't migrated to the new options bag yet.
  const normalized: AnalysisPromptContext =
    'video' in ctx ? ctx : { video: ctx };
  const { video } = normalized;

  const brandSection = formatBrandSection(normalized.brand);
  const presetsSection = formatPresetsSection(normalized.presets);

  return `You are a professional video editor AI. You analyze video transcripts and suggest motion graphics, text overlays, and animations that make videos more engaging and polished.

You receive transcript segments with timing (start/end in seconds) and text, plus video metadata.

Video specs: ${video.width}x${video.height} at ${video.fps}fps, ${video.durationSeconds.toFixed(1)}s total duration.${brandSection}${presetsSection}

Your job:
1. Read the transcript to understand the content flow, topic shifts, and key moments.
2. Group segments into logical sections based on topic.
3. Identify moments where a motion graphic would add genuine value — key points, data mentions, introductions, transitions, emphasis moments, conclusions.
4. Suggest specific animations with precise timing.

Rules:
- Be selective. NOT every section needs a suggestion. Only suggest where it genuinely improves engagement.
- Suggestions can span partial segments, full segments, multiple segments, or gaps between segments. Timing is independent of segment boundaries.
- Keep each animation between 1 and 8 seconds.
- startTime and endTime must be within 0 and ${video.durationSeconds.toFixed(1)}.
- endTime must be greater than startTime.
- Suggestions must NOT overlap in time. Each animation occupies its own slot on a single track — one suggestion's [startTime, endTime] may not intersect another's. Leave a gap or make them strictly back-to-back.
- "title": 3-6 words describing the animation.
- "description": 1-2 sentences explaining what the viewer sees.
- "prompt": A detailed, self-contained prompt to generate a Remotion TSX composition for this animation. Include the exact text to display, animation style, colors, positioning, and timing. Reference the video resolution ${video.width}x${video.height} and ${video.fps}fps in the prompt. If a BRAND PROFILE is provided above, the visual choices in this prompt MUST match it (colors, typography vibe, aesthetic).
- "category": one of "text-overlay", "lower-third", "highlight", "callout", "data-visual", "custom".
- Aim for 3-10 suggestions depending on video length.
- If EDITING GUIDELINES are provided above, every suggestion MUST conform to them. They take precedence over your defaults.

Respond with ONLY a valid JSON array. No markdown fences, no explanation, no text before or after.

Example format:
[{"id":"sug_1","startTime":2.5,"endTime":5.0,"title":"Title Card Intro","description":"Animated title showing the video topic with a fade-in effect.","prompt":"Create a Remotion TSX composition...","category":"lower-third"}]`;
}

export function parseTsxSuggestions(
  raw: string,
  videoDuration: number
): TsxSuggestion[] {
  let cleaned = raw.trim();

  if (!cleaned) {
    throw new Error('AI returned an empty response');
  }

  // Strip markdown fences if present (```, ~~~, with optional language tag)
  const fenceMatch = cleaned.match(/(?:```|~~~)(?:json)?\s*\n?([\s\S]*?)(?:```|~~~)/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try parsing the whole thing first — it might be valid JSON already
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // If full parse fails, try to find JSON array boundaries
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1) {
      // Show a snippet of what we got for debugging
      const snippet = cleaned.slice(0, 200);
      throw new Error(`No JSON array found in AI response. Start of response: "${snippet}"`);
    }
    parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
  }

  // If the AI returned an object wrapping an array, unwrap it
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    // Look for the first array property
    const arrayValue = Object.values(obj).find((v) => Array.isArray(v));
    if (arrayValue) {
      parsed = arrayValue;
    } else {
      throw new Error('AI response is an object but contains no array');
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array');
  }

  const suggestions: TsxSuggestion[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item || typeof item !== 'object') continue;

    const raw = item as Record<string, unknown>;

    const startTime = typeof raw.startTime === 'number' ? raw.startTime : NaN;
    const endTime = typeof raw.endTime === 'number' ? raw.endTime : NaN;

    if (isNaN(startTime) || isNaN(endTime)) continue;

    const clampedStart = Math.max(0, Math.min(videoDuration, startTime));
    const clampedEnd = Math.max(0, Math.min(videoDuration, endTime));

    if (clampedEnd <= clampedStart) continue;

    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const description = typeof raw.description === 'string' ? raw.description.trim() : '';
    const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';

    if (!title || !description || !prompt) continue;

    const categoryRaw = typeof raw.category === 'string' ? raw.category : 'custom';
    const category: TsxSuggestionCategory = VALID_CATEGORIES.includes(
      categoryRaw as TsxSuggestionCategory
    )
      ? (categoryRaw as TsxSuggestionCategory)
      : 'custom';

    const id =
      typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `sug_${i + 1}`;

    suggestions.push({
      id,
      startTime: clampedStart,
      endTime: clampedEnd,
      title,
      description,
      prompt,
      category,
    });
  }

  return dedupeOverlaps(suggestions);
}

// Guarantee non-overlapping time ranges so slots don't interfere on the single
// TSX track — even when the model ignores the "no overlap" prompt rule.
//
// Strategy: sort by start time, then clamp each suggestion's end to the next
// one's start if they intersect. Start times are content anchors (the moment
// the overlay should appear), so we preserve them and only trim overlapping
// tails. Anything clamped below a usable minimum is dropped.
const MIN_SUGGESTION_DURATION_SECONDS = 0.2;

function dedupeOverlaps(suggestions: TsxSuggestion[]): TsxSuggestion[] {
  if (suggestions.length < 2) return suggestions;

  const sorted = [...suggestions].sort((a, b) => a.startTime - b.startTime);

  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (cur.endTime > next.startTime) {
      cur.endTime = next.startTime;
    }
  }

  return sorted.filter(
    (s) => s.endTime - s.startTime >= MIN_SUGGESTION_DURATION_SECONDS
  );
}
