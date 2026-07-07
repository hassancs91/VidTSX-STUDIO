import { useState, useEffect, useCallback } from 'react';
import type { LlmProviderConfig } from '@shared/ipc/types';
import type { PrototyperChatMessage } from '../types';
import type { ThinkingLevel, EffortLevel } from '@shared/tsx-engine';
import { PROTOTYPER_SYSTEM_PROMPT } from '../services/html-system-prompt';

export type { ThinkingLevel } from '@shared/tsx-engine';

interface ThinkingConfig {
  thinking?: { type: 'adaptive' | 'disabled' };
  effort?: EffortLevel;
  maxTurns: number;
}

const THINKING_CONFIGS: Record<ThinkingLevel, ThinkingConfig> = {
  off: { maxTurns: 1 },
  low: { thinking: { type: 'adaptive' }, effort: 'low', maxTurns: 2 },
  medium: { thinking: { type: 'adaptive' }, effort: 'medium', maxTurns: 3 },
  high: { thinking: { type: 'adaptive' }, effort: 'high', maxTurns: 5 },
  xhigh: { thinking: { type: 'adaptive' }, effort: 'xhigh', maxTurns: 5 },
  max: { thinking: { type: 'adaptive' }, effort: 'max', maxTurns: 5 },
};

interface SendResult {
  htmlCode: string | null;
  chatHistory: PrototyperChatMessage[];
}

export function usePrototyperChat() {
  const [chatHistory, setChatHistory] = useState<PrototyperChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('medium');

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

  const sendMessage = useCallback(async (text: string): Promise<SendResult> => {
    if (!text.trim() || !selectedProvider) {
      return { htmlCode: null, chatHistory };
    }

    setLoading(true);
    setError(null);

    const userMessage: PrototyperChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    const updatedHistory = [...chatHistory, userMessage];
    setChatHistory(updatedHistory);

    try {
      const config = THINKING_CONFIGS[thinkingLevel];
      const messages = updatedHistory.map((m) => ({
        role: m.role,
        content: m.role === 'assistant' && m.htmlCode
          ? m.htmlCode
          : m.content,
      }));

      const result = await window.api.llmChatGenerate({
        messages,
        systemPrompt: PROTOTYPER_SYSTEM_PROMPT,
        providerId: selectedProvider,
        sessionScope: `prototyper:${crypto.randomUUID()}`,
        ...(config.thinking ? { thinking: config.thinking } : {}),
        ...(config.effort ? { effort: config.effort } : {}),
        maxTurns: config.maxTurns,
      });

      if (result.success && result.text) {
        const assistantMessage: PrototyperChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.text,
          htmlCode: result.htmlCode || undefined,
          timestamp: Date.now(),
        };

        const finalHistory = [...updatedHistory, assistantMessage];
        setChatHistory(finalHistory);
        return { htmlCode: result.htmlCode || null, chatHistory: finalHistory };
      } else {
        setError(result.error || 'Generation failed');
        return { htmlCode: null, chatHistory: updatedHistory };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      return { htmlCode: null, chatHistory: updatedHistory };
    } finally {
      setLoading(false);
    }
  }, [chatHistory, selectedProvider, thinkingLevel]);

  const clearChat = useCallback(() => {
    setChatHistory([]);
    setError(null);
  }, []);

  const loadChat = useCallback((messages: PrototyperChatMessage[]) => {
    setChatHistory(messages);
    setError(null);
  }, []);

  return {
    chatHistory,
    loading,
    error,
    providers,
    selectedProvider,
    setSelectedProvider,
    thinkingLevel,
    setThinkingLevel,
    sendMessage,
    clearChat,
    loadChat,
  };
}
