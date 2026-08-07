import { describe, it, expect } from 'vitest';
import { findWavDataOffset } from './waveform-generator';

/** Build a piped-style WAV header: RIFF/WAVE, fmt, optional LIST, then data. */
function makeHeader(withListChunk: boolean): Buffer {
  const parts: Buffer[] = [];
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(0xffffffff, 4); // streamed: length unknown
  riff.write('WAVE', 8, 'ascii');
  parts.push(riff);

  const fmt = Buffer.alloc(8 + 16);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  parts.push(fmt);

  if (withListChunk) {
    // ffmpeg emits an INFO chunk here. Its tag text deliberately contains
    // "data" — that is exactly the hazard a naive search for the literal
    // string falls into, landing inside metadata instead of the samples.
    const payload = Buffer.concat([
      Buffer.from('INFOIART', 'ascii'),
      Buffer.from([8, 0, 0, 0]), // tag length
      Buffer.from('data-ish', 'ascii'),
    ]);
    const list = Buffer.alloc(8 + payload.length);
    list.write('LIST', 0, 'ascii');
    list.writeUInt32LE(payload.length, 4);
    payload.copy(list, 8);
    parts.push(list);
  }

  const data = Buffer.alloc(8);
  data.write('data', 0, 'ascii');
  data.writeUInt32LE(0xfffffffe, 4);
  parts.push(data);

  return Buffer.concat(parts);
}

describe('findWavDataOffset', () => {
  it('finds the payload right after the fmt chunk', () => {
    const header = makeHeader(false);
    expect(findWavDataOffset(header)).toBe(header.length);
  });

  it('walks past a LIST/INFO chunk whose text contains "data"', () => {
    const header = makeHeader(true);
    expect(findWavDataOffset(header)).toBe(header.length);
  });

  it('asks for more bytes when the header is incomplete', () => {
    expect(findWavDataOffset(makeHeader(true).subarray(0, 20))).toBeNull();
    expect(findWavDataOffset(Buffer.alloc(4))).toBeNull();
  });

  it('rejects output that is not a WAV stream', () => {
    const junk = Buffer.alloc(16);
    junk.write('NOPEnope', 0, 'ascii');
    expect(() => findWavDataOffset(junk)).toThrow(/not a RIFF/);
  });
});
