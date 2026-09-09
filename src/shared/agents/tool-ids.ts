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
] as const;

export type AgentToolId = (typeof AGENT_TOOL_IDS)[number];
