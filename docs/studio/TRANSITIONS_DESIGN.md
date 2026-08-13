# Slice E design — basic transitions (crossfade · dip-to-black)

> Session 5 of `docs/studio/CORE_PARITY_PLAN.md`. Written before the code, per
> the plan's "design first" rule — this is the reviewable artifact. Decisions
> here are v1; anything marked *(v2)* is deliberately out.

## Model

One optional field on the LEADING clip of a boundary:

```ts
transitionOut?: {
  kind: 'crossfade' | 'dip-to-black';
  /** Total transition length in timeline seconds (window centered on the cut). */
  duration: number;
}
```

- Additive schema change, no version bump — old projects open untouched.
- **Validity invariant:** meaningful only while the next clip on the SAME track
  starts exactly at this clip's end (contiguous within 1e-6 s). The document
  never stores an overlap; the overlap exists only at render time.
- Stored on the leading clip (not a separate boundary object) because every
  existing op already moves/copies/deletes clip fields for free.

## Invariant enforcement — reducer-level prune, not per-op

The plan said "ripple/trim/split/delete must keep or drop it sanely (pure-op
rules)". Auditing the ops showed they do NOT all funnel through
`withTrackClips` (the group ops and `applyCutProposal` build tracks inline), so
per-op enforcement would mean touching ten call sites and would silently break
for every future op.

Decision: **`pruneTransitions(timeline)` runs once in the reducer's commit
path** (`withTimeline` + the `proposal-apply` case in `useTimeline`). It
returns the identical object when nothing is invalid, so the identity-on-reject
contract is preserved, and a prune caused by an edit lands in the SAME undo
step as the edit. Every op — current and future — inherits the invariant.

The one case prune cannot see: `splitClip` on a leading clip leaves the left
half contiguous with the right half, so a stale `transitionOut` on the left
half would look valid. `splitClip` therefore moves the field explicitly: the
right half inherits `transitionOut` (it now owns the original boundary), the
left half drops it — same pattern as the fade stripping.

Consequences (documented behavior, unit-tested):

| Edit | Result |
|---|---|
| Trim leading's end / trailing's start (gap opens) | transition dropped (same undo step) |
| Move either clip away | dropped |
| Speed change on leading (duration changes → gap) | dropped |
| Delete leading | transition goes with it |
| Delete trailing, no ripple | dropped (gap) |
| Delete trailing WITH ripple (next clip slides flush) | **kept** — the join gets the transition, which is what a ripple edit means (§16.5 "survives ripple ops") |
| Split leading | right half keeps it; left half clean |
| Copy/paste the leading clip | pastes with the field; prune drops it unless the paste lands contiguous |

## Render (serialize.ts stays the single source of truth)

Clips stay non-overlapping in the document; `serializeTimeline` builds the
overlap. New per-clip fields on `SerializedClip`:

```ts
transitionIn?:  { kind; frames }   // ramp window at the clip's head
transitionOut?: { kind; frames }   // ramp window at the clip's tail
```

`from`/`durationInFrames`/`trimBefore` already include any extension, so
`TimelineComposition` only draws ramps — it never re-derives geometry.

**Crossfade** — needs source material beyond the cut (handles), like every NLE:
- Leading extends `duration/2` past the cut, trailing starts `duration/2`
  early; each side clamps to its available handles (leading: source after its
  out point; trailing: source before its in point, i.e. `trimBefore`;
  images/tsx have unlimited handles; `playbackRate` scales handle consumption:
  `newTrimBefore = trimBefore − ext × rate`, media time interpolates from
  there). Asymmetric handles give an asymmetric window — clamp, don't reject.
- Overlap window o = extLead + extTrail frames (cumulative-rounding math, so
  adjacent spans still tile). If o = 0 (no handles at all) the crossfade
  renders as a hard cut.
- Video: the TRAILING clip ramps opacity 0→1 across o (it paints on top —
  later sibling in DOM order); the leading clip keeps full opacity underneath.
- Audio: equal-power — leading gain × cos(θ), trailing gain × sin(θ),
  θ = progress × π/2 across o. Composes multiplicatively with existing
  gain/fade ramps in `volumeProp`.

**Dip-to-black** — no extension, no handles needed:
- Leading ramps opacity AND volume 1→0 (linear) over its last `duration/2`;
  trailing ramps 0→1 over its first `duration/2`. The composition background
  is already black.

## Ops (new `services/transition-ops.ts`)

- `setTransition(timeline, clipId, kind, duration, sourceDurationOf?)` —
  rejects (identity) when: unknown clip, locked track, no contiguous next
  clip. Clamps duration to `min(leading.duration, trailing.duration)` and, for
  crossfade, additionally to `2 × available handles` per side is NOT enforced
  at set time (handles shrink under later trims anyway — serialize clamps at
  render, the honest place). Duration presets in the UI keep values sane.
- `removeTransition(timeline, clipId)` — identity when absent.
- `pruneTransitions(timeline)` — identity when clean.
- Reducer actions `transition-set` / `transition-remove`, one undo step each.

## UI (v1)

- Every eligible join (contiguous pair on an unlocked track) renders a small
  square button at the boundary in the lanes layer; joins with a transition
  render it filled/accent with a duration tooltip.
- Click → `FloatingMenu`: Crossfade 0.5 s / Crossfade 1 s / Dip to black
  0.5 s / Dip to black 1 s (+ Remove transition when one exists). Numeric
  duration editing *(v2, Inspector)*.
- No preview-park or audition changes; the Player shows the real result since
  the preview and export share the serializer.

## Out of scope (v2+)

- Transition presets beyond the two kinds; per-boundary duration typing;
  wipes/slides; transition on the FIRST clip's head (fade-from-black — covered
  by fadeIn + dip semantics later); audio-only crossfade UI on audio lanes
  (the model supports it; the join button renders there too).

## Test plan (§16.5)

- Unit: set/remove (reject paths), prune table above, split inheritance,
  serialize geometry (extension frames, trimBefore shift, o = 0 degradation,
  clamped handles, speed ≠ 1), equal-power ramp values at window edges/center.
- Live CDP: apply both kinds via the join button, verify preview ramps
  (opacity/volume element checks), undo/redo, delete-clip cleanup, ripple
  survival; real export → extracted mid-transition frame is a blend
  (crossfade) / near-black at the cut (dip); audio envelope V-notch at the cut
  for dip, smooth handoff for crossfade.
