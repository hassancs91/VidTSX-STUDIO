import { describe, expect, it } from 'vitest';
import {
  MEDIA_EXT_KIND,
  extensionsOfKind,
  isPlayableMediaKind,
  mediaKindOf,
} from './media-kinds';

describe('media-kinds — the one extension → kind table (E1)', () => {
  it('covers every audio extension the two old tables knew, .opus included', () => {
    for (const ext of ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus']) {
      expect(MEDIA_EXT_KIND[ext]).toBe('audio');
    }
  });

  it('covers every video and image extension of both old tables', () => {
    for (const ext of ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.mts', '.m2ts']) {
      expect(MEDIA_EXT_KIND[ext]).toBe('video');
    }
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.svg', '.avif']) {
      expect(MEDIA_EXT_KIND[ext]).toBe('image');
    }
  });

  it('keeps the library-only kinds of the Assets screen', () => {
    expect(mediaKindOf('scene.glb')).toBe('model3d');
    expect(mediaKindOf('Inter.woff2')).toBe('font');
    expect(mediaKindOf('catalog.json')).toBe('data');
    expect(mediaKindOf('promo.tsx')).toBe('other');
    expect(mediaKindOf('README')).toBe('other');
  });

  it('classifies by the last extension, case-insensitively, from a name or a path', () => {
    expect(mediaKindOf('sfx/Whoosh.OPUS')).toBe('audio');
    expect(mediaKindOf('C:\\lib\\clip.final.MP4')).toBe('video');
    expect(mediaKindOf('generated/sfx-boom.mp3')).toBe('audio');
    expect(mediaKindOf('.hidden')).toBe('other');
  });

  it('narrows to the three kinds a timeline can play', () => {
    expect(isPlayableMediaKind('audio')).toBe(true);
    expect(isPlayableMediaKind('video')).toBe(true);
    expect(isPlayableMediaKind('image')).toBe(true);
    expect(isPlayableMediaKind('font')).toBe(false);
    expect(isPlayableMediaKind('other')).toBe(false);
  });

  it('lists the extensions of a kind for dialog filters', () => {
    const audio = extensionsOfKind('audio');
    expect(audio).toContain('.opus');
    expect(audio.every((e) => MEDIA_EXT_KIND[e] === 'audio')).toBe(true);
  });
});
