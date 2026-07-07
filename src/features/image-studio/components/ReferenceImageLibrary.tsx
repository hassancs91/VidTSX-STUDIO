import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReferenceImageEntry } from '../../../shared/ipc/types';

interface ReferenceImageLibraryProps {
  onEnabledImagesChange: (base64Images: string[]) => void;
  singleSelect?: boolean;
  label?: string;
  pendingEnable?: { id: string; base64: string; contentType: string } | null;
  onConsumePendingEnable?: () => void;
}

function readFileAsBase64(file: File): Promise<{ base64: string; contentType: string; name: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, contentType: file.type || 'image/png', name: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_CACHE_SIZE = 20;

export function ReferenceImageLibrary({
  onEnabledImagesChange,
  singleSelect = false,
  label = 'Reference Images',
  pendingEnable = null,
  onConsumePendingEnable,
}: ReferenceImageLibraryProps) {
  const [entries, setEntries] = useState<ReferenceImageEntry[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const base64Cache = useRef<Record<string, string>>({});
  const cacheOrderRef = useRef<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevEnabledIdsRef = useRef<string>('');

  const addToCache = useCallback((id: string, data: string) => {
    if (!base64Cache.current[id]) {
      cacheOrderRef.current.push(id);
      if (cacheOrderRef.current.length > MAX_CACHE_SIZE) {
        const evicted = cacheOrderRef.current.shift()!;
        delete base64Cache.current[evicted];
      }
    }
    base64Cache.current[id] = data;
  }, []);

  // Load saved references on mount
  useEffect(() => {
    const load = async () => {
      const result = await window.api.refImageList();
      if (result.success) {
        setEntries(result.entries);
        // Load thumbnails for all entries
        for (const entry of result.entries) {
          loadThumbnail(entry.id);
        }
      }
    };
    load();
  }, []);

  // Enable a specific entry when requested by parent (e.g. via "Use as Input").
  // The parent has already saved the reference — we just need to make it visible
  // in this library's state (entries + thumbnails) and enable it.
  useEffect(() => {
    if (!pendingEnable) return;
    const { id, base64 } = pendingEnable;

    // Seed thumbnail + cache synchronously so the tile renders immediately.
    addToCache(id, base64);
    setThumbnails((prev) => (prev[id] ? prev : { ...prev, [id]: base64 }));

    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      // Entry not yet in our local list — fetch fresh manifest so we can display it.
      (async () => {
        const result = await window.api.refImageList();
        if (result.success) setEntries(result.entries);
      })();
      return;
    }

    // Apply singleSelect / multi-select enable semantics, then consume.
    (async () => {
      if (singleSelect) {
        const others = entries.filter((e) => e.enabled && e.id !== id);
        const alreadyExclusive = entry.enabled && others.length === 0;
        if (!alreadyExclusive) {
          await Promise.all(others.map((e) => window.api.refImageToggle({ id: e.id, enabled: false })));
          if (!entry.enabled) {
            await window.api.refImageToggle({ id, enabled: true });
          }
          setEntries((prev) => prev.map((e) => ({ ...e, enabled: e.id === id })));
        }
      } else if (!entry.enabled) {
        await window.api.refImageToggle({ id, enabled: true });
        setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, enabled: true } : e)));
      }
      onConsumePendingEnable?.();
    })();
  }, [pendingEnable, entries, singleSelect, onConsumePendingEnable, addToCache]);

  // Push enabled images to parent whenever enabled set changes
  useEffect(() => {
    const enabledIds = entries
      .filter((e) => e.enabled)
      .map((e) => e.id)
      .join(',');

    if (enabledIds === prevEnabledIdsRef.current) return;
    prevEnabledIdsRef.current = enabledIds;

    let cancelled = false;

    const pushEnabled = async () => {
      const enabled = entries.filter((e) => e.enabled);
      const base64List: string[] = [];
      for (const entry of enabled) {
        if (cancelled) return;
        if (base64Cache.current[entry.id]) {
          base64List.push(base64Cache.current[entry.id]);
        } else {
          const res = await window.api.refImageRead({ id: entry.id });
          if (cancelled) return;
          if (res.success && res.base64) {
            addToCache(entry.id, res.base64);
            base64List.push(res.base64);
          }
        }
      }
      if (!cancelled) {
        onEnabledImagesChange(base64List);
      }
    };
    pushEnabled();

    return () => { cancelled = true; };
  }, [entries, onEnabledImagesChange]);

  const loadThumbnail = async (id: string) => {
    if (thumbnails[id]) return;
    const res = await window.api.refImageRead({ id });
    if (res.success && res.base64) {
      addToCache(id, res.base64);
      setThumbnails((prev) => ({ ...prev, [id]: res.base64! }));
    }
  };

  const handleToggle = useCallback(async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const newEnabled = !entry.enabled;

    if (singleSelect && newEnabled) {
      const othersToDisable = entries.filter((e) => e.enabled && e.id !== id);
      await Promise.all(othersToDisable.map((e) => window.api.refImageToggle({ id: e.id, enabled: false })));
      await window.api.refImageToggle({ id, enabled: true });
      setEntries((prev) => prev.map((e) => ({ ...e, enabled: e.id === id })));
      return;
    }

    await window.api.refImageToggle({ id, enabled: newEnabled });
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, enabled: newEnabled } : e)));
  }, [entries, singleSelect]);

  const handleDelete = useCallback(async (id: string) => {
    await window.api.refImageDelete({ id });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    delete base64Cache.current[id];
    cacheOrderRef.current = cacheOrderRef.current.filter((cid) => cid !== id);
    setThumbnails((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    for (const file of imageFiles) {
      const { base64, contentType, name } = await readFileAsBase64(file);
      const result = await window.api.refImageSave({ base64, originalName: name, contentType });
      if (result.success && result.entry) {
        addToCache(result.entry.id, base64);
        setEntries((prev) => [...prev, result.entry!]);
        setThumbnails((prev) => ({ ...prev, [result.entry!.id]: base64 }));
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const enabledCount = entries.filter((e) => e.enabled).length;

  return (
    <div>
      <div className="text-[10px] text-text-dim mb-1">
        {label}{entries.length > 0 && ` (${enabledCount}/${entries.length} active)`}
      </div>

      {/* Thumbnails grid */}
      {entries.length > 0 && (
        <div className="flex gap-1.5 mb-1.5 flex-wrap">
          {entries.map((entry) => (
            <div key={entry.id} className="relative group">
              {/* Thumbnail */}
              <img
                src={thumbnails[entry.id] ? `data:${entry.contentType};base64,${thumbnails[entry.id]}` : undefined}
                alt={entry.originalName}
                className={`w-[52px] h-[52px] object-cover rounded border transition-all cursor-pointer ${
                  entry.enabled ? 'border-accent opacity-100' : 'border-border opacity-40'
                }`}
                onClick={() => handleToggle(entry.id)}
              />

              {/* Circle checkbox — bottom-right */}
              <button
                type="button"
                className={`absolute bottom-0.5 right-0.5 w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] transition-all ${
                  entry.enabled
                    ? 'bg-accent text-white'
                    : 'bg-app-surface border border-border text-transparent'
                }`}
                onClick={() => handleToggle(entry.id)}
              >
                {entry.enabled && (
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Delete button — top-right on hover */}
              <button
                type="button"
                className="absolute -top-1 -right-1 w-[16px] h-[16px] rounded-full bg-accent-red text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(entry.id)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        className="flex flex-col items-center justify-center border border-dashed border-border rounded-lg py-3 px-3 cursor-pointer hover:border-text-dim hover:bg-app-base/50 transition-colors"
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mb-0.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        <span className="text-[10px] text-text-dim">Drop or click to add reference images</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
