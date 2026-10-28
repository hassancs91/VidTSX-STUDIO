import type { StudioAssetProbe } from './studio';

/**
 * Asset-library index overlay — the one piece of metadata the disk can't
 * hold (docs/studio/ASSET_LIBRARY_DESIGN.md L1). Disk is truth for files
 * and folders; this index carries descriptions, brand tags, and origin,
 * keyed by library-relative path and re-keyed by content hash when files
 * move. Lives at `<assetsRoot>/.vidtsx/index.json` (dot-folder so the
 * Assets grid stays clean).
 *
 * (Named asset-library.ts — types/library.ts is the Creator's project
 * library, a different domain.)
 */

export type LibraryAssetOrigin = 'imported' | 'generated' | 'captured';

/** What a library file is, from the one extension table (`src/shared/media-kinds.ts`). */
export type LibraryAssetKind = 'video' | 'audio' | 'image' | 'model3d' | 'font' | 'data' | 'other';

/** The kinds a timeline clip can be (= `StudioAssetKind`). */
export type PlayableMediaKind = 'video' | 'audio' | 'image';

/**
 * Sound-library metadata (T6): what the reference SFX/music catalogs carry
 * per clip. Filled by generation (E2) and the catalog importer (E4).
 */
export interface LibraryAudioMeta {
  /** e.g. motion / tension / emphasis / snap / foley / reward / texture / impact. */
  category?: string;
  /** Integrated loudness, LUFS. Generation (E2) records the value RE-MEASURED after its normalize step. */
  loudnessLufs?: number;
  /**
   * Peak, dBFS. Generation (E2) writes the TRUE peak (dBTP — `loudnorm`'s `input_tp`, re-measured after the
   * re-encode; it is ≥ the sample peak, so the −1.5 ceiling on it holds for the sample peak too) with
   * `peakKind: 'true'`; the catalog importer (E4) carries the catalogs' SAMPLE peak with `peakKind: 'sample'`.
   */
  peakDbfs?: number;
  /** Which peak `peakDbfs` is; absent = unknown (written before E2). */
  peakKind?: 'true' | 'sample';
  /** Where the sound came from — the audio provider id ('elevenlabs', the dev 'standin') or e.g. 'synth'. */
  source?: string;
  /** The generating model, when one made it. */
  model?: string;
  /** The gain the normalize step applied at generation, dB (0 = already at the target, or nothing to apply). */
  gainDb?: number;
  /** Set when the normalize step failed and the file was kept as generated (un-normalized). */
  normalizeError?: string;
  /**
   * The licence as the source recorded it, verbatim (the catalog importer, E4). Absent when none was
   * recorded — the importer then says "no licence recorded in the catalog" in the entry's description.
   */
  license?: string;
}

/**
 * Index v2 fields (T6, E1). All optional so an index written before E1 reads
 * unchanged — and, the other way round, the pre-E1 reader keeps them on the
 * entries it does not rewrite (E-d5; `pre-e1-control.test.ts` pins which).
 */
export interface LibraryIndexV2Fields {
  /** From the one extension table; back-filled by the migration / on read. */
  kind?: LibraryAssetKind;
  /** Free-form search tags (E2 / E4). */
  tags?: string[];
  /** Sound metadata (E2 / E4). */
  audio?: LibraryAudioMeta;
  /** Ids of the projects a `library:` ref of this file landed in (E2). */
  usedIn?: string[];
  /**
   * The file version (size + mtime) `probe` was measured on — with `failed`, the version
   * whose probe failed (E1 fix round 1). A stamp that no longer matches the entry's
   * size/mtime marks the probe stale (an older app refreshed size/mtime but kept it) and
   * it is re-probed; a failed stamp stops retries until the file changes. A probe with no
   * stamp (written before the stamp existed) is trusted.
   */
  probeStamp?: LibraryProbeStamp;
}

/** See `LibraryIndexV2Fields.probeStamp`. */
export interface LibraryProbeStamp {
  size: number;
  mtimeMs: number;
  failed?: true;
}

export interface LibraryIndexEntry extends LibraryIndexV2Fields {
  /** Key: path relative to the assets root, POSIX separators. */
  relPath: string;
  /**
   * hashFileHead (sha1 of first 1 MiB + size) — MUST stay the same
   * algorithm projects use (media-import.ts), or library↔project
   * matching can never work. Undefined when the file was unreadable.
   */
  hash?: string;
  /** The human/AI-authored signal the agent reads (L2). */
  description?: string;
  /** Optional brand tag (L3) — orthogonal to folder structure. */
  brandId?: string;
  origin: LibraryAssetOrigin;
  addedAt: string;
  /**
   * ffprobe result for audio/video (duration, size, codec). Written on upsert
   * and by the reconcile scan (new / edited files), kept across moves, and
   * back-filled in the background for entries that lack it (E1).
   */
  probe?: StudioAssetProbe;
  /** Change-detection bookkeeping (internal to the reconcile scan). */
  size?: number;
  mtimeMs?: number;
}

/**
 * A deleted file's metadata, preserved so a transient state (cloud sync,
 * pending move) or re-import of the same content can resurrect its
 * description instead of losing it.
 */
export interface LibraryTombstone extends LibraryIndexV2Fields {
  relPath: string;
  hash?: string;
  description?: string;
  brandId?: string;
  origin: LibraryAssetOrigin;
  addedAt: string;
  missingSince: string;
  /** Same bytes come back → same probe (E1). */
  probe?: StudioAssetProbe;
}

/** The index revision E1 writes (see `LibraryIndexFile.rev`). */
export const LIBRARY_INDEX_REV = 2;

export interface LibraryIndexFile {
  /**
   * Stays 1 on purpose (E-d5): the pre-E1 reader (installed 1.1.x app, main
   * branch) returns an EMPTY index for any other version and its next write
   * rebuilds the index from disk, losing descriptions, origins, brand ids,
   * hashes and tombstones. "Index v2" is `rev` instead.
   */
  version: 1;
  /** 2 once the E1 migration ran; absent = written by pre-E1 code (re-migrate). */
  rev?: number;
  entries: LibraryIndexEntry[];
  tombstones: LibraryTombstone[];
}

/** Per-folder recursive sizes (bytes), keyed by POSIX rel path; '' = root. */
export interface LibrarySizes {
  total: number;
  folders: Record<string, number>;
}

// ─── AI descriptions (ASSET_LIBRARY_DESIGN.md L2) ───

/**
 * Why describe is (un)available. Describing runs a vision call on the
 * **app-default** LLM provider — library curation has no project context,
 * so the provider is a fixed rule, not a per-call choice. Every negative
 * reason degrades the same way (L2 Rev 3): imports still land, the Assets
 * view shows a dismissible note, and manual descriptions keep working.
 */
export type LibraryDescribeUnavailableReason = 'no-provider' | 'no-default' | 'no-key';

export type LibraryDescribeAvailability =
  | { available: true; providerId: string }
  | {
      available: false;
      reason: LibraryDescribeUnavailableReason;
      /** User-facing one-liner naming what is missing. */
      message: string;
    };

/** App-level library preferences (consent, note dismissal, import default). */
export interface LibraryPrefs {
  /** ISO timestamp of the one-time "describing sends images to the cloud"
   *  consent (L2 Rev 2). Undefined = never granted, so the first AI
   *  describe must ask. */
  describeConsentAt?: string;
  /** The no-provider note is dismissible and stays dismissed (L2 Rev 3). */
  noProviderNoteDismissed: boolean;
  /** Auto-describe on LIBRARY import — default ON. Project footage imports
   *  never consult this: they go through the Studio media path. */
  autoDescribeOnImport: boolean;
}

// ─── Brands (ASSET_LIBRARY_DESIGN.md L3, TSX_SHOTS_DESIGN.md D11) ───

/** CSS color strings — hex or any valid CSS color, injected verbatim. The
 *  five core roles are required; the six extra roles (video-10 import gap 9)
 *  are optional and map onto the `@vidtsx/kit` theme tokens — absent means
 *  "derive from the core five", which is what every brand did before. */
export interface StudioBrandPalette {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
  /** Positive status: checkmarks, ok lines (kit `ok`). */
  success?: string;
  /** Attention: tags, caution (kit `warn`). */
  warning?: string;
  /** Errors and destructive emphasis (kit `danger`). */
  danger?: string;
  /** Secondary text: labels, captions (kit `muted`). */
  muted?: string;
  /** Raised panels and cards, one step off the background (kit `paper`). */
  surface?: string;
  /** Hairline borders and dividers (kit `line`). */
  line?: string;
}

/**
 * One brand, stored as `brands/<id>/brand.json` inside the assets root —
 * a real folder, visible in the Assets screen. `id` IS the folder slug
 * (folder-as-truth, like project ids). Multiple brands; `defaultBrandId`
 * in Studio settings is copied into `project.settings.brandId` at project
 * creation (explicit snapshot — changing the default never restyles
 * existing projects).
 */
/**
 * One brand vocabulary entry (V1 completion plan §2.4, decision §0.5): the
 * CORRECT spelling of a name the brand uses, plus the manglings speech
 * engines produce for it. Every term is sent to the transcription provider
 * as a keyterm, and the aliases are replaced in every transcript the
 * project makes (the deterministic post-pass in asset-transcriber).
 */
export interface StudioBrandTerm {
  term: string;
  aliases?: string[];
}

export interface StudioBrand {
  id: string;
  name: string;
  palette: StudioBrandPalette;
  /** Google/system font family names (v1); local font files are v2. */
  fonts: { display: string; body?: string };
  /** Library-relative paths of logo assets. Consumed by shots in D12. */
  logoRefs: string[];
  /** Free text, injected verbatim into generation prompts (logo placement, tone). */
  styleNotes?: string;
  /** Names and spellings (W4). Absent = none; capped at BRAND_VOCABULARY_MAX.
   *  The memory tier `vocabulary` is the PROPOSAL path and promotes in here,
   *  the way rules promote into `styleNotes`. */
  vocabulary?: StudioBrandTerm[];
  createdAt: string;
  updatedAt: string;
}
