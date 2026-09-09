import type { AudioOutputFormat } from './types';

/** Constant bitrate (kbit/s) of each MP3 output format the app requests. */
const BITRATE_KBPS: Record<AudioOutputFormat, number> = {
  mp3_22050_32: 32,
  mp3_44100_64: 64,
  mp3_44100_96: 96,
  mp3_44100_128: 128,
  mp3_44100_192: 192,
};

/** Size of an ID3v2 tag at the head of the file, if one is there. */
function id3v2Bytes(bytes: Buffer): number {
  if (bytes.length < 10 || bytes.toString('latin1', 0, 3) !== 'ID3') return 0;
  // Syncsafe 28-bit size, header excluded.
  const size =
    ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  return 10 + size;
}

/**
 * Length of a CBR MP3 from its byte count and the bitrate the format names —
 * the app always asks for a constant-bitrate MP3, so this is exact to within
 * one frame (~26 ms) plus any trailing tag. Used when the model chose the
 * length itself (an SFX with no `duration_seconds`).
 */
export function estimateMp3DurationSec(bytes: Buffer, format: AudioOutputFormat): number {
  const audioBytes = Math.max(0, bytes.length - id3v2Bytes(bytes));
  const seconds = (audioBytes * 8) / (BITRATE_KBPS[format] * 1000);
  return Math.round(seconds * 100) / 100;
}
