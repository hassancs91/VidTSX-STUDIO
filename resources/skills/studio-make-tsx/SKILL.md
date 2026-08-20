---
name: Studio Make TSX
description: Shot policy for the Studio editing agent — when to reach for generate_tsx_shot, how to write briefs and anchors that produce professional cutaways/overlays/titles, bulk-pass discipline, and the from-scratch (TSX-only video) mode. The composition craft itself (backgrounds, literal config, word sync) is enforced by the generation pipeline; this skill is about USING it well.
when_to_use: Composed into the Studio Assistant's system prompt for TSX shot work. Not a general-purpose skill.
---

# Make-TSX shot policy

Shots are short generated Remotion compositions placed on the timeline:

- **cutaway** — opaque, fully covers the footage while the master audio keeps
  playing underneath. Use for diagrams, stats, product callouts, B-roll-style
  inserts.
- **overlay** — transparent, composites over the playing footage. Use for
  lower thirds, badges, arrows, highlights.
- **title** — an overlay whose text reveals in sync with the spoken words.
  ALWAYS anchored to a transcript span; a title without word sync is pointless.

## Briefs that work — write a storyboard, not a caption

The pipeline model sees ONLY your brief plus the mechanical contract (exact
dimensions/fps/duration, background rule, word table, craft rules, exemplar
shots). It cannot see the footage or the chat. A one-line brief produces a
generic shot; a storyboard-grade brief produces a designed one. Structure
every brief as **content → regions → beats → mood**:

- **Content** — what the shot says, in one line.
- **Regions** — where things sit, as proportions: "left 60%: the terminal
  card; right 40%: three stat rows", "bottom band: a single pill".
- **Beats keyed to cue words** — for anchored shots, quote the exact
  transcript words each reveal lands on: "on 'three steps' the row appears;
  on 'completely free' the badge stamps in". The pipeline receives word
  timings for the whole anchor span, so ANY quoted word is a usable cue —
  this is how cutaways and overlays sync to speech, not just titles.
- **Density and motion intent** — "calm: two elements, rise-and-settle" or
  "energetic: quick staggers, one highlighter sweep on the payoff word".

Example cutaway brief: "Pricing comparison. Left 55%: our plan card with
three feature rows; right 45%: the 'other tools' column, dimmed. Beats: on
'every editor' both cards rise; on 'hundred dollars' their price counts up;
on 'ours is free' our price swaps to $0 with an underline wipe. Calm — one
accent at a time."

Also:

- For titles: say HOW words reveal ("each word pops in as it is spoken,
  settled words stay dimmed white, current word amber").
- Name typography intent only when unbranded ("brand feel: minimal, white
  on near-black, one amber accent").
- Do NOT put timing math, frame counts, or config values in the brief — the
  tool injects the exact duration/fps/word table itself. Cue WORDS, not cue
  seconds.
- Do NOT restate the craft rules (stagger, easing, density) — the pipeline
  already enforces them; the brief spends its words on content, regions and
  beats.

## Brand

When the project has an active brand, the tool injects its palette, fonts,
and style notes into every generate/regenerate as a MANDATORY contract — do
not restate colors or fonts in the brief, and do not fight it ("brand feel"
hints belong only in unbranded projects). Briefs should describe content and
motion; the brand supplies the look. To apply a brand (or a brand change) to
an existing shot, regenerate it — baked versions never restyle themselves.

## Media inside shots

Real media (logos, screenshots, product footage) is what makes shots look
professional — reach for it instead of describing imagery in the brief:

- Pass media via `assetRefs` on `generate_tsx_shot`: key → a project asset id
  from the inventory, or a `library:<path>` ref. Keys become `assets.<key>`
  in the generated code — name them like identifiers (`logo`, `screenshot1`).
  Images and video only; audio belongs on the timeline.
- `generate_image(prompt, ...)` makes new art (brand-tagged, filed in the
  library) — logos-adjacent graphics, illustrations, backgrounds. The prompt
  becomes the asset's description; write it like a caption.
- `capture_webpage(url, ...)` screenshots a page — THE source for product/
  dashboard/fake-screencast material. Use `visible: true` only for
  login-walled pages, and tell the user first: a browser window will open for
  them to log in and navigate, then THEY click "Capture now".
- Do not put URLs or file paths in the brief — the pipeline injects an asset
  table for the refs you pass, and the shot receives real URLs as props.
- The description on a library/project asset is what you search and design
  against; when you make assets, leave good descriptions behind.

## Anchors

- Anchor a shot when it should sync to speech (`assetId` + `sourceStart`/
  `sourceEnd` in source seconds, on word bounds from `get_transcript`).
- **Default to anchoring cutaways and overlays too, not just titles.** An
  unanchored cutaway can only animate on a timer; an anchored one gets the
  span's word table and can land every reveal on a spoken cue. Read the span
  first (`get_transcript(assetId, start, end)`), pick the cue words, then
  write the beats into the brief.
- The anchor span IS the default shot length — pick a span that reads as one
  beat (typically 2–8 s; a multi-beat cutaway can run longer when the brief
  choreographs each beat). Titles: anchor exactly the phrase being
  emphasized.
- Unanchored shots (transitions, scene cards, from-scratch scenes) take an
  explicit `durationSeconds` and, when proposed, an optional `timelineStart`.

## Pass discipline

- **Plan cheap, generate expensive.** For anything beyond one shot, post the
  shot list in chat first — anchor times + one-liners — and get a go-ahead
  before burning pipeline runs.
- Up to **10 shots per pass**; ask before exceeding. Generate one at a time
  with `generate_tsx_shot`, then `propose_shots` ONCE with all of them.
- If one shot fails, keep going with the rest and report the failure — do not
  abandon the pass.
- Range asks ("first 5 minutes") read only that transcript slice via
  `get_transcript(assetId, startSeconds, endSeconds)`.

## From-scratch mode (TSX-only video)

A project with no footage is first-class: the shots ARE the video.

1. Plan the video as scenes in chat (scene list with durations); get the
   go-ahead.
2. Generate each scene as an UNANCHORED **cutaway** with explicit
   `durationSeconds` — opaque backgrounds, since nothing plays underneath.
3. Propose in scene order; they land back-to-back on the master lane.
4. Keep visual continuity across scenes: repeat the same palette and type
   treatment in every brief ("same style as before: near-black background,
   white headings, amber accents").
5. No transcript → no word sync. If the user has a voice-over file, suggest
   importing + transcribing it; anchored titles work from then on.

## After the proposal

Summarize the pass in 2–3 sentences (what each shot shows, where it lands).
The user previews every shot in the Player from the review panel — do not
describe pixel details they can see, and never propose again while a review
is open.
