// Dev-only feature-flag env vars (see .env.example). Declared via global
// interface merge so the flag names are typo-checked at the access sites in
// feature-flags.ts. Values arrive as strings from .env, or undefined when
// unset — every flag must treat undefined as OFF.
//
// DEV and the ImportMeta.env member are re-declared (matching vite/client and
// electron-vite/node.d.ts exactly) because the *.check.json tsconfigs override
// `types` and lose those library declarations.
interface ImportMetaEnv {
  DEV: boolean
  readonly VITE_FF_TOOLS?: string
  readonly VITE_FF_FLOWS?: string
  readonly VITE_FF_VIDEO_STUDIO?: string
  readonly VITE_FF_AI_VIDEO?: string
  readonly VITE_FF_AI_LLM?: string
  readonly VITE_FF_AI_3D?: string
  readonly VITE_FF_AI_EMBEDDINGS?: string
  readonly VITE_FF_AI_AUDIO_ENGINE?: string
  /** Custom compat-endpoint provider form (H5, renderer). */
  readonly VITE_FF_CUSTOM_PROVIDER?: string
  /** Restore the V1-hidden LLM presets (H4, MAIN process — llm-handlers). */
  readonly VITE_FF_ALL_PROVIDERS?: string
  /** Crash-reporting endpoint, baked in at build time (main process only). */
  readonly VITE_SENTRY_DSN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
