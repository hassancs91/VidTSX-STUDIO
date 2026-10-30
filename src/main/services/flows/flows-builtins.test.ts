// The six built-in flow fixtures (flows plan §1.7, W8 Stage 3), validated
// structurally and against the REAL registry: every tool id exists and has
// ports, every edge lands on a declared port of a compatible type, every
// required input is fed, every config key is one the tool's schema takes,
// every param binds to a config key, and the outputs name real ports. The
// thumbnail flow carries the hub's locked system prompt verbatim; product-ad
// is ONE `generate_image` with three variations and a pause (Stage 2's note).
// W8 Stage 6: each fixture is also a package manifest — it loads through the
// store as a read-only built-in, `requires` matches the graph and the
// registry's gates, and the folder is what the installer ships. The interior
// staging reel (2.0) chains every edit from one vertical still so its clips'
// start and end frames line up.

import { describe, it, expect, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false, getAppPath: () => 'C:/tmp', getVersion: () => '1.1.0' },
}));

import type { FlowDoc } from '../../../shared/types/flows';
import { validateFlowDoc } from '../../../shared/flows/validate';
import { flowDocOf, parseFlowPackageManifest } from '../../../shared/flows/flow-package';
import { THUMBNAIL_SYSTEM_PROMPT } from '../../../shared/prompts/thumbnail-system-prompt';
import { getDefaultProviderModels } from '../../../shared/presets/provider-model-defaults';
import { FAL_VIDEO_MODELS } from '../../../shared/presets/video-model-entries';
import { getNode, listToolIds } from '../agents/tools/registry';
import { validateFlowForRun } from './flow-validate';
import { readFlowFolder, scanFlows } from './flow-store';

const ALL = { imageProvider: true, videoProvider: true, audioProvider: true };
const NAMES = ['thumbnail', 'frame-strip', 'explainer-30s', 'product-ad', 'add-effect', 'interior-staging'] as const;
const ROOT = path.resolve(__dirname, '../../../../resources/flows/vidtsx');
const VERSIONS: Record<(typeof NAMES)[number], string> = {
  thumbnail: '1.0.0', 'frame-strip': '1.0.0', 'explainer-30s': '1.1.0', 'product-ad': '1.1.0', 'add-effect': '1.0.0',
  'interior-staging': '1.0.0',
};

async function load(name: string): Promise<FlowDoc> {
  // The document half of the package manifest (Stage 6) — what the runner sees.
  const raw = JSON.parse(await fs.readFile(path.join(ROOT, name, 'flow.json'), 'utf-8')) as unknown;
  return flowDocOf(parseFlowPackageManifest(raw));
}

describe('built-in flow fixtures', () => {
  it.each(NAMES)('%s is a valid FlowDoc that the runner would start', async (name) => {
    const doc = await load(name);
    expect(doc.formatVersion).toBe(2);
    expect(doc.id).toBe(`vidtsx/${name}`);
    expect(validateFlowDoc(doc, { requireNodes: true })).toMatchObject({ ok: true });
    const run = validateFlowForRun(doc, { getNode }, ALL);
    expect(run, JSON.stringify(run)).toMatchObject({ ok: true });
  });

  it.each(NAMES)('%s uses only config keys, ports and outputs the registry declares', async (name) => {
    const doc = await load(name);
    for (const node of doc.graph.nodes) {
      const def = getNode(node.toolId);
      expect(def?.ports, node.toolId).toBeDefined();
      const keys = new Set(Object.keys(def!.schema));
      for (const key of Object.keys(node.config)) expect(keys, `${name}/${node.id}.${key}`).toContain(key);
      // The config must validate as stored — a key the schema strips would silently do nothing.
      const parsed = z.object(def!.schema).partial().safeParse(node.config);
      expect(parsed.success, `${name}/${node.id}: ${JSON.stringify(parsed.success ? '' : parsed.error.issues)}`).toBe(true);
    }
    for (const param of doc.params) {
      expect(param.bind.length).toBeGreaterThan(0);
      for (const bind of param.bind) {
        const node = doc.graph.nodes.find((n) => n.id === bind.nodeId);
        expect(node, `${name}/${param.id} → ${bind.nodeId}`).toBeDefined();
        expect(Object.keys(getNode(node!.toolId)!.schema), `${name}/${param.id}.${bind.key}`).toContain(bind.key);
      }
    }
    for (const output of doc.outputs) {
      const node = doc.graph.nodes.find((n) => n.id === output.nodeId);
      const port = getNode(node!.toolId)?.ports?.outputs.find((p) => p.id === output.handle);
      expect(port, `${name} output ${output.nodeId}.${output.handle}`).toBeDefined();
    }
  });

  it('thumbnail carries the Thumbnail Generator system prompt verbatim and extracts the first prompt', async () => {
    const doc = await load('thumbnail');
    const ideas = doc.graph.nodes.find((n) => n.toolId === 'generate_text');
    expect(ideas?.config.systemPrompt).toBe(THUMBNAIL_SYSTEM_PROMPT);
    expect(ideas?.config.extract).toBe('first-json-item');
    expect(doc.params.map((p) => p.id)).toEqual(['topic', 'count']);
    expect(doc.outputs).toEqual([{ nodeId: 'n-image', handle: 'image', label: 'Thumbnail' }]);
  });

  it('product-ad is one generate_image with count 3 and a pause, then video → composition → render', async () => {
    const doc = await load('product-ad');
    const images = doc.graph.nodes.filter((n) => n.toolId === 'generate_image');
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ config: { count: 3 }, pause: true });
    expect(doc.graph.nodes.map((n) => n.toolId)).toEqual([
      'input_image_file', 'input_text', 'generate_image', 'generate_video', 'generate_composition', 'render_composition',
    ]);
    expect(doc.params.find((p) => p.id === 'product')?.kind).toBe('image');
    // The clip feeds the composition's video port — the Stage 3 media convention.
    expect(doc.graph.edges).toContainEqual(expect.objectContaining({ source: 'n-clip', sourceHandle: 'video', target: 'n-compose', targetHandle: 'video' }));
  });

  it.each(NAMES)('%s is a package manifest the store reads as a read-only built-in (Stage 6)', async (name) => {
    const flow = await readFlowFolder(path.join(ROOT, name), 'builtin', { manifestContext: { appVersion: '1.1.0', toolIds: listToolIds() } });
    expect(flow, name).not.toBeNull();
    expect(flow!.origin).toBe('builtin');
    expect(flow!.manifest.version).toBe(VERSIONS[name]);
    expect(flow!.manifest.author.name).toBe('VidTSX');
    expect(flow!.manifest.minAppVersion).toBe('1.1.0');
    expect(flow!.manifest.files).toEqual([]);
    // Every built-in is signed (the first five as vidtsx-1, 38e067e): an edited
    // flow.json must be re-signed in the same commit, or the store skips the
    // folder (null above). interior-staging stays red here until Hasan signs it.
    expect(flow!.signature).toBe('verified');
    // `requires` is what the packer writes: the graph's tools, and the gates those tools carry.
    const doc = flowDocOf(flow!.manifest);
    const tools = [...new Set(doc.graph.nodes.map((n) => n.toolId))];
    expect(flow!.manifest.requires.tools).toEqual(tools);
    const gates = [...new Set(tools.map((t) => getNode(t)?.needs).filter((n): n is NonNullable<typeof n> => Boolean(n)))];
    expect(flow!.manifest.requires.capabilities).toEqual(gates);
  });

  it('the built-in root scans to exactly the six, sorted by name', async () => {
    const flows = await scanFlows(
      { manifestContext: { appVersion: '1.1.0', toolIds: listToolIds() } },
      { userDir: path.join(ROOT, '..', '..', 'no-such-user-root'), builtinDir: path.resolve(ROOT, '..') },
    );
    expect(flows.map((f) => f.manifest.id).sort()).toEqual([
      'vidtsx/add-effect', 'vidtsx/explainer-30s', 'vidtsx/frame-strip', 'vidtsx/interior-staging', 'vidtsx/product-ad', 'vidtsx/thumbnail',
    ]);
    expect(flows.every((f) => f.origin === 'builtin')).toBe(true);
  });

  it('frame-strip and add-effect take a video param bound to the file input, explainer pauses on the composition', async () => {
    const strip = await load('frame-strip');
    expect(strip.params[0]).toMatchObject({ kind: 'video', bind: [{ nodeId: 'n-video', key: 'filePath' }] });
    expect(strip.outputs[0]).toMatchObject({ handle: 'images' });
    const effect = await load('add-effect');
    expect(effect.graph.nodes.map((n) => n.toolId)).toEqual(['input_video_file', 'input_text', 'extract_frame', 'generate_image', 'generate_video']);
    const explainer = await load('explainer-30s');
    expect(explainer.graph.nodes.find((n) => n.toolId === 'generate_composition')?.pause).toBe(true);
    expect(explainer.graph.nodes.find((n) => n.toolId === 'generate_composition')?.config.durationSeconds).toBe(30);
  });

  it('interior-staging: three paused edits of one vertical still, two fal clips on them, joined staging then glide', async () => {
    const doc = await load('interior-staging');
    const node = (id: string) => doc.graph.nodes.find((n) => n.id === id);
    const into = (target: string, handle: string) =>
      doc.graph.edges.filter((e) => e.target === target && e.targetHandle === handle).map((e) => e.source);

    // Both edits are OF the vertical still, through sourceImage only: fed
    // references would win and the source would be dropped.
    expect(into('n-vertical', 'sourceImage')).toEqual(['n-photo']);
    expect(into('n-empty', 'sourceImage')).toEqual(['n-vertical']);
    expect(into('n-golden', 'sourceImage')).toEqual(['n-vertical']);
    expect(doc.graph.edges.filter((e) => e.targetHandle === 'referenceImages')).toEqual([]);
    // Staging runs empty → furnished; the glide starts on the golden still.
    expect(into('n-staging', 'firstFrame')).toEqual(['n-empty']);
    expect(into('n-staging', 'lastFrame')).toEqual(['n-vertical']);
    expect(into('n-glide', 'firstFrame')).toEqual(['n-golden']);
    expect(into('n-glide', 'lastFrame')).toEqual([]);
    // Edge order is clip order.
    expect(into('n-join', 'videos')).toEqual(['n-staging', 'n-glide']);
    expect(node('n-join')?.config).toMatchObject({ transition: 'dip-to-black', width: 1080, height: 1920, fps: 24 });

    const images = doc.graph.nodes.filter((n) => n.toolId === 'generate_image');
    const videos = doc.graph.nodes.filter((n) => n.toolId === 'generate_video');
    expect(images.map((n) => n.id)).toEqual(['n-vertical', 'n-empty', 'n-golden']);
    expect(videos.map((n) => n.id)).toEqual(['n-staging', 'n-glide']);
    // 1440x2560: Seedream 4.5 edit refuses anything smaller than 2560*1440.
    for (const n of images) expect(n, n.id).toMatchObject({ pause: true, config: { providerId: 'fal', width: 1440, height: 2560 } });
    // resolution '' lets each model use its own default (Seedance at 1080p would cost ~2x).
    for (const n of videos) expect(n, n.id).toMatchObject({ pause: false, config: { providerId: 'fal', resolution: '' } });

    // The runner's order: all three stills (and their checkpoints) before the first paid clip.
    const run = validateFlowForRun(doc, { getNode }, ALL);
    if (!run.ok) throw new Error(JSON.stringify(run));
    const lastImage = Math.max(...images.map((n) => run.order.indexOf(n.id)));
    const firstVideo = Math.min(...videos.map((n) => run.order.indexOf(n.id)));
    expect(lastImage).toBeLessThan(firstVideo);

    // The model selects offer only what the shipped fal catalogs list, and
    // their default is what the graph stores on every node they bind.
    const catalogs = {
      imageModel: getDefaultProviderModels('fal', 'image').map((m) => m.id),
      videoModel: FAL_VIDEO_MODELS.map((m) => m.id),
    };
    const expected = {
      imageModel: { values: ['nano-banana-pro', 'seedream-v4.5'], nodes: ['n-vertical', 'n-empty', 'n-golden'] },
      videoModel: { values: ['kling-3-pro', 'kling-4', 'kling-2.5-turbo-pro', 'seedance-2.0'], nodes: ['n-staging', 'n-glide'] },
    };
    for (const id of ['imageModel', 'videoModel'] as const) {
      const param = doc.params.find((p) => p.id === id);
      const values = param?.options?.map((o) => (typeof o === 'string' ? o : o.value));
      expect(param?.kind).toBe('select');
      expect(values).toEqual(expected[id].values);
      for (const value of values ?? []) expect(catalogs[id], `${id}: ${value}`).toContain(value);
      expect(param?.default).toBe(expected[id].values[0]);
      expect(param?.bind).toEqual(expected[id].nodes.map((nodeId) => ({ nodeId, key: 'model' })));
      for (const nodeId of expected[id].nodes) expect(node(nodeId)?.config.model, nodeId).toBe(param?.default);
    }
    expect(doc.params.find((p) => p.id === 'photo')).toMatchObject({ kind: 'image', required: true, bind: [{ nodeId: 'n-photo', key: 'filePath' }] });
    expect(doc.outputs).toEqual([{ nodeId: 'n-join', handle: 'video', label: 'Reel' }]);
  });

  it.each(['explainer-30s', 'product-ad'] as const)('%s: the TSX node at Standard, no loop, no generated images; Budget on the run form (P3 part 7)', async (name) => {
    const doc = await load(name);
    const compose = doc.graph.nodes.find((n) => n.toolId === 'generate_composition');
    expect(compose?.config).toMatchObject({ budget: 'standard', loop: 'off', generatedImages: 'off' });
    const budget = doc.params.find((p) => p.id === 'budget');
    expect(budget).toMatchObject({ kind: 'select', default: 'standard', bind: [{ nodeId: compose?.id, key: 'budget' }] });
    expect(budget?.options?.map((o) => (typeof o === 'string' ? o : o.value))).toEqual(['quick', 'standard', 'craft']);
  });
});
