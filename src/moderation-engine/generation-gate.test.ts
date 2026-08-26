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

  describe('pruned collision terms stay allowed (Hasan review pass 2026-08-26)', () => {
    it.each([
      // en homonyms / idioms
      'a shark bite in the ocean',
      'sound bite from the interview',
      'strap on your helmet and go',
      'debt snowballing out of control',
      'shrimping boats at dawn in louisiana',
      'chef tossing salad in a bowl',
      'guitar fingering chart for beginners',
      'in nineteen sixty-nine we landed on the moon',
      'a girl on top of a mountain at sunrise',
      'spread legs shoulder-width apart yoga pose',
      'kids ball kicking drills on the pitch',
      'olympic snatch lift technique',
      'beat off the competition this quarter',
      'full of spunk and energy',
      'axe wound first aid demonstration',
      'cipa battery rating test for cameras',
      'king cnut commanding the tide',
      'ball-peen hammer on a workbench',
      'a golf threesome on the fairway',
      'the hooker throws into the scrum',
      'rooster cock crowing at dawn on a farm',
      'moby dick illustration for a book cover',
      'the camera acts as a voyeur in this film style',
      'kum plaj ve deniz manzarasi', // tr: sand, beach and sea view
      // cross-language innocents
      'concha pastry on a plate in a bakery', // es: pastry/seashell
      'aftrekken van breuken uitgelegd', // nl: subtracting fractions
      'rosette piping on a wedding cake', // de-listed, English word
      'une chatte qui dort sur le canape', // fr: sleeping cat
      'houten poppen in een speelgoedwinkel', // nl/de: wooden dolls
      'ramoner la cheminee avant l hiver', // fr: chimney sweeping
      'فرّج الله همّه', // ar: relief (religious phrase)
      'قضيب حديد على السكة', // ar: iron rod on the rail
      'مبادل حراري في المصنع', // ar: heat exchanger
      'چکلا بیلن سے روٹی بنائیں', // ur: chakla rolling board
      'sike that was just a joke',
      // CJK substring collisions
      'ドローンのローターを交換する', // ja: replacing drone rotors
      '温泉の脱衣所で着替える', // ja: onsen changing room
      '裸足で砂浜を歩く', // ja: walking barefoot
      '完全変態の昆虫の図', // ja: insect metamorphosis diagram
      '动物交配行为的纪录片', // zh: animal-mating documentary
    ])('allows %j', (prompt) => {
      expect(checkGenerationPrompt(prompt).blocked).toBe(false);
    });

    it.each([
      // neighbors of pruned terms keep blocking
      ['suck my cock', 'sexual'],
      ['big black cock photo', 'nudity'],
      ['suck my dick', 'sexual'],
      ['strap-on harness photo', 'sexual'], // separator removal → 'strapon'
      ['nude woman on a bed', 'nudity'],
    ] as const)('still blocks %j', (prompt, category) => {
      const r = checkGenerationPrompt(prompt);
      expect(r.blocked).toBe(true);
      expect(r.category).toBe(category);
    });
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
