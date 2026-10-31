import type { LibraryIndexEntry } from '@shared/types/asset-library';

/**
 * The details panel's sound rows (E3, design note (c)) from the index entry the
 * screen already holds: duration from `probe`, then the E1/E2/E4 audio fields.
 * A row appears only when its value is present. Pure, unit-tested.
 */

export interface DetailField {
  label: string;
  value: string;
}

const MINUS = '−';

/** Under a minute: one decimal ("1.2 s"); above: m:ss ("1:05"). */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** One decimal with a real minus sign, as the agent's answers print it ("−20.0"). */
function signed(value: number): string {
  const text = Math.abs(value).toFixed(1);
  return value < 0 && text !== '0.0' ? `${MINUS}${text}` : text;
}

function peakText(peak: number, kind: 'true' | 'sample' | undefined): string {
  if (kind === 'true') return `${signed(peak)} dBTP · true peak`;
  if (kind === 'sample') return `${signed(peak)} dBFS · sample peak`;
  return `${signed(peak)} dBFS`;
}

export function soundFieldsOf(
  meta: Pick<LibraryIndexEntry, 'probe' | 'audio' | 'usedIn'> | undefined
): DetailField[] {
  if (!meta) return [];
  const fields: DetailField[] = [];
  const duration = meta.probe?.duration;
  if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
    fields.push({ label: 'Duration', value: formatDuration(duration) });
  }
  const audio = meta.audio;
  if (audio) {
    if (audio.category) fields.push({ label: 'Category', value: audio.category });
    const loudness =
      audio.loudnessLufs !== undefined
        ? `${signed(audio.loudnessLufs)} LUFS`
        : audio.normalizeError
          ? 'not normalized'
          : 'no LUFS reading';
    fields.push({ label: 'Loudness', value: loudness });
    if (audio.peakDbfs !== undefined) fields.push({ label: 'Peak', value: peakText(audio.peakDbfs, audio.peakKind) });
    if (audio.source) fields.push({ label: 'Source', value: audio.source });
    if (audio.model) fields.push({ label: 'Model', value: audio.model });
    if (audio.license) fields.push({ label: 'Licence', value: audio.license });
  }
  if (meta.usedIn && meta.usedIn.length > 0) fields.push({ label: 'Used in', value: meta.usedIn.join(', ') });
  return fields;
}
