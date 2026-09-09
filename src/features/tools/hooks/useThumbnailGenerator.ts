import { useState, useEffect, useCallback } from 'react';
import type { LlmProviderConfig } from '@shared/ipc/types';
import { filterUsableLlmProviders } from '@shared/services/llm-provider-filter';
import { THUMBNAIL_SYSTEM_PROMPT } from './thumbnail-system-prompt';

type Orientation = 'horizontal' | 'vertical';

function parsePromptResponse(text: string): string[] {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  const parsed: unknown = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
  return (parsed as unknown[]).map((item) => {
    if (typeof item === 'string') return item.trim();
    if (typeof item === 'object' && item !== null && 'prompt' in item) {
      return String((item as { prompt: string }).prompt).trim();
    }
    throw new Error('Invalid item format');
  }).filter(Boolean);
}

export function useThumbnailGenerator() {
  // Provider state
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');

  // Form state
  const [topic, setTopic] = useState('');
  const [numberOfIdeas, setNumberOfIdeas] = useState(6);
  const [includeText, setIncludeText] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');

  // Generation state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<string[]>([]);

  // Fetch providers on mount
  useEffect(() => {
    (async () => {
      try {
        const result = await window.api.llmProvidersGet();
        const usable = filterUsableLlmProviders(result.providers);
        setProviders(usable);
        const defaultId = result.activeProvider || (usable.length > 0 ? usable[0].id : '');
        setSelectedProvider(defaultId);
      } catch {
        // Silently fail
      }
    })();
  }, []);

  const generate = useCallback(async () => {
    if (!topic.trim() || !selectedProvider) return;

    setLoading(true);
    setError(null);

    const textInstruction = includeText
      ? 'Text IS allowed in prompts.'
      : 'Text is NOT allowed in prompts.';
    const userPrompt = [
      `Generate ${numberOfIdeas} YouTube thumbnail image prompts for a video about:`,
      topic.trim(),
      '',
      `Orientation: ${orientation}`,
      textInstruction,
    ].join('\n');

    try {
      const result = await window.api.llmGenerate({
        prompt: userPrompt,
        systemPrompt: THUMBNAIL_SYSTEM_PROMPT,
        providerId: selectedProvider,
        sessionScope: `thumbnail:${crypto.randomUUID()}`,
        temperature: 0.8,
      });

      if (!result.success || !result.text) {
        setError(result.error || 'Failed to generate prompts');
        return;
      }

      const parsed = parsePromptResponse(result.text);
      if (parsed.length === 0) {
        setError('No prompts returned');
        return;
      }
      setPrompts(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }, [topic, selectedProvider, numberOfIdeas, includeText, orientation]);

  const updatePrompt = useCallback((index: number, value: string) => {
    setPrompts((prev) => prev.map((p, i) => (i === index ? value : p)));
  }, []);

  const removePrompt = useCallback((index: number) => {
    setPrompts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const copyPrompt = useCallback((index: number) => {
    const text = prompts[index];
    if (text) navigator.clipboard.writeText(text);
  }, [prompts]);

  const clearPrompts = useCallback(() => {
    setPrompts([]);
  }, []);

  const sendToImageStudio = useCallback(() => {
    if (prompts.length === 0) return;
    const aspectRatio = orientation === 'horizontal' ? '16:9' : '9:16';

    // Navigate first so Image Studio gets mounted
    window.dispatchEvent(new CustomEvent('vidtsx:navigate', {
      detail: { screen: 'image-studio' },
    }));
    // Delay to let React mount the screen before populating
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('vidtsx:bulk-import', {
        detail: { prompts, aspectRatio },
      }));
    }, 150);
  }, [prompts, orientation]);

  return {
    providers,
    selectedProvider,
    setSelectedProvider,
    topic,
    setTopic,
    numberOfIdeas,
    setNumberOfIdeas,
    includeText,
    setIncludeText,
    orientation,
    setOrientation,
    loading,
    error,
    prompts,
    generate,
    updatePrompt,
    removePrompt,
    copyPrompt,
    clearPrompts,
    sendToImageStudio,
  };
}
