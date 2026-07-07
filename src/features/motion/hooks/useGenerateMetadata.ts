import { useState, useCallback } from 'react';
import { TEMPLATE_TAGS } from '../data/template-tags';

export interface GeneratedMetadata {
  title: string;
  description: string;
  tags: string[];
}

interface GenerateInput {
  tsxCode: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
}

const SYSTEM_PROMPT = `You write metadata for reusable TSX video template cards in a template library. You will receive a Remotion/TSX composition's source code and its output specs. Produce three fields: a short marketable title, a one-sentence description, and 3-5 tags chosen ONLY from the allowed list.

Allowed tags (choose 3-5, exactly as written, no new tags):
${TEMPLATE_TAGS.join(', ')}

Rules:
- title: 2-6 words, Title Case, no trailing punctuation, describes what the template IS (not a sentence).
- description: ONE sentence, 12-25 words, present tense, no marketing fluff, mentions the visual idea.
- tags: array of 3-5 strings, each MUST be one of the allowed tags verbatim. Pick tags that actually match the code (structure + style + motion). Do not invent tags.
- Do NOT include the duration, fps, or resolution in the title or description.

Respond with ONLY a valid JSON object. No markdown fences, no prose, no explanation.
Exact shape:
{"title":"...","description":"...","tags":["...","..."]}`;

function buildUserPrompt(input: GenerateInput): string {
  return `Composition specs: ${input.width}x${input.height} @ ${input.fps}fps, duration ${input.durationSeconds.toFixed(2)}s.

TSX source:
\`\`\`tsx
${input.tsxCode}
\`\`\``;
}

function extractJson(raw: string): unknown {
  let cleaned = raw.trim();
  const fence = cleaned.match(/(?:```|~~~)(?:json)?\s*\n?([\s\S]*?)(?:```|~~~)/);
  if (fence) cleaned = fence[1].trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error(`No JSON object in response: "${cleaned.slice(0, 200)}"`);
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function validate(parsed: unknown): GeneratedMetadata {
  if (!parsed || typeof parsed !== 'object') throw new Error('AI response was not an object');
  const obj = parsed as Record<string, unknown>;
  const title = typeof obj.title === 'string' ? obj.title.trim() : '';
  const description = typeof obj.description === 'string' ? obj.description.trim() : '';
  const rawTags = Array.isArray(obj.tags) ? obj.tags : [];
  const allowed = new Set<string>(TEMPLATE_TAGS);
  const tags = rawTags
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => allowed.has(t));
  if (!title) throw new Error('AI response is missing title');
  if (!description) throw new Error('AI response is missing description');
  if (tags.length < 1) throw new Error('AI response has no valid tags');
  return { title, description, tags: tags.slice(0, 5) };
}

export function useGenerateMetadata() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (input: GenerateInput): Promise<GeneratedMetadata | null> => {
    setLoading(true);
    setError(null);
    try {
      const providersRes = await window.api.llmProvidersGet();
      const enabled = providersRes.providers.filter((p) => p.enabled);
      const providerId = providersRes.activeProvider
        || (enabled.length > 0 ? enabled[0].id : undefined);
      if (!providerId) throw new Error('No AI provider is enabled. Enable one in Settings.');

      const res = await window.api.llmGenerate({
        prompt: buildUserPrompt(input),
        systemPrompt: SYSTEM_PROMPT,
        providerId,
        temperature: 0.4,
        featureSource: 'creator-push-metadata',
      });
      if (!res.success || !res.text) {
        throw new Error(res.error || 'AI generation failed');
      }
      return validate(extractJson(res.text));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}
