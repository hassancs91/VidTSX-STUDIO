// Decoding the studioCacheRead channel's payload into text. Main sends the
// cache file's raw bytes as base64; `atob` alone yields one character per
// BYTE, so any UTF-8 text past ASCII (an em-dash in an AssemblyAI word, a
// curly quote, Arabic) came out as Latin-1 mojibake (B5, 2026-10-22). Every
// renderer read of a cache text file goes through here.

const NON_ASCII = /[\x80-\xff]/;

/** The UTF-8 text a base64 payload holds. Pure ASCII passes through as-is. */
export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  // Waveform / envelope JSON is ASCII — skip the byte copy for it.
  if (!NON_ASCII.test(binary)) return binary;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
