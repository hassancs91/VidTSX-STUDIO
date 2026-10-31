import { useEffect, useState } from 'react';

interface AudioPreviewProps {
  /** The module server's `/asset?path=` URL; null when the server isn't running. */
  url: string | null;
  /** Called when this player starts, so the screen pauses its shared tile player. */
  onPlay: (player: HTMLMediaElement) => void;
}

/**
 * The details panel's player for an audio file (E3). `preload="none"` — nothing
 * is fetched until play. A server that is down or a file that won't decode gives
 * a quiet line under the control, never a crash.
 */
export function AudioPreview({ url, onPlay }: AudioPreviewProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url) {
    return (
      <div className="text-[11px] text-text-dim" data-audio-preview="unavailable">
        Playback needs the preview server, which isn't running.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <audio
        key={url}
        src={url}
        controls
        preload="none"
        data-asset-audio="details"
        onPlay={(e) => onPlay(e.currentTarget)}
        onError={() => setFailed(true)}
        className="w-full h-8"
        style={{ colorScheme: 'dark' }}
      />
      {failed && (
        <div className="text-[11px] text-text-dim" data-audio-preview="failed">
          Can&apos;t play this file.
        </div>
      )}
    </div>
  );
}
