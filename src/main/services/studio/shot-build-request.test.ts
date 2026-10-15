import { describe, expect, it } from 'vitest';
import {
  brandText,
  editIntent,
  generateIntent,
  isTransparentKind,
  refineIntent,
  shotBuildRequest,
  shotFormat,
  studioShotPack,
  STUDIO_SHOT_PACK,
} from './shot-build-request';
import type { StudioBrand } from '../../../shared/types/asset-library';

const kit = { version: '1.2.0', manifest: '# Kit manifest\n- TerminalWindow({ lines })\n' };

describe('studioShotPack', () => {
  it('carries the craft, the contract and the kit manifest verbatim, and no exemplars', () => {
    const pack = studioShotPack(kit);
    expect(pack.name).toBe(STUDIO_SHOT_PACK);
    expect(pack.body).toContain('## Shot craft');
    expect(pack.body).toContain('## The Studio shot contract');
    expect(pack.body).toContain("## Component kit: '@vidtsx/kit' (v1.2.0)");
    expect(pack.body).toContain('- TerminalWindow({ lines })');
    expect(pack.body).toMatch(/images, video and audio only/);
    expect(pack.body).not.toMatch(/exemplar/i);
  });

  it('leaves the kit out when its manifest is missing', () => {
    expect(studioShotPack(null).body).not.toContain('@vidtsx/kit');
  });
});

describe('shotFormat', () => {
  it('is the project frame at the shot length, never a loop', () => {
    expect(shotFormat({ width: 1920, height: 1080, fps: 30 }, 4.5)).toEqual({ width: 1920, height: 1080, fps: 30, durationInFrames: 135 });
  });
});

describe('generateIntent', () => {
  it('states the kind and background rule, the brief, the word table verbatim, the learned style and the media', () => {
    const intent = generateIntent({
      kind: 'title',
      brief: 'The phrase "AutoCut feature" lands word by word.',
      durationSeconds: 2.4,
      words: [
        { text: 'AutoCut', start: 0.1, end: 0.6 },
        { text: 'feature', start: 0.7, end: 1.2 },
      ],
      style: { rules: ['Entrances subtle by default'], profile: 'Tech channel.' },
      media: [{ file: 'logo.png', kind: 'image', width: 512, height: 512, description: 'the channel logo' }],
    });
    expect(intent).toMatch(/^STUDIO SHOT, 2\.4 s: A TITLE/);
    expect(intent).toContain('BRIEF: The phrase "AutoCut feature" lands word by word.');
    expect(intent).toContain('// WORDS — shot-local seconds, baked from the anchor span');
    expect(intent).toContain('{ text: "AutoCut", start: 0.1, end: 0.6 },');
    expect(intent).toContain('- Entrances subtle by default');
    expect(intent).toContain('Tech channel.');
    expect(intent).toContain("- logo.png (image, 512x512): the channel logo. <Img src={staticFile('logo.png')} />");
  });

  it('tells a cutaway to be opaque and an overlay to stay transparent', () => {
    expect(generateIntent({ kind: 'cutaway', brief: 'b', durationSeconds: 5 })).toMatch(/opaque background/);
    expect(generateIntent({ kind: 'overlay', brief: 'b', durationSeconds: 5 })).toMatch(/No background on the root/);
    expect(isTransparentKind('cutaway')).toBe(false);
    expect(isTransparentKind('overlay')).toBe(true);
    expect(isTransparentKind('title')).toBe(true);
  });
});

describe('edit and refine intents', () => {
  it('an edit is the instruction plus the shot contract, and asks for staticFile on the copied media', () => {
    const intent = editIntent({ kind: 'overlay', instruction: 'Make the badge amber.', media: [{ file: 'logo.png', kind: 'image' }] });
    expect(intent.split('\n')[0]).toBe('Make the badge amber.');
    expect(intent).toMatch(/Keep its compositionConfig values, any WORDS table verbatim, and its background rule/);
    expect(intent).toMatch(/switch those reads to staticFile/);
  });

  it('a refine keeps the old constraints but not "keep imports exactly"', () => {
    const intent = refineIntent({ kind: 'cutaway', brief: 'Three stat rows.', styleRules: ['No overshoot on text'] });
    expect(intent).toMatch(/^REFINE: look at this shot as it plays now/);
    expect(intent).toMatch(/Do not redesign it/);
    expect(intent).toMatch(/compositionConfig values/);
    expect(intent).toContain('Three stat rows.');
    expect(intent).toContain('- No overshoot on text');
    expect(intent).not.toMatch(/imports/i);
  });
});

describe('brandText', () => {
  const brand = {
    name: 'LWH',
    palette: { primary: '#111111', secondary: '#222222', background: '#000000', text: '#ffffff', accent: '#ffb000' },
    fonts: { display: 'Inter' },
    styleNotes: 'Calm.',
  } as StudioBrand;

  it('gives the palette, the fonts and the notes, with the background role by kind', () => {
    const cutaway = brandText(brand, 'cutaway');
    expect(cutaway).toContain('Primary #111111');
    expect(cutaway).toContain("Background #000000 (the cutaway's opaque background)");
    expect(cutaway).toContain('Display font (headings, numbers): "Inter". Body font: "Inter"');
    expect(cutaway).toContain('Style notes: Calm.');
    expect(brandText(brand, 'overlay')).toMatch(/reference only: this shot keeps its background transparent/);
  });
});

describe('shotBuildRequest', () => {
  it('is a build job with the pack, the format or the version to edit, and the files', () => {
    const pack = studioShotPack(null);
    const fresh = shotBuildRequest({
      prompt: 'p',
      budget: 'standard',
      pack,
      format: { width: 1920, height: 1080, fps: 30, durationInFrames: 150 },
      assets: [{ path: 'C:/m/logo.png', name: 'logo.png' }],
      threadText: 'the brief',
      providerId: 'claude-subscription',
      model: 'claude-sonnet-5-5',
    });
    expect(fresh).toEqual({
      kind: 'build',
      prompt: 'p',
      providerId: 'claude-subscription',
      options: { model: 'claude-sonnet-5-5' },
      build: {
        budget: 'standard',
        packs: [pack],
        format: { width: 1920, height: 1080, fps: 30, durationInFrames: 150 },
        assets: [{ path: 'C:/m/logo.png', name: 'logo.png' }],
        threadText: 'the brief',
      },
    });
    const edit = shotBuildRequest({ prompt: 'p', budget: 'quick', pack, editOf: { folderPath: 'F', version: 2 } });
    expect(edit.build).toEqual({ budget: 'quick', packs: [pack], editOf: { folderPath: 'F', version: 2 } });
  });
});
