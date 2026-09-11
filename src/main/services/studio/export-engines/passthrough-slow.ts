/**
 * Slow motion (rate < 1) for the passthrough engine — the Stage 4 item
 * measured and built 2026-09-11 (docs/export-engines-plan.md, Stage 4 log,
 * "Slow motion"). Pure builders; `copySpanArgs` calls them for a span whose
 * rate is under 1.
 *
 * What Remotion does (measured on `t5-1080p-cut-slow4`, 0.25×, and read in
 * the compositor at v4.0.435): output slot m of a slow clip asks for the media
 * time `interpolate(startFrom + m, [-1, S, S+1], [-1, S, S+rate]) / fps`
 * (`get-current-time.js`), the compositor turns it into INTEGER ticks of the
 * stream's time base by truncation (`ffmpeg.rs` calc_position) and shows the
 * cached frame nearest to that tick, ties to the later pts (`frame_cache.rs`
 * get_item_id); a source frame that is the nearest for several slots is shown
 * on each of them (K 899, 900, 900, 901, 901 … at 0.25×; three slots on K 1000
 * where the slot times pass a half-frame tie by one tick). Slot 0 of a clip
 * that OPENS its file shows the ceil frame as at every rate (T1 leg 3); that
 * frame is produced by the engine as its own one-frame piece, so the recipe
 * here is the nearest rule alone.
 *
 * The copy recipe (prototyped as `.vidtsx-temp/bench/open/slow/proto.sh` A):
 * `select` keeps a source frame K iff it is the frame some slot asks for,
 * `setpts` puts it on the FIRST of its slots, and the `fps` filter fills the
 * slots between two kept frames with the earlier one — the right frame, where
 * `-fps_mode cfr` alone fills a one-slot gap with the LATER frame (measured:
 * prototype B showed K 901 on slot 2 where Remotion shows 900). The
 * arithmetic mirrors the renderer's op for op — the interpolate multiplier is
 * `(S + rate) − S` as JS computes it, the ticks are `trunc(time·den/num)` — so
 * a one-tick near-tie resolves as the compositor resolves it (the real-valued
 * nearest, the rule of the rate ≥ 1 select, differs from it on 0.04 % of slots
 * at rates like 0.1). Each frame's first slot is found from a real-valued
 * estimate checked against the exact rule on three candidate slots.
 */
import type { FrameRate } from './passthrough-ffmpeg';

export interface SlowSpanOptions {
  /** The clip's trimBefore in composition frames — Remotion's `startFrom`, whole. */
  trimBefore: number;
  /** Slots into the clip at the span's first frame, whole (a span may start after an overlay). */
  clipOffset: number;
  /** 0 < rate < 1. */
  rate: number;
  fps: number;
  sourceFrameRate: FrameRate;
  /** The source stream's time base as num/den (1/60000 on the DJI files). */
  timeBase: FrameRate;
}

/** One source frame in the stream's ticks, or null when it is not whole (the tick rule needs integers). */
export function ticksPerFrame(timeBase: FrameRate, frameRate: FrameRate): number | null {
  const ticks = (timeBase.den * frameRate.den) / (timeBase.num * frameRate.num);
  return Number.isInteger(ticks) && ticks > 0 ? ticks : null;
}

function check(o: SlowSpanOptions): number {
  if (!(o.rate > 0 && o.rate < 1)) throw new Error(`slow motion needs a rate in (0, 1), got ${o.rate}`);
  if (!Number.isInteger(o.trimBefore) || !Number.isInteger(o.clipOffset) || o.clipOffset < 0) throw new Error('slow motion needs whole trimBefore / clipOffset');
  const F = ticksPerFrame(o.timeBase, o.sourceFrameRate);
  if (F === null) throw new Error('slow motion needs a source whose frame is a whole number of ticks');
  return F;
}

/** The multiplier Remotion's interpolate applies per slot: `(startFrom + rate) − startFrom` in doubles. */
function multiplier(o: SlowSpanOptions): number {
  return (o.trimBefore + o.rate) - o.trimBefore;
}

/** JS model: the media time Remotion asks for at slot m (seconds) — the renderer's own double ops. */
export function slowMotionMediaTime(o: SlowSpanOptions, m: number): number {
  return ((o.clipOffset + m) * multiplier(o) + o.trimBefore) / o.fps;
}

/** JS model: the source frame index Remotion shows at slot m (nearest by integer ticks, ties to the later frame). */
export function slowMotionSourceFrame(o: SlowSpanOptions, m: number): number {
  const F = check(o);
  const pos = Math.trunc((slowMotionMediaTime(o, m) * o.timeBase.den) / o.timeBase.num);
  return Math.floor((pos + F / 2) / F);
}

/** JS model: the first slot (≥ 0) showing source frame K, or null when no slot does — what `setpts` places K at. */
export function slowMotionFirstSlot(o: SlowSpanOptions, K: number): number | null {
  const D = o.sourceFrameRate.den / o.sourceFrameRate.num;
  const x = ((K - 0.5) * D * o.fps - o.trimBefore) / multiplier(o) - o.clipOffset;
  const a = Math.max(Math.ceil(x) - 1, 0);
  for (const m of [a, a + 1, a + 2]) if (slowMotionSourceFrame(o, m) === K) return m;
  return null;
}

/**
 * The three filters of the recipe. `select` names the frame time `t`, `setpts`
 * names it `T`; commas inside a quoted filter argument are escaped as the
 * rate ≥ 1 select escapes them.
 */
export function slowMotionFilters(o: SlowSpanOptions): { select: string; setpts: string; fps: string } {
  const F = check(o);
  const rr = String(multiplier(o));
  const D = `(${o.sourceFrameRate.den}/${o.sourceFrameRate.num})`;
  const time = (m: string) => `((${o.clipOffset}+${m})*${rr}+${o.trimBefore})/${o.fps}`;
  const want = (m: string) => `floor((trunc(${time(m)}*${o.timeBase.den}/${o.timeBase.num})+${F / 2})/${F})`;
  const build = (tv: 't' | 'T') => {
    const K = `round(${tv}/${D})`;
    const x = `((${K}-0.5)*${D}*${o.fps}-${o.trimBefore})/${rr}-${o.clipOffset}`;
    const a = `max(ceil(${x})-1\\,0)`;
    const w = [want(a), want(`${a}+1`), want(`${a}+2`)];
    return {
      keep: w.map((e) => `eq(${e}\\,${K})`).join('+'),
      first: `if(eq(${w[0]}\\,${K})\\,${a}\\,if(eq(${w[1]}\\,${K})\\,${a}+1\\,${a}+2))`,
    };
  };
  return {
    select: `select='${build('t').keep}'`,
    setpts: `setpts='(${build('T').first})/${o.fps}/TB'`,
    fps: `fps=fps=${o.fps}`,
  };
}
