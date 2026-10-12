import { describe, expect, it } from 'vitest';
import { createFrameSim, seededRandom, type SimulationSpec } from './vidtsx-sim';

/** A falling point with a bounce: enough state that a wrong step count shows. */
interface Ball {
  y: number;
  v: number;
  steps: number;
  frames: number[];
}

const fall = (extra: Partial<SimulationSpec<Ball, { y: number; steps: number }>> = {}) => {
  const spec: SimulationSpec<Ball, { y: number; steps: number }> = {
    id: 'fall',
    setup: () => ({ y: 10, v: 0, steps: 0, frames: [] }),
    step: (b, { dt, frame }) => {
      b.v -= 9.81 * dt;
      b.y += b.v * dt;
      if (b.y < 0) {
        b.y = -b.y;
        b.v = -b.v * 0.6;
      }
      b.steps += 1;
      b.frames.push(frame);
    },
    read: (b) => ({ y: b.y, steps: b.steps }),
    ...extra,
  };
  return spec;
};

describe('createFrameSim', () => {
  it('gives frame N the same read-out whatever order the frames are asked in', () => {
    const inOrder = createFrameSim(fall(), 30);
    const expected = Array.from({ length: 90 }, (_, f) => inOrder.at(f));
    const shuffled = createFrameSim(fall(), 30);
    for (const f of [89, 3, 47, 0, 88, 12, 60]) expect(shuffled.at(f)).toEqual(expected[f]);
    // Fresh worlds (separate pages) agree too.
    expect(createFrameSim(fall(), 30).at(60)).toEqual(expected[60]);
  });

  it('steps forward only: frame N+1 costs one step, an earlier frame none', () => {
    const sim = createFrameSim(fall(), 30);
    expect(sim.at(40).steps).toBe(40);
    expect(sim.stepped).toBe(40);
    expect(sim.at(41).steps).toBe(41);
    expect(sim.at(5).steps).toBe(5);
    expect(sim.stepped).toBe(41);
  });

  it('takes `substeps` fixed steps per frame at dt = 1 / fps / substeps, told which frame they reach', () => {
    let seenDt = 0;
    const frames: number[] = [];
    const sim = createFrameSim(
      fall({
        substeps: 3,
        setup: ({ dt }) => {
          seenDt = dt;
          return { y: 10, v: 0, steps: 0, frames };
        },
      }),
      30,
    );
    expect(sim.at(2).steps).toBe(6);
    expect(seenDt).toBeCloseTo(1 / 90, 12);
    expect(frames).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it('frame 0 is the world as set up, before any step', () => {
    expect(createFrameSim(fall(), 30).at(0)).toEqual({ y: 10, steps: 0 });
  });

  it('hands out a seeded random: the same world in every page, another seed another world', () => {
    const scatter = (seed?: number) =>
      createFrameSim(
        {
          id: 'scatter',
          seed,
          setup: ({ random }) => ({ xs: Array.from({ length: 5 }, () => random()) }),
          step: (w, { random }) => {
            w.xs = w.xs.map((x) => x + random() * 0.01);
          },
          read: (w) => w.xs.slice(),
        },
        30,
      );
    expect(scatter().at(20)).toEqual(scatter().at(20));
    expect(scatter(7).at(20)).toEqual(scatter(7).at(20));
    expect(scatter(7).at(20)).not.toEqual(scatter().at(20));
  });

  it('keeps a copy of each read-out, so stepping on cannot change a kept frame', () => {
    const sim = createFrameSim(
      {
        id: 'shared-object',
        setup: () => ({ position: { x: 0 } }),
        step: (w) => {
          w.position.x += 1; // mutated in place, as matter-js and cannon-es do
        },
        read: (w) => w.position,
      },
      30,
    );
    const early = sim.at(3);
    sim.at(30);
    expect(early).toEqual({ x: 3 });
    expect(sim.at(3)).toEqual({ x: 3 });
  });

  it('refuses a read-out that is not plain data, naming the simulation', () => {
    expect(() =>
      createFrameSim({ id: 'fn', setup: () => ({}), step: () => {}, read: () => ({ draw: () => 1 }) }, 30),
    ).toThrow(/@vidtsx\/sim "fn": read\(\) must return plain data/);
  });

  it('a step that throws breaks the simulation for every later frame, not just once', () => {
    const sim = createFrameSim(
      {
        id: 'boom',
        setup: () => ({ n: 0 }),
        step: (w) => {
          w.n += 1;
          if (w.n === 5) throw new Error('engine panic');
        },
        read: (w) => w.n,
      },
      30,
    );
    expect(sim.at(3)).toBe(3);
    expect(() => sim.at(10)).toThrow('engine panic');
    expect(() => sim.at(10)).toThrow('engine panic');
    expect(sim.at(4)).toBe(4);
  });
});

describe('seededRandom', () => {
  it('is in [0, 1) and repeats for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      expect(b()).toBe(x);
    }
  });
});
