---
name: Flow design
description: The node catalogue by category, the port types and how they connect, when a config value becomes a parameter, when a node should pause, and the shapes the built-in flows use. Read it before every proposal.
when_to_use: Every time you design, propose or fix a flow.
---

# Flow design

A flow is a DAG of nodes joined by typed ports. It runs top to bottom, one
node at a time, with no branches and no loops; the run form shows its
parameters, and the outputs it names are what the user sees at the end.
`list_nodes` is the authority on ids, ports and config keys — this skill is
the map, not the territory.

## Port types

`text` and `number` are plain values. `image` is one picture, `images` a
set; `video` one clip, `videos` several; `audio` a sound or music track;
`composition` a TSX composition; `transcript` a transcript with timings.
An edge joins an OUTPUT port to an INPUT port of the same type; `image`
also feeds an `images` port and `video` a `videos` port — nothing else
widens. A required input must be fed by an edge, a parameter or a
non-empty config value, or the flow will not start.

## The catalogue, by what you are making

- **Inputs** — `input_text` (config `prompt` → `text`), `input_image_file`
  (`filePath` → `image`), `input_image_library` (`entryId` → `image`),
  `input_video_file` (`filePath` or `entryId` → `video`). An input node is
  how a parameter enters the graph: expose its config key as the param.
- **Text** — `generate_text`: `prompt` → `text` on the LLM. `promptPrefix`
  holds a fixed instruction before the incoming text, `systemPrompt` the
  role, `extract` pulls one item out of a JSON reply or strips code fences,
  `useBrand: "on"` prepends the brand summary. Free on the session provider.
- **Images** — `generate_image`: `prompt` (+ `sourceImage`, `referenceImages`)
  → `image`. `count` 1–4 makes variations (pause after it to let the user
  pick one). `extract_frame`: `video` + a time → `image` (or a strip with
  `count`).
- **Video** — `generate_video`: `prompt` (+ `firstFrame`, `lastFrame`) →
  `video`. PRICED per second; the model list in `list_nodes` carries the
  rates — `hailuo-02` and `kling-2.5-turbo-pro` are the cheap ones, never
  `seedance-2.0-fast`. `trim_video`, `concat_videos`, `caption_video`
  (`video` + `transcript` → burnt-in captions, styles `minimal` /
  `bold-pop` / `karaoke`) are free ffmpeg and render steps.
- **Audio** — `transcribe`: `video` or `audio` → `transcript` (+ `text`),
  AssemblyAI cents per minute. `text_to_speech`: `text` → `audio` on a local
  voice. `generate_audio`: `prompt` → `audio`, `kind` sfx or music, priced.
- **Compositions** — `generate_composition`: `brief` (+ `image`, `video`) →
  `composition`, a 30 s piece from a text brief on the LLM, minutes;
  `edit_composition`; `render_composition`: `composition` → `video`, a
  local render, minutes.
- **Library** — `save_to_library`: files any artifact into the asset library.
- **Agents** — `run_agent`: `goal` (+ context ports) → the last artifact of
  a kind an installed agent made. The ONE non-deterministic step; needs a
  tool-capable provider; give it a tool allowlist and a turn cap, and never
  put `ask_user` in its allowlist.

## Shapes that work

- Caption a video: `input_video_file → transcribe → caption_video` with the
  video on both `transcribe.video` and `caption_video.video`, the transcript
  on `caption_video.transcript`; one `video` param on the input's `filePath`.
- Thumbnail: `input_text → generate_text (a fixed thumbnail-prompt system
  prompt, extract first-json-item) → generate_image`; params: the topic and
  `count`; pause after the image so the user picks.
- Explainer: `input_text → generate_text (script) → generate_composition
  (pause) → render_composition`.
- Add an effect to footage: `input_video_file → extract_frame →
  generate_image (the frame as sourceImage, the effect prompt) →
  generate_video (the image as firstFrame, 5 s)`.

## Parameters

Expose what changes per run and nothing else: the media that comes in, the
topic or brief, an effect or style the user will vary. `kind` follows the
value: `prompt` for long text, `text` for short, `number` with `min`/`max`,
`select` with `options`, `image` or `video` for a file (bound to an input
node's `filePath`). Give every param a label a person understands and mark
the ones the flow cannot run without as `required`. Keep the model, the
size and the fixed wording in config.

## Pauses

`pause: true` on a node stops an attended run after it and shows a card —
a pick when the node made several images, an approve for one artifact, an
editable form for text. Use it before a priced or slow step whose input the
user would want to choose (variations before a clip, a composition before
its render). Unattended runs and agents skip every pause, so a flow must
also make sense with the first result taken every time.

## Outputs

Name the outputs the user cares about — usually the last node's main port.
Everything else stays visible in the steps strip. Label them in words
("Captioned video", not "video").
