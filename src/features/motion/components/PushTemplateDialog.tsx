import { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Button, TextInput } from '@shared/components';
import { usePushTemplate } from '../hooks/usePushTemplate';
import { useGenerateMetadata } from '../hooks/useGenerateMetadata';
import { useGenerateThumbnail } from '../hooks/useGenerateThumbnail';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomSuffix(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function uniqueSlug(title: string): string {
  const base = slugify(title);
  if (!base) return '';
  return `${base}-${randomSuffix()}`;
}

interface CompositionSummary {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

interface PushTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tsxFilePath: string | null;
  mp4Path: string | null;
  composition: CompositionSummary | null;
}

export function PushTemplateDialog({
  isOpen,
  onClose,
  tsxFilePath,
  mp4Path,
  composition,
}: PushTemplateDialogProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [featured, setFeatured] = useState(false);

  // Thumbnail state: either the freshly-generated result or the previously-loaded sidecar
  const [loadedThumb, setLoadedThumb] = useState<{ path: string | null; size: number | null }>({
    path: null,
    size: null,
  });
  const [imgRefreshKey, setImgRefreshKey] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Push-result persistence: set on successful push, reloaded on reopen
  const [pushedAt, setPushedAt] = useState<string | undefined>(undefined);
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [templateUrl, setTemplateUrl] = useState<string | undefined>(undefined);

  const { pushing, result, push, reset } = usePushTemplate();
  const { generate: generateMeta, loading: aiLoading, error: aiError } = useGenerateMetadata();
  const { generating: thumbGenerating, result: thumbResult, generate: generateThumb, reset: resetThumb } = useGenerateThumbnail();

  const parseTags = useCallback(
    () => tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
    [tagsInput]
  );

  const saveDraft = useCallback(
    async (path: string, overrides?: Partial<{ pushedAt: string; templateId: string; templateUrl: string }>) => {
      await window.api.creatorSavePushDraft({
        tsxFilePath: path,
        draft: {
          title: title.trim(),
          slug: slug.trim(),
          slugEdited,
          description: description.trim(),
          tags: parseTags(),
          isPremium,
          featured,
          pushedAt: overrides?.pushedAt ?? pushedAt,
          templateId: overrides?.templateId ?? templateId,
          templateUrl: overrides?.templateUrl ?? templateUrl,
        },
      });
    },
    [title, slug, slugEdited, description, parseTags, isPremium, featured, pushedAt, templateId, templateUrl]
  );

  // Load draft + existing thumbnail when the dialog opens
  useEffect(() => {
    if (!isOpen || !tsxFilePath) return;
    let cancelled = false;
    setIsLoaded(false);
    window.api
      .creatorLoadPushDraft({ tsxFilePath })
      .then((res) => {
        if (cancelled) return;
        if (res.draft) {
          setTitle(res.draft.title);
          setSlug(res.draft.slug);
          setSlugEdited(res.draft.slugEdited);
          setDescription(res.draft.description);
          setTagsInput(res.draft.tags.join(', '));
          setIsPremium(res.draft.isPremium);
          setFeatured(res.draft.featured);
          setPushedAt(res.draft.pushedAt);
          setTemplateId(res.draft.templateId);
          setTemplateUrl(res.draft.templateUrl);
        }
        if (res.thumbnailPath) {
          setLoadedThumb({ path: res.thumbnailPath, size: res.thumbnailSize });
          setImgRefreshKey((k) => k + 1);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, tsxFilePath]);

  // Reset state when dialog fully closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setSlug('');
      setSlugEdited(false);
      setDescription('');
      setTagsInput('');
      setIsPremium(false);
      setFeatured(false);
      setLoadedThumb({ path: null, size: null });
      setIsLoaded(false);
      setPushedAt(undefined);
      setTemplateId(undefined);
      setTemplateUrl(undefined);
      reset();
      resetThumb();
    }
  }, [isOpen, reset, resetThumb]);

  // Auto-seed slug from title only when slug wasn't edited and we have content
  useEffect(() => {
    if (!isLoaded) return;
    if (!slugEdited) setSlug(title ? uniqueSlug(title) : '');
  }, [title, slugEdited, isLoaded]);

  // Refresh image when a new generation completes (same path, need cache-bust)
  useEffect(() => {
    if (thumbResult?.success) setImgRefreshKey((k) => k + 1);
  }, [thumbResult]);

  const durationSeconds = useMemo(() => {
    if (!composition) return 0;
    return composition.durationInFrames / composition.fps;
  }, [composition]);

  // Prefer the freshly-generated thumbnail; otherwise fall back to the persisted one
  const thumbnailPath = thumbResult?.success
    ? thumbResult.thumbnailPath ?? null
    : loadedThumb.path;
  const thumbnailSize = thumbResult?.success
    ? thumbResult.sizeBytes ?? null
    : loadedThumb.size;

  const canSubmit = !pushing && !aiLoading && !thumbGenerating && !!tsxFilePath && !!mp4Path && !!thumbnailPath && title.trim().length > 0 && slug.trim().length > 0;

  const handleGenerateThumb = async () => {
    if (!mp4Path || !tsxFilePath) return;
    await generateThumb({ mp4Path, tsxFilePath });
  };

  const handleGenerateAi = async () => {
    if (!tsxFilePath || !composition) return;
    const fileRead = await window.api.fileRead({ path: tsxFilePath });
    if (fileRead.error || !fileRead.content) return;
    const meta = await generateMeta({
      tsxCode: fileRead.content,
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationSeconds: composition.durationInFrames / composition.fps,
    });
    if (!meta) return;
    const newSlug = uniqueSlug(meta.title);
    setTitle(meta.title);
    setDescription(meta.description);
    setTagsInput(meta.tags.join(', '));
    setSlug(newSlug);
    setSlugEdited(false);
    // Save with the freshly-generated values, not the stale closure
    if (tsxFilePath) {
      await window.api.creatorSavePushDraft({
        tsxFilePath,
        draft: {
          title: meta.title,
          slug: newSlug,
          slugEdited: false,
          description: meta.description,
          tags: meta.tags,
          isPremium,
          featured,
        },
      });
    }
  };

  const handleClose = async () => {
    if (tsxFilePath && isLoaded) {
      await saveDraft(tsxFilePath);
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || !tsxFilePath || !mp4Path || !thumbnailPath) return;
    await saveDraft(tsxFilePath);
    const res = await push({
      tsxFilePath,
      mp4Path,
      thumbnailPath,
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim(),
      tags: parseTags(),
      isPremium,
      featured,
    });
    if (res.success) {
      const nowIso = new Date().toISOString();
      setPushedAt(nowIso);
      setTemplateId(res.templateId);
      setTemplateUrl(res.url);
      await saveDraft(tsxFilePath, {
        pushedAt: nowIso,
        templateId: res.templateId,
        templateUrl: res.url,
      });
      setTimeout(() => onClose(), 1500);
    }
  };

  const pushedAgo = useMemo(() => {
    if (!pushedAt) return null;
    const ms = Date.now() - new Date(pushedAt).getTime();
    if (Number.isNaN(ms) || ms < 0) return null;
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, [pushedAt]);

  return (
    <Modal isOpen={isOpen} onClose={pushing ? () => {} : handleClose} title="Push Template to Library">
      <div className="flex flex-col gap-3 w-[420px]">
        {pushedAt && !result && (
          <div
            className="text-[11px] rounded-[6px] px-[8px] py-[6px] flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(34,197,94,0.1)',
              color: 'rgb(34,197,94)',
            }}
          >
            <span>✓ Already pushed {pushedAgo}</span>
            {templateId && <span className="text-text-dim">· id: {templateId}</span>}
            {templateUrl && (
              <button
                type="button"
                onClick={() => window.api.appOpenExternal({ url: templateUrl })}
                className="ml-auto underline hover:opacity-80"
              >
                open
              </button>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          {composition && (
            <div className="text-[10px] text-text-dim">
              {composition.width}×{composition.height} · {composition.fps}fps · {durationSeconds.toFixed(2)}s
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateAi}
            disabled={aiLoading || pushing || !tsxFilePath || !composition}
          >
            {aiLoading ? 'Generating…' : 'Generate with AI'}
          </Button>
        </div>

        {aiError && (
          <div
            className="text-[10px] rounded-[6px] px-[8px] py-[6px]"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              color: 'var(--color-status-error)',
            }}
          >
            {aiError}
          </div>
        )}

        {/* Thumbnail section */}
        <div className="flex flex-col gap-2 rounded-[6px] px-[8px] py-[8px]" style={{ border: '0.5px solid var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Thumbnail</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerateThumb}
              disabled={thumbGenerating || pushing || !mp4Path || !tsxFilePath}
            >
              {thumbGenerating ? 'Generating…' : thumbnailPath ? 'Regenerate' : 'Generate Thumbnail'}
            </Button>
          </div>
          {thumbnailPath && (
            <div className="flex items-center gap-3">
              <img
                key={imgRefreshKey}
                src={`file://${thumbnailPath.replace(/\\/g, '/')}?v=${imgRefreshKey}`}
                alt="Animated thumbnail preview"
                className="rounded-[4px]"
                style={{ width: 160, height: 'auto', border: '0.5px solid var(--color-border)' }}
              />
              <span className="text-[10px] text-text-dim">
                {thumbnailSize !== null ? `${Math.round(thumbnailSize / 1024)} KB` : ''}
              </span>
            </div>
          )}
          {thumbResult && !thumbResult.success && (
            <div
              className="text-[10px] rounded-[6px] px-[8px] py-[6px]"
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                color: 'var(--color-status-error)',
              }}
            >
              {thumbResult.error}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Title</span>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunset Intro"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Slug</span>
          <TextInput
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
            placeholder="sunset-intro-a1b2c3"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="A 10-second animated intro with sunset gradient."
            className="bg-app-base text-text-primary rounded-[6px] px-[8px] py-[6px] resize-none focus:outline-none"
            style={{
              fontSize: 11,
              border: '0.5px solid var(--color-border-input)',
              fontFamily: 'inherit',
            }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Tags (comma-separated)</span>
          <TextInput
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="intro, gradient, fade"
          />
        </label>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
            />
            <span className="text-[11px] text-text-secondary">Premium</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            <span className="text-[11px] text-text-secondary">Featured</span>
          </label>
        </div>

        {result && (
          <div
            className="text-[11px] rounded-[6px] px-[8px] py-[6px]"
            style={{
              backgroundColor: result.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: result.success ? 'rgb(34,197,94)' : 'var(--color-status-error)',
            }}
          >
            {result.success
              ? `Pushed${result.templateId ? ` (id: ${result.templateId})` : ''}${result.url ? ` — ${result.url}` : ''}`
              : result.error || 'Push failed'}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={handleClose} disabled={pushing}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            {pushing ? 'Pushing...' : pushedAt ? 'Re-push' : 'Push'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
