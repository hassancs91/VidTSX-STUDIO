// `@vidtsx/sim`: frame-pure simulation for builder artifacts (TSX_BUILDER_DESIGN.md
// P2 part 3).
//
// Remotion renders frames out of order and in parallel tabs, and a still is one
// frame in a fresh page. A physics world stepped "once per render" therefore
// shows one picture in the preview, another in a still and another in each
// export tab. This module is the one way a builder piece steps a simulation: the
// world is built once per page and stepped at a FIXED dt from frame 0, and every
// frame's read-out is copied and kept, so frame N+1 costs one step from N and
// any earlier frame is a lookup. Frame N is always the result of the same N
// steps, however the frames are ordered or split.
//
// It never rewinds a world: cannon-es, matter-js and planck cannot restore a
// snapshot exactly (contact caches, warm starting, sleep timers), so a replay
// from a restored state could drift from the straight run. Keeping each
// frame's read-out instead costs memory in proportion to what `read` returns,
// which is why `read` returns plain numbers, not bodies.
//
// The bundle step (main/services/studio/shot-bundle.ts) inlines this file
// wherever an artifact imports '@vidtsx/sim', so it ships inside the one file
// like a library. It imports only react and remotion (the artifact's
// externals) and no engine: the piece brings its own (Rapier, cannon-es,
// matter-js, planck, a d3-force simulation).

import { useEffect, useReducer } from 'react';
import { cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';

export interface SimSetup {
  /** Seconds per fixed step: 1 / fps / substeps. */
  dt: number;
  /** Seeded 0-1 random: the same sequence in every page. Never Math.random. */
  random: () => number;
}

export interface SimTick extends SimSetup {
  /** The frame this step arrives at (1 for the first step). */
  frame: number;
  /** 0 .. substeps-1 within that frame. */
  substep: number;
}

export interface SimulationSpec<W, T> {
  /** Names this simulation: two simulations in one piece need two ids. */
  id: string;
  /** Builds the world, once per page. */
  setup: (s: SimSetup) => W;
  /**
   * Advances the world by exactly `dt` seconds: one fixed step of the engine.
   * Runs `substeps` times per frame with the same `frame`: a one-off (spawn,
   * impulse) belongs on `substep === 0`.
   */
  step: (world: W, t: SimTick) => void;
  /** What a frame draws, as plain data (numbers, arrays, objects). It is copied and kept. */
  read: (world: W, frame: number) => T;
  /** Fixed steps per frame (default 1). */
  substeps?: number;
  /** Seed for `random` (default 1). */
  seed?: number;
  /** Values `setup` reads besides constants (props, sizes, counts), JSON-able: a change builds a new world. */
  deps?: readonly unknown[];
  /** Async engine start, e.g. `() => RAPIER.init()`. Frames wait for it. */
  init?: () => Promise<unknown>;
}

/** mulberry32: small, fast, and the same sequence for the same seed everywhere. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function keep<T>(value: T, id: string, frame: number): T {
  try {
    return structuredClone(value);
  } catch (err) {
    throw new Error(
      `@vidtsx/sim "${id}": read() must return plain data (numbers, strings, arrays, plain objects); it is copied and kept for every frame. Frame ${frame}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export interface FrameSim<T> {
  /** The read-out of `frame`, stepping forward from the last kept frame when needed. */
  at(frame: number): T;
  /** Frames stepped so far (the last kept frame). */
  readonly stepped: number;
}

/** The pure core: one world, stepped forward only, every frame's read-out kept. */
export function createFrameSim<W, T>(spec: SimulationSpec<W, T>, fps: number): FrameSim<T> {
  const substeps = Math.max(1, Math.round(spec.substeps ?? 1));
  const dt = 1 / fps / substeps;
  const random = seededRandom(spec.seed ?? 1);
  const world = spec.setup({ dt, random });
  const frames: T[] = [keep(spec.read(world, 0), spec.id, 0)];
  let broken: unknown = null;
  return {
    at(frame: number): T {
      const target = Math.max(0, Math.floor(frame));
      if (target < frames.length) return frames[target];
      // A step that threw left the world half-stepped: every later frame would be wrong.
      if (broken) throw broken;
      try {
        while (frames.length <= target) {
          const next = frames.length;
          for (let substep = 0; substep < substeps; substep++) spec.step(world, { dt, random, frame: next, substep });
          frames.push(keep(spec.read(world, next), spec.id, next));
        }
      } catch (err) {
        broken = err;
        throw err;
      }
      return frames[target];
    },
    get stepped() {
      return frames.length - 1;
    },
  };
}

interface SimEntry {
  sim: FrameSim<unknown> | null;
  error: unknown;
  /** Re-render hooks waiting for an async init. */
  waiters: Set<() => void>;
}

/** Simulations kept per page, most recently used last. */
const MAX_SIMS = 16;
const registry = new Map<string, SimEntry>();

function simKey(spec: SimulationSpec<unknown, unknown>, fps: number): string {
  return JSON.stringify([spec.id, fps, spec.substeps ?? 1, spec.seed ?? 1, spec.deps ?? []]);
}

function entryFor<W, T>(spec: SimulationSpec<W, T>, fps: number): SimEntry {
  const key = simKey(spec as SimulationSpec<unknown, unknown>, fps);
  const found = registry.get(key);
  if (found) {
    registry.delete(key);
    registry.set(key, found);
    return found;
  }
  const entry: SimEntry = { sim: null, error: null, waiters: new Set() };
  if (spec.init) {
    // Held per simulation, not per component: a frame never renders before the engine starts.
    const handle = delayRender(`@vidtsx/sim "${spec.id}": init`);
    const init = spec.init;
    Promise.resolve()
      .then(() => init())
      .then(() => {
        entry.sim = createFrameSim(spec, fps) as FrameSim<unknown>;
      })
      .catch((err: unknown) => {
        entry.error = err;
        cancelRender(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        continueRender(handle);
        for (const wake of entry.waiters) wake();
      });
  } else {
    entry.sim = createFrameSim(spec, fps) as FrameSim<unknown>;
  }
  registry.set(key, entry);
  while (registry.size > MAX_SIMS) registry.delete(registry.keys().next().value as string);
  return entry;
}

/**
 * The read-out of the current frame. `null` only while `init` runs (the frame
 * waits for it, so a rendered frame never sees it).
 */
export function useSimulation<W, T>(spec: SimulationSpec<W, T>): T | null {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entry = entryFor(spec, fps);
  const [, wake] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (entry.sim || entry.error) return undefined;
    const waiter = () => wake();
    entry.waiters.add(waiter);
    // init may have settled between this render and the effect.
    if (entry.sim || entry.error) wake();
    return () => {
      entry.waiters.delete(waiter);
    };
  }, [entry]);
  if (entry.error) throw entry.error;
  return entry.sim ? (entry.sim.at(frame) as T) : null;
}
