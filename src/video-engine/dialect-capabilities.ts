import type {
  VideoDialectId,
  VideoModelCatalogEntry,
  VideoResolution,
} from '../shared/presets/video-models';
import { getVideoModel } from '../shared/presets/video-models';

/** What a catalog entry needs beyond id / name / dialect / routes. */
type DialectDefaults = Omit<
  VideoModelCatalogEntry,
  | 'id'
  | 'name'
  | 'tagline'
  | 'dialect'
  | 'textToVideoEndpoint'
  | 'imageToVideoEndpoint'
  | 'referenceToVideoEndpoint'
>;

const SEEDANCE_2_ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const SEEDANCE_2_RESOLUTIONS: VideoResolution[] = ['720p', '480p', '1080p'];

/**
 * Per-family capability defaults. A user-added catalog entry carries only an
 * id, a name and a dialect (the store sanitizes the rest away), so the family
 * supplies what the picker and the request normalizer need. Conservative on
 * purpose: the shipped entries state their real limits, and a hand-added slug
 * degrades to what every member of its family accepts.
 */
const DIALECT_DEFAULTS: Record<VideoDialectId, DialectDefaults> = {
  'fal-seedance-2': {
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [4, 5, 6, 8, 10, 12, 15],
    durationRange: { min: 4, max: 15, auto: true },
    allowedAspectRatios: [...SEEDANCE_2_ASPECTS, 'auto'],
    resolutions: SEEDANCE_2_RESOLUTIONS,
    references: { images: 9, videos: 3, audios: 3 },
  },
  'byteplus-seedance': {
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [4, 5, 6, 8, 10, 12, 15],
    durationRange: { min: 4, max: 15, auto: true },
    allowedAspectRatios: [...SEEDANCE_2_ASPECTS, 'adaptive'],
    resolutions: SEEDANCE_2_RESOLUTIONS,
    references: { images: 9, videos: 3, audios: 3 },
  },
  'fal-seedance-1': {
    supportsLastFrame: true,
    supportsAudio: false,
    allowedDurations: [5, 10],
    allowedAspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p'],
  },
  'fal-kling-2.5': {
    supportsLastFrame: true,
    supportsAudio: false,
    allowedDurations: [5, 10],
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
  },
  'fal-veo-3': {
    supportsLastFrame: false,
    supportsAudio: true,
    allowedDurations: [4, 6, 8],
    allowedAspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
  },
  'fal-wan-2.5': {
    supportsLastFrame: false,
    supportsAudio: true,
    allowedDurations: [5, 10],
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p'],
  },
  'fal-hailuo-02': {
    supportsLastFrame: false,
    supportsAudio: false,
    allowedDurations: [6, 10],
    allowedAspectRatios: ['16:9'],
  },
  'fal-generic': {
    supportsLastFrame: false,
    supportsAudio: false,
    allowedDurations: [5, 10],
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
  },
};

const ROUTE_SUFFIXES = ['/text-to-video', '/image-to-video', '/reference-to-video'] as const;

/**
 * Routes for a bare catalog id. fal slugs either name a route
 * (`…/seedance-2.5/text-to-video`, whose siblings differ only in the suffix)
 * or are the whole app (`fal-ai/veo3.1/fast`, whose image route is a subpath).
 * BytePlus has no routes at all: one model id serves every task type, and the
 * dialect picks the task from the inputs.
 */
export function deriveVideoRoutes(
  id: string,
  dialect: VideoDialectId,
): Pick<
  VideoModelCatalogEntry,
  'textToVideoEndpoint' | 'imageToVideoEndpoint' | 'referenceToVideoEndpoint'
> {
  const hasReferences = Boolean(DIALECT_DEFAULTS[dialect].references);
  if (dialect === 'byteplus-seedance') {
    return {
      textToVideoEndpoint: id,
      imageToVideoEndpoint: id,
      ...(hasReferences ? { referenceToVideoEndpoint: id } : {}),
    };
  }
  const suffix = ROUTE_SUFFIXES.find((s) => id.endsWith(s));
  const base = suffix ? id.slice(0, -suffix.length) : id;
  return {
    textToVideoEndpoint: suffix ? `${base}/text-to-video` : base,
    imageToVideoEndpoint: `${base}/image-to-video`,
    ...(hasReferences ? { referenceToVideoEndpoint: `${base}/reference-to-video` } : {}),
  };
}

export function getDialectDefaults(dialect: VideoDialectId): DialectDefaults {
  return DIALECT_DEFAULTS[dialect];
}

/**
 * Turn a stored catalog row (id + name + dialect) into a full entry. A row
 * whose id matches a shipped model reuses that model's verified constraints;
 * anything else gets its family's defaults and derived routes.
 */
export function hydrateVideoEntry(row: {
  id: string;
  name?: string;
  dialect: VideoDialectId;
}): VideoModelCatalogEntry {
  const known = getVideoModel(row.id);
  if (known && known.dialect === row.dialect) {
    return { ...known, name: row.name?.trim() || known.name };
  }
  return {
    id: row.id,
    name: row.name?.trim() || row.id,
    dialect: row.dialect,
    tagline: 'added in Model Catalogs',
    ...deriveVideoRoutes(row.id, row.dialect),
    ...DIALECT_DEFAULTS[row.dialect],
  };
}
