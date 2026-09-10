// The tool ids a manifest may name — as plain data (agents plan §1.3).
//
// The registry in `main/services/agents/tools/registry.ts` is the authority on
// what a tool DOES, but reaching it means importing every tool, and through
// them the image and video engines and Electron. Two callers need only the
// names: `scripts/agent-pack.mjs --check`, which validates a package offline,
// and (from Stage 3) the renderer's capability summary.
//
// `registry.test.ts` asserts the registry's ids equal this list, so the two
// cannot drift. IDS ARE APPEND-ONLY (§11): a renamed id silently breaks every
// installed agent that asked for it.

export const AGENT_TOOL_IDS = [
  'write_document',
  'generate_composition',
  'edit_composition',
  'render_composition',
  'generate_image',
  'generate_video',
  'ask_user',
  'list_artifacts',
  'propose_memory',
  // W4 (2026-09-09): the session's brand, on demand.
  'get_brand',
  // W2b (2026-09-10): sound effects + music through the audio engine.
  'generate_audio',
  // W9 (2026-09-10): the web designer's page tools.
  'write_page',
  'edit_page',
  'capture_page',
  'export_site',
  // W8 Stage 1 (2026-09-10): the flow input resolvers and the LLM text node
  // (docs/flows-plan.md §1.2). Node-capable; `generate_text` is also a fine
  // agent tool.
  'input_text',
  'input_image_library',
  'input_image_file',
  'input_video_file',
  'generate_text',
] as const;

export type AgentToolId = (typeof AGENT_TOOL_IDS)[number];
