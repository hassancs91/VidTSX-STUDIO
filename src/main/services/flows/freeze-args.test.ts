// The inverse of `flow-args` (W8 Stage 5): a recorded call's arguments read
// back through the ports — artifact ids become edges on the port whose
// `argKey` is that key, everything else is config.
import { describe, it, expect } from 'vitest';
import type { ToolPorts } from '../../../shared/types/flows';
import { artifactRefsIn, classifyCallArgs, configKeyForPort, inputPortForKey, outputPortFor, outputPortForKind } from './freeze-args';

const compose: Pick<ToolPorts, 'inputs' | 'outputs'> = {
  inputs: [
    { id: 'brief', label: 'Brief', dataType: 'text', required: true, argKey: 'brief' },
    { id: 'image', label: 'Image', dataType: 'image', argKey: 'referenceImage' },
    { id: 'video', label: 'Video', dataType: 'video', argKey: 'referenceVideo' },
  ],
  outputs: [{ id: 'composition', label: 'Composition', dataType: 'composition', from: 'artifact' }],
};
const image: Pick<ToolPorts, 'inputs' | 'outputs'> = {
  inputs: [
    { id: 'prompt', label: 'Prompt', dataType: 'text', required: true, argKey: 'prompt' },
    { id: 'referenceImages', label: 'References', dataType: 'images', argKey: 'referenceImages' },
  ],
  outputs: [{ id: 'image', label: 'Image', dataType: 'image', from: 'artifact' }],
};
const isId = (id: string) => /^(image-set|video|composition|document)-\d+$/.test(id);

describe('inverse port mapping', () => {
  it('finds the port for an argument key through argKey, falling back to the id', () => {
    expect(inputPortForKey(compose, 'referenceImage')?.id).toBe('image');
    expect(inputPortForKey(compose, 'brief')?.id).toBe('brief');
    expect(inputPortForKey(compose, 'nope')).toBeUndefined();
    expect(configKeyForPort({ id: 'x', label: 'x', dataType: 'text' })).toBe('x');
  });

  it('splits artifact references from literals, arrays included', () => {
    const out = classifyCallArgs(compose, { title: 'Reel', brief: 'Beats', width: 1080, referenceImage: 'image-set-2', referenceVideo: 'video-1', notes: 'video-x' }, isId);
    expect(out.config).toEqual({ title: 'Reel', brief: 'Beats', width: 1080, notes: 'video-x' });
    expect(out.edges.map((e) => [e.port.id, e.artifactIds])).toEqual([['image', ['image-set-2']], ['video', ['video-1']]]);
    expect(out.unwired).toEqual([]);
    const many = classifyCallArgs(image, { prompt: 'p', referenceImages: ['image-set-1', 'image-set-3'], tags: ['image-set-1', 'not-an-id'] }, isId);
    expect(many.edges.map((e) => [e.port.id, e.artifactIds])).toEqual([['referenceImages', ['image-set-1', 'image-set-3']]]);
    expect(many.config.tags).toEqual(['image-set-1', 'not-an-id']);
  });

  it('reports an artifact on a key no port takes, and lists every reference in order', () => {
    const out = classifyCallArgs(compose, { brief: 'x', extra: 'composition-4' }, isId);
    expect(out.unwired).toEqual([{ key: 'extra', artifactIds: ['composition-4'] }]);
    expect(artifactRefsIn({ a: 'video-1', b: ['image-set-1', 'image-set-1'], c: 'text', d: 2 }, isId)).toEqual(['video-1', 'image-set-1']);
  });

  it('picks the source output port by kind and compatibility, or by primitive type', () => {
    expect(outputPortFor(image, 'image-set', 'images')?.id).toBe('image');
    expect(outputPortFor(image, 'image-set', 'video')).toBeUndefined();
    expect(outputPortFor(compose, 'composition', 'composition')?.id).toBe('composition');
    const text = { outputs: [{ id: 'text', label: 'Text', dataType: 'text' as const, from: 'field:text' as const }] };
    expect(outputPortFor(text, 'document', 'text')?.id).toBe('text');
    expect(outputPortForKind(image, 'image-set')?.id).toBe('image');
    expect(outputPortForKind(image, 'video')).toBeUndefined();
  });
});
