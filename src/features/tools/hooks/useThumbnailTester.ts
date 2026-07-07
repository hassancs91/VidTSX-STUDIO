import { useState, useCallback, useMemo } from 'react';
import { SAMPLE_VIDEOS } from '../data/thumbnail-tester-samples';
import type { SampleVideoCard } from '../data/thumbnail-tester-samples';

export type LayoutMode = 'home' | 'search' | 'sidebar';

export interface UserCardData {
  thumbnailDataUrl: string | null;
  videoTitle: string;
  channelAvatarDataUrl: string | null;
  channelName: string;
}

interface ThumbnailTesterState {
  thumbnailDataUrl: string | null;
  videoTitle: string;
  channelAvatarDataUrl: string | null;
  channelName: string;
  layoutMode: LayoutMode;
  userCardIndex: number;
  highlightUserCard: boolean;
  selectedCompetitors: SampleVideoCard[];
}

const COMPETITOR_COUNT = 11;

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function loadImageAsDataUrl(filePath: string): Promise<string | null> {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png';
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  const mime = mimeMap[ext] ?? 'image/png';

  const result = await window.api.fileReadBinary({ path: filePath });
  if (result.error) return null;
  return `data:${mime};base64,${result.data}`;
}

export function useThumbnailTester() {
  const [state, setState] = useState<ThumbnailTesterState>({
    thumbnailDataUrl: null,
    videoTitle: '',
    channelAvatarDataUrl: null,
    channelName: '',
    layoutMode: 'home',
    userCardIndex: Math.floor(Math.random() * (COMPETITOR_COUNT + 1)),
    highlightUserCard: false,
    selectedCompetitors: pickRandom(SAMPLE_VIDEOS, COMPETITOR_COUNT),
  });

  const pickThumbnail = useCallback(async () => {
    const result = await window.api.dialogOpen({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return;
    const dataUrl = await loadImageAsDataUrl(result.filePaths[0]);
    if (dataUrl) {
      setState((s) => ({ ...s, thumbnailDataUrl: dataUrl }));
    }
  }, []);

  const pickChannelAvatar = useCallback(async () => {
    const result = await window.api.dialogOpen({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return;
    const dataUrl = await loadImageAsDataUrl(result.filePaths[0]);
    if (dataUrl) {
      setState((s) => ({ ...s, channelAvatarDataUrl: dataUrl }));
    }
  }, []);

  const handleThumbnailDrop = useCallback(async (filePath: string) => {
    const dataUrl = await loadImageAsDataUrl(filePath);
    if (dataUrl) {
      setState((s) => ({ ...s, thumbnailDataUrl: dataUrl }));
    }
  }, []);

  const handleAvatarDrop = useCallback(async (filePath: string) => {
    const dataUrl = await loadImageAsDataUrl(filePath);
    if (dataUrl) {
      setState((s) => ({ ...s, channelAvatarDataUrl: dataUrl }));
    }
  }, []);

  const setVideoTitle = useCallback((title: string) => {
    setState((s) => ({ ...s, videoTitle: title }));
  }, []);

  const setChannelName = useCallback((name: string) => {
    setState((s) => ({ ...s, channelName: name }));
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setState((s) => ({ ...s, layoutMode: mode }));
  }, []);

  const setHighlightUserCard = useCallback((highlight: boolean) => {
    setState((s) => ({ ...s, highlightUserCard: highlight }));
  }, []);

  const randomizePosition = useCallback(() => {
    const newCompetitors = pickRandom(SAMPLE_VIDEOS, COMPETITOR_COUNT);
    const newIndex = Math.floor(Math.random() * (COMPETITOR_COUNT + 1));
    setState((s) => ({
      ...s,
      selectedCompetitors: newCompetitors,
      userCardIndex: newIndex,
    }));
  }, []);

  const clearThumbnail = useCallback(() => {
    setState((s) => ({ ...s, thumbnailDataUrl: null }));
  }, []);

  const clearAvatar = useCallback(() => {
    setState((s) => ({ ...s, channelAvatarDataUrl: null }));
  }, []);

  const userCard: UserCardData = useMemo(() => ({
    thumbnailDataUrl: state.thumbnailDataUrl,
    videoTitle: state.videoTitle || 'Your Video Title',
    channelAvatarDataUrl: state.channelAvatarDataUrl,
    channelName: state.channelName || 'Your Channel',
  }), [state.thumbnailDataUrl, state.videoTitle, state.channelAvatarDataUrl, state.channelName]);

  return {
    ...state,
    userCard,
    pickThumbnail,
    pickChannelAvatar,
    handleThumbnailDrop,
    handleAvatarDrop,
    setVideoTitle,
    setChannelName,
    setLayoutMode,
    setHighlightUserCard,
    randomizePosition,
    clearThumbnail,
    clearAvatar,
  };
}
