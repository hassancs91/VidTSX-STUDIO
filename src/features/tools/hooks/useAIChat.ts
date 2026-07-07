import { useState, useEffect, useCallback } from 'react';
import type { LlmProviderConfig, LlmUsageIpc, LlmImageIpc, SkillSummary } from '@shared/ipc/types';
import type { ThinkingLevel } from '@shared/tsx-engine';
import { THINKING_CONFIGS } from '@shared/tsx-engine';

export interface ChatImage {
  data: string;              // base64
  mediaType: LlmImageIpc['mediaType'];
  name: string;              // file name for display
  sizeBytes: number;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp: number;
  durationMs?: number;
  model?: string;
  debugLog?: string[];
  provider?: string;
  thinkingLevel?: string;
  usage?: LlmUsageIpc;
  images?: ChatImage[];      // images attached to this message
}

export function useAIChat() {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('off');
  const [loopCount, setLoopCount] = useState(1);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [pendingImages, setPendingImages] = useState<ChatImage[]>([]);
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = useState<SkillSummary[]>([]);
  const [enabledSkills, setEnabledSkills] = useState<string[]>([]);

  const toggleTool = useCallback((tool: string) => {
    setEnabledTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  }, []);

  const toggleSkill = useCallback((id: string) => {
    setEnabledSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const addImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const mediaTypeMap: Record<string, LlmImageIpc['mediaType']> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp',
      };
      const mediaType = mediaTypeMap[ext] ?? 'image/png';
      setPendingImages((prev) => [...prev, { data: base64, mediaType, name: file.name, sizeBytes: file.size }]);
    };
    reader.readAsDataURL(file);
  }, []);

  const removeImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearImages = useCallback(() => {
    setPendingImages([]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.api.llmProvidersGet();
        const enabled = result.providers.filter((p) => p.enabled);
        setProviders(enabled);
        const defaultId = result.activeProvider
          || (enabled.length > 0 ? enabled[0].id : '');
        setSelectedProvider(defaultId);
      } catch {
        // Silently fail
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.api.skillsList();
        if (result.success) setAvailableSkills(result.skills);
      } catch {
        // Silently fail — skills are optional
      }
    })();
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || !selectedProvider) return;

    setLoading(true);
    setError(null);

    const attachedImages = pendingImages.length > 0 ? [...pendingImages] : undefined;
    setPendingImages([]);

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      images: attachedImages,
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const config = THINKING_CONFIGS[thinkingLevel];

      const effectiveSystemPrompt = systemPrompt.trim() || undefined;

      const ipcImages = attachedImages?.map((img) => ({ data: img.data, mediaType: img.mediaType }));

      const result = await window.api.llmGenerate({
        prompt: text.trim(),
        systemPrompt: effectiveSystemPrompt,
        providerId: selectedProvider,
        sessionScope: `ai-chat:${crypto.randomUUID()}`,
        ...(config.thinking ? { thinking: config.thinking } : {}),
        ...(config.effort ? { effort: config.effort } : {}),
        ...(loopCount > 1 ? { reflectionLoops: loopCount } : {}),
        ...(ipcImages ? { images: ipcImages } : {}),
        ...(enabledTools.length > 0 ? { agentTools: enabledTools, allowedTools: enabledTools } : {}),
        ...(enabledSkills.length > 0 ? { skillIds: enabledSkills } : {}),
      });

      if (!result.success) {
        setError(result.error ?? 'Generation failed');
        return;
      }

      const assistantMsg: AIChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.text ?? '',
        thinking: result.thinking,
        timestamp: Date.now(),
        durationMs: result.durationMs,
        model: result.model,
        debugLog: result.debugLog,
        provider: selectedProvider,
        thinkingLevel,
        usage: result.usage,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }, [selectedProvider, thinkingLevel, loopCount, systemPrompt, pendingImages, enabledTools, enabledSkills]);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const cancel = useCallback(async () => {
    try {
      await window.api.llmCancel();
    } catch {
      // Ignore
    }
    setLoading(false);
    setError('Cancelled');
  }, []);

  return {
    messages,
    loading,
    error,
    providers,
    selectedProvider,
    setSelectedProvider,
    thinkingLevel,
    setThinkingLevel,
    loopCount,
    setLoopCount,
    systemPrompt,
    setSystemPrompt,
    pendingImages,
    addImage,
    removeImage,
    clearImages,
    enabledTools,
    toggleTool,
    availableSkills,
    enabledSkills,
    toggleSkill,
    send,
    clear,
    cancel,
  };
}
