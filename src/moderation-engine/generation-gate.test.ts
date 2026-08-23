import { describe, it, expect } from 'vitest';
import { checkGenerationPrompt } from './generation-gate';
import { GENERATION_BLOCKLIST } from './generation-blocklist';

describe('checkGenerationPrompt — golden policy tests (CONTENT_SAFETY_DESIGN.md D3/D6)', () => {
  describe('profanity alone never blocks', () => {
    it.each([
      'a neon sign that says fuck',
      'a mug with the text shit happens',
      'damn good coffee — retro ad poster',
      'an angry cartoon character shouting asshole',
      'grumpy old man calling someone a bastard',
    ])('allows %j', (prompt) => {
      expect(checkGenerationPrompt(prompt).blocked).toBe(false);
    });
  });

  describe('sexual / nudity / pornography intent blocks', () => {
    it('blocks a nudity request and names the category', () => {
      const r = checkGenerationPrompt('nude portrait of a woman');
      expect(r.blocked).toBe(true);
      expect(r.category).toBe('nudity');
    });

    it('blocks a pornography request', () => {
      const r = checkGenerationPrompt('a porn scene in a hotel room');
      expect(r.blocked).toBe(true);
      expect(r.category).toBe('pornography');
    });

    it('blocks a sexual-act request', () => {
      const r = checkGenerationPrompt('two people having sex');
      expect(r.blocked).toBe(true);
      expect(r.category).toBe('sexual');
    });

    it('prefers the sexual category when several match', () => {
      const r = checkGenerationPrompt('nude blowjob photo');
      expect(r.blocked).toBe(true);
      expect(r.category).toBe('sexual');
    });
  });

  describe('normalizer variants block', () => {
    it.each([
      ['full-width', 'ｎｕｄｅ beach photo'],
      ['leet + separators', 'n.u.d.3 selfie'],
      ['Cyrillic homoglyph', 'nudе portrait'], // U+0435
      ['leet boobs', 'b00bs pic'],
      ['repeat collapse', 'nuuuude drawing'],
    ])('blocks %s evasion', (_label, prompt) => {
      expect(checkGenerationPrompt(prompt).blocked).toBe(true);
    });
  });

  describe('sexualized-minor terms block (first priority)', () => {
    it.each(['jailbait photo', 'child porn', 'lolicon artwork', 'pedo content', 'naked child'])(
      'blocks %j',
      (prompt) => {
        const r = checkGenerationPrompt(prompt);
        expect(r.blocked).toBe(true);
        expect(r.category).toBe('sexual');
      },
    );
  });

  describe('language-blind collisions stay allowed', () => {
    it.each([
      'I am happy today', // tr "am" dropped
      'BBC news studio set', // bbc dropped
      'a sperm whale swimming in the ocean', // sperm dropped
      'kinky curly hair portrait', // kinky dropped
      'SEGA Genesis console on a desk', // it "sega" dropped
      'a police escort with motorcycles', // escort dropped
      'bareback horse riding in a field', // bareback dropped
      'blue tit perched on a branch', // tit dropped
    ])('allows %j', (prompt) => {
      expect(checkGenerationPrompt(prompt).blocked).toBe(false);
    });
  });

  describe('word boundaries hold', () => {
    it.each([
      'assess the classroom layout',
      'a map of Scunthorpe town centre',
      'therapist office interior',
      'analysis dashboard mockup',
    ])('allows %j', (prompt) => {
      expect(checkGenerationPrompt(prompt).blocked).toBe(false);
    });
  });

  describe('no-space scripts match without spaces', () => {
    it('blocks a zh term embedded in a sentence', () => {
      expect(checkGenerationPrompt('一个性交场景').blocked).toBe(true);
    });

    it('blocks a ja term embedded in a sentence', () => {
      expect(checkGenerationPrompt('裸の女性の写真を作って').blocked).toBe(true);
    });

    it('still allows clean CJK text', () => {
      expect(checkGenerationPrompt('美しい山の風景の写真').blocked).toBe(false);
    });
  });

  describe('blocklist hygiene', () => {
    it('contains no profanity-category terms', () => {
      expect(GENERATION_BLOCKLIST.every((t) => t.category !== 'profanity')).toBe(true);
    });

    it('is non-trivially sized', () => {
      expect(GENERATION_BLOCKLIST.length).toBeGreaterThan(1000);
    });

    it('empty and whitespace prompts pass', () => {
      expect(checkGenerationPrompt('').blocked).toBe(false);
      expect(checkGenerationPrompt('   ').blocked).toBe(false);
    });
  });
});
