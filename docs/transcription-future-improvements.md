# Transcription Feature — Future Improvements

> **Status:** Shipping beta as-is. This document lists deferred UX improvements for post-beta releases.
> **Owner:** TBD
> **Last reviewed:** 2026-04-22

## Context

The Transcription screen (`src/features/transcription/components/TranscriptionScreen.tsx`) ships in beta with a simple "Recent Transcriptions" list in the left sidebar. The current implementation works fine for small libraries (~10–20 items) but becomes painful as users accumulate history.

Current implementation summary:

- List lives in a 320px left panel, capped to `max-h-[200px]` with nested scroll.
- Each row shows: name · language · duration · segment count.
- Delete is one-by-one via a hover-only `×` button.
- No search, no filter, no date grouping, no sort, no bulk actions.

---

## Known pain points at scale (100+ items)

| # | Issue | User impact |
|---|-------|-------------|
| 1 | No search/filter | Must scroll through entire history to find a specific transcript |
| 2 | No date metadata shown | Can't tell which transcripts are recent at a glance |
| 3 | No date grouping (Today / Yesterday / Earlier) | Flat list feels undifferentiated |
| 4 | Nested scroll (inner 200px box inside scrollable left panel) | Cramped, easy to mis-scroll |
| 5 | No bulk delete | Cleaning up old transcripts is tedious |
| 6 | No sort control (implicit date order only) | Can't re-order by name, duration, language |
| 7 | Fixed 320px sidebar width | List name column truncates aggressively on long filenames |
| 8 | Hover-only delete affordance | Not discoverable; bad for touch/keyboard users |

---

## Proposed releases

### Release 1 — Minimum viable history (Next release after beta)

Ship the two highest-impact improvements. Should unblock normal usage up to ~50 items.

- [ ] **Search input** above the list — filters by transcript name (case-insensitive substring).
- [ ] **Relative date** on each row (`2d ago`, `3w ago`, etc.) — replace or augment the current metadata line.
- [ ] Expand the list's `max-h-[200px]` cap or remove the nested scroll (let the parent panel handle scrolling).

**Files likely touched:**

- `src/features/transcription/components/TranscriptionScreen.tsx` — add search input, render date
- `src/features/transcription/hooks/useTranscriptionProjects.ts` — expose filtered list, ensure `createdAt` is in the project type
- `src/features/transcription/types.ts` — add `createdAt: number` if missing

### Release 2 — Organized history (Release after that)

Handle 100+ items comfortably.

- [ ] **Date grouping** — section headers for Today / Yesterday / This Week / Earlier.
- [ ] **Sort control** — dropdown for Recent / Name / Duration.
- [ ] **Always-visible delete button** (small trash icon) — drop the hover-only pattern.
- [ ] **Empty-search state** — message when filter matches nothing.

### Release 3 — Power-user features (Optional)

Only build these if beta feedback surfaces demand.

- [ ] **Bulk select + delete** — checkbox per row, "Delete selected" action.
- [ ] **Tags / folders** — let users categorize transcripts.
- [ ] **Full-text search inside transcripts** — not just filename.
- [ ] **Export selected as batch** — zip multiple transcripts in one action.
- [ ] **Resizable sidebar** — let users widen the 320px panel.

---

## Design notes

- Keep the left-panel structure. Don't move history to a separate screen; the current layout (pick a file → see recent in sidebar → preview on right) is good.
- Search should filter locally (projects are already in memory via `useTranscriptionProjects`). No need for an IPC call.
- Relative date format: use a small helper, not a library. Thresholds: `just now` (<60s), `Nm ago` (<60m), `Nh ago` (<24h), `Nd ago` (<7d), `Nw ago` (<4w), otherwise date string.
- Date grouping: compute group key once per render (e.g. in a `useMemo`), then render section headers as the list maps through projects.

---

## Non-goals

- Do **not** build a full "Library" screen. The sidebar list is the right UX for this feature — it's meant to be quick access to recent work, not a file manager.
- Do **not** add pagination. Virtualization (react-window) is the right answer if history grows past ~500 items, not pagination.
- Do **not** build server-side sync for transcripts. Transcripts stay local.
