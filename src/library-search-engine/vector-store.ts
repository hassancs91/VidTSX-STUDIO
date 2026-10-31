// The vector cache file (LIBRARY_SEARCH_DESIGN.md §5): `<library root>/.vidtsx/search/vectors-<modelId>.json`,
// `{ version: 1, modelId, dims, pooling: 'mean', prefixVersion, items: { [relPath]: { textHash, v: <base64 Float32> } } }`.
// Keyed by relPath + textHash (+ the model id in the file name / header). Any header mismatch, or a corrupt file,
// starts empty — it is rebuilt, never trusted. Saves are atomic (`.tmp` + rename) and serialised. Lives in the
// engine child only: the floats never enter main.

import fs from 'node:fs/promises';
import path from 'node:path';
import type { EngineItem, EngineRanked, EngineVectors } from './types';

export const VECTOR_FILE_VERSION = 1;

export interface VectorHeaderExpect {
  modelId: string;
  pooling: 'mean';
  prefixVersion: number;
}

interface VectorFileShape {
  version: number;
  modelId: string;
  dims: number;
  pooling: string;
  prefixVersion: number;
  items: Record<string, { textHash: string; v: string }>;
}

interface Stored {
  textHash: string;
  v: Float32Array;
}

export type RebuildReason = 'missing' | 'corrupt' | 'header mismatch';

export function vectorFilePath(libraryRoot: string, modelId: string): string {
  return path.join(libraryRoot, '.vidtsx', 'search', `vectors-${modelId}.json`);
}

const encode = (v: Float32Array): string => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');

function decode(b64: string): Float32Array {
  const bytes = Uint8Array.from(Buffer.from(b64, 'base64'));
  return new Float32Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 4));
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}

function parse(raw: string, expect: VectorHeaderExpect): { items: Map<string, Stored>; dims: number } | RebuildReason {
  let file: VectorFileShape;
  try {
    file = JSON.parse(raw) as VectorFileShape;
  } catch {
    return 'corrupt';
  }
  if (!file || typeof file !== 'object' || typeof file.items !== 'object' || file.items === null) return 'corrupt';
  if (file.version !== VECTOR_FILE_VERSION || file.modelId !== expect.modelId || file.pooling !== expect.pooling
    || file.prefixVersion !== expect.prefixVersion || !Number.isInteger(file.dims) || file.dims <= 0) return 'header mismatch';
  const items = new Map<string, Stored>();
  for (const [relPath, e] of Object.entries(file.items)) {
    if (!e || typeof e.textHash !== 'string' || typeof e.v !== 'string') return 'corrupt';
    const v = decode(e.v);
    if (v.length !== file.dims) return 'corrupt';
    items.set(relPath, { textHash: e.textHash, v });
  }
  return { items, dims: file.dims };
}

export class VectorStore {
  private dirty = false;
  private saving: Promise<void> = Promise.resolve();

  private constructor(
    readonly file: string,
    private readonly expect: VectorHeaderExpect,
    private items: Map<string, Stored>,
    private dims: number,
    /** Why the store started empty (null = the file was read as is). */
    readonly rebuiltBecause: RebuildReason | null,
  ) {}

  static async open(file: string, expect: VectorHeaderExpect): Promise<VectorStore> {
    let raw: string;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch {
      return new VectorStore(file, expect, new Map(), 0, 'missing');
    }
    const parsed = parse(raw, expect);
    if (typeof parsed === 'string') return new VectorStore(file, expect, new Map(), 0, parsed);
    return new VectorStore(file, expect, parsed.items, parsed.dims, null);
  }

  get size(): number {
    return this.items.size;
  }

  /** The model's vector length: the first one fixes the file's dims; another length clears every vector. */
  adopt(dims: number): void {
    if (this.dims === dims) return;
    if (this.items.size > 0) this.dirty = true;
    this.items = new Map();
    this.dims = dims;
  }

  has(item: EngineItem): boolean {
    return this.items.get(item.relPath)?.textHash === item.textHash;
  }

  missing(items: EngineItem[]): EngineItem[] {
    return items.filter((it) => !this.has(it));
  }

  vectorOf(relPath: string): Float32Array | undefined {
    return this.items.get(relPath)?.v;
  }

  put(relPath: string, textHash: string, v: Float32Array): void {
    if (this.dims === 0) this.dims = v.length;
    if (v.length !== this.dims) throw new Error(`vector dims ${v.length} ≠ the file's ${this.dims}`);
    this.items.set(relPath, { textHash, v });
    this.dirty = true;
  }

  /** Drops every entry whose relPath is not kept (a deleted library entry); returns how many went. */
  prune(keep: Set<string>): number {
    let dropped = 0;
    for (const relPath of [...this.items.keys()]) {
      if (!keep.has(relPath)) {
        this.items.delete(relPath);
        dropped += 1;
      }
    }
    if (dropped > 0) this.dirty = true;
    return dropped;
  }

  /** Cosine over the items that have a vector at their textHash, best first (ties keep the items' order). */
  rank(query: Float32Array, items: EngineItem[]): { ranked: EngineRanked[]; vectors: EngineVectors } {
    const ranked: EngineRanked[] = [];
    for (const it of items) {
      const stored = this.items.get(it.relPath);
      if (stored && stored.textHash === it.textHash) ranked.push({ relPath: it.relPath, cosine: cosine(query, stored.v) });
    }
    ranked.sort((a, b) => b.cosine - a.cosine);
    return { ranked, vectors: { ready: ranked.length, total: items.length } };
  }

  /** Atomic write (`.tmp` + rename) when anything changed; concurrent calls run one after the other. */
  async save(): Promise<void> {
    this.saving = this.saving.then(() => this.writeNow(), () => this.writeNow());
    return this.saving;
  }

  private async writeNow(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    const items: VectorFileShape['items'] = {};
    for (const [relPath, s] of this.items) items[relPath] = { textHash: s.textHash, v: encode(s.v) };
    const body: VectorFileShape = { version: VECTOR_FILE_VERSION, modelId: this.expect.modelId, dims: this.dims, pooling: this.expect.pooling, prefixVersion: this.expect.prefixVersion, items };
    const tmp = `${this.file}.tmp`;
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(tmp, JSON.stringify(body), 'utf8');
      await fs.rename(tmp, this.file);
    } catch (err) {
      this.dirty = true;
      throw err;
    }
  }
}
