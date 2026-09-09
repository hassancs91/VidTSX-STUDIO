/**
 * The known cloud image models that need more than an id + dialect — today
 * the BytePlus ModelArk (Seedream direct) catalog. Types live in
 * image-models.ts; the per-provider default catalogs the user can edit are
 * composed from these arrays in provider-model-defaults.ts, the same way the
 * video entries are (video-model-entries.ts).
 *
 * Ids, tiers and prices verified 2026-09-10 against the ModelArk docs
 * (docs.byteplus.com/en/docs/ModelArk/1330310 model list, /1824121 tutorial,
 * /1544106 pricing). The catalog id IS the ModelArk model id. A new Seedream
 * id needs no code — add it in AI → Providers → Model Catalogs; the
 * `byteplus-seedream` dialect and the provider's generic size envelope
 * (the range every listed model accepts) cover it.
 */
import type { ImageModelCatalogEntry } from './image-models';

/**
 * ModelArk (Seedream direct). `priceUsd` is the published flat per-image
 * output price (input images are free on every model except 5.0 pro's 2nd+
 * reference at $0.003); 5.0 pro is tiered — $0.045 up to 2.61 MP (its 1K /
 * 1.5K tiers), $0.09 above — and the provider caps it at 2K, so the lower
 * tier is the estimate.
 */
export const BYTEPLUS_IMAGE_MODELS: readonly ImageModelCatalogEntry[] = [
  {
    id: 'seedream-4-5-251128',
    name: 'Seedream 4.5',
    dialect: 'byteplus-seedream',
    priceUsd: 0.04,
  },
  {
    id: 'seedream-5-0-lite-260128',
    name: 'Seedream 5.0 Lite',
    dialect: 'byteplus-seedream',
    priceUsd: 0.035,
  },
  {
    id: 'dola-seedream-5-0-pro-260628',
    name: 'Seedream 5.0 Pro',
    dialect: 'byteplus-seedream',
    priceUsd: 0.045,
  },
];

/** The model a fresh BytePlus image provider runs on. */
export const DEFAULT_BYTEPLUS_IMAGE_MODEL = BYTEPLUS_IMAGE_MODELS[0].id;
