import { useEffect, useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import { Select } from '@shared/components/Select';
import type { VideoStudioEntry } from '@shared/ipc/types';

interface Props {
  label: string;
  /** An absolute file path, or a Video Studio entry id when `source` is `library`. */
  value: string;
  onChange: (next: string) => void;
  /** Which value the bound node reads (flows plan §1.4): `input_video_file`
   *  takes a `filePath` or an `entryId`. */
  source: 'file' | 'library';
  disabled?: boolean;
}

const VIDEO_FILTERS = [{ name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'm4v'] }];

function baseName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

/**
 * The run form's `video` param (flows plan §1.4, W8 Stage 2): a file chooser
 * through the native dialog, or a Video Studio entry when the param binds to
 * the entry id. Either way the value is one string the tool resolves.
 */
export function VideoPickField({ label, value, onChange, source, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<VideoStudioEntry[] | null>(null);

  useEffect(() => {
    if (source !== 'library') return;
    let cancelled = false;
    void window.api.videoStudioList().then((res) => {
      if (cancelled) return;
      setEntries(res.success ? res.entries : []);
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (source === 'library') {
    return (
      <label className="flex flex-col gap-1" data-video-pick>
        <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
        <Select
          value={value}
          placeholder={entries === null ? 'Loading…' : entries.length === 0 ? 'No videos in the Video Studio' : 'Choose a video'}
          disabled={disabled || entries === null}
          onChange={onChange}
          options={(entries ?? []).map((e) => ({
            value: e.id,
            label: `${e.prompt.slice(0, 48) || e.fileName}${e.durationSeconds ? ` · ${Math.round(e.durationSeconds)} s` : ''}`,
          }))}
        />
      </label>
    );
  }

  const pick = async () => {
    setBusy(true);
    try {
      const res = await window.api.dialogOpen({ filters: VIDEO_FILTERS });
      if (!res.canceled && res.filePaths[0]) onChange(res.filePaths[0]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1" data-video-pick>
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void pick()}
          disabled={disabled || busy}
          className="flex items-center gap-1.5 h-[26px] px-2.5 rounded-[6px] text-[11px] text-text-secondary hover:bg-app-hover disabled:opacity-40"
          style={{ border: '0.5px solid var(--color-border-hover)' }}
        >
          <FolderOpen size={11} strokeWidth={1.75} />
          {value ? 'Change…' : 'Choose video…'}
        </button>
        {value ? (
          <>
            <span className="text-[11px] text-text-secondary truncate min-w-0 flex-1" title={value}>
              {baseName(value)}
            </span>
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled}
              title="Clear"
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-app-hover"
            >
              <X size={11} strokeWidth={1.75} />
            </button>
          </>
        ) : (
          <span className="text-[11px] text-text-dim">No file chosen</span>
        )}
      </div>
    </div>
  );
}
