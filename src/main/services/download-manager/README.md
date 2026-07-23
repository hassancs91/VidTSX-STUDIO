# Download manager — adding a new model category

Every model category (image, LLM, whisper, audio, embedding, and future video /
3D) MUST download through this engine using one of the two patterns below.
Following them gives the category — for free — pause/resume, resume across app
restarts, progress broadcasting, resume-from-partial-bytes (HTTP Range, incl.
416 already-complete handling), the startup heal for orphaned `.part` files,
and the guarantee that a `completed` event is never observable while the file
is still partial.

## Pattern A — single-file models (GGUF, safetensors, ONNX, .bin)

```ts
await enqueueDownload({
  id: `<category>-model-${modelId}`,          // stable, unique per model
  url: model.downloadUrl,
  destPath: `${finalPath}.part`,              // ALWAYS a .part temp file
  finalizePath: finalPath,                    // engine renames BEFORE 'completed'
  metadata: { modelId, type: '<category>-model' },
});
```

Never point `destPath` at the final filename — the installed-check would then
report a partial/corrupt download as installed.

## Pattern B — archive models (tar.bz2 / zip bundles, e.g. sherpa audio)

```ts
await enqueueDownload({
  id: `<category>-model-${modelId}`,
  url: model.downloadUrl,
  destPath: archivePath,                      // the archive itself
  extraction: { format: 'tar.bz2', destDir: typeDir },  // runs BEFORE 'completed'
  metadata: { modelId, type: '<category>-model' },
});
```

## Rules that keep the flow consistent

1. **Installed-check reads final artifacts only.** Check for the final
   filename(s) on disk (`existsSync`, folder scan, or all-catalog-files-exist).
   Never count `.part` files, and never use a marker written *after*
   `enqueueDownload` resolves — the `completed` event fires first.
2. **No post-await file work.** Anything that must happen before the model
   counts as installed (rename, extraction) must happen inside the engine
   (`finalizePath` / `extraction`). Code after `await enqueueDownload(...)`
   does NOT run for downloads resumed in a later app session.
3. **`metadata.type` routes renderer progress.** Hooks filter the global
   `DOWNLOAD_PROGRESS` event by `metadata.type`; on `completed` they mark the
   model installed (or rescan the folder), and on mount they restore active
   downloads via `downloadGetAll()`. Copy an existing hook
   (`use-audio-models.ts` is the template), including the fallback that marks
   the model installed when the awaited download IPC call resolves.
4. **Delete must also remove `.part`.** See `deleteLlmModel` /
   whisper `deleteModel` for the pattern.

Engine-level behavior you should NOT reimplement per category: Range resume,
HTTP 416 (partial already complete → finalize immediately; size mismatch →
restart from scratch), retry/backoff, the `restoreDownloads()` startup heal
that finalizes completed-but-unrenamed `.part` files, and rename retries for
transient Windows file locks.
