import { describe, it, expect } from 'vitest';
import { imageExtension, readImageDimensions } from './port-media';

function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(33, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

/** SOI, an APP0 segment, then a baseline SOF0 with the given size. */
function jpeg(width: number, height: number): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]);
  const sof = Buffer.alloc(2 + 2 + 5 + 4);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof.writeUInt16BE(11, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}

describe('readImageDimensions', () => {
  it('reads PNG and JPEG headers, and gives up on anything else', () => {
    expect(readImageDimensions(png(1280, 720))).toEqual({ width: 1280, height: 720 });
    expect(readImageDimensions(jpeg(640, 480))).toEqual({ width: 640, height: 480 });
    expect(readImageDimensions(Buffer.from('RIFF....WEBP'))).toBeNull();
    expect(readImageDimensions(Buffer.alloc(0))).toBeNull();
  });
});

describe('imageExtension', () => {
  it('prefers the file name, then the content type, then jpg', () => {
    expect(imageExtension('image/png', 'a.JPEG')).toBe('.jpg');
    expect(imageExtension('image/png', 'a.webp')).toBe('.webp');
    expect(imageExtension('image/png')).toBe('.png');
    expect(imageExtension('image/webp', 'noext')).toBe('.webp');
    expect(imageExtension(undefined)).toBe('.jpg');
  });
});
