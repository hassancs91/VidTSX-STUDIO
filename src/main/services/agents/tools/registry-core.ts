// The registry's store and queries WITHOUT the tool imports (W8 Stage 4).
//
// `registry.ts` imports every tool to register it; a tool that itself needs
// the registry at load — `run_flow` reads `getNode` for labels, `run_agent`
// goes through the agent service, whose runner selects tools — would form a
// cycle whose outcome depends on which module loads first (the tool test
// that imports the tool directly saw `registerTool(undefined)`). So the map
// and its readers live here, importing no tool, and everything that only
// READS the registry — the runner, the flow service, the package context and
// the tools themselves — imports from this file. `registry.ts` re-exports it.

import type { NodeSpec } from '../../../../shared/types/flows';
import type { AgentToolDef, AgentToolNeed } from './types';
import { needMet } from './invoke-tool';

/** The registry stores definitions with their arg types erased; the zod schema
 *  validates before a handler ever sees the object. */
export type RegisteredTool = AgentToolDef<Record<string, unknown>>;

const registry = new Map<string, RegisteredTool>();

export function registerTool<TArgs>(def: AgentToolDef<TArgs>): void {
  if (registry.has(def.id)) {
    throw new Error(`Agent tool "${def.id}" is already registered`);
  }
  registry.set(def.id, def as unknown as RegisteredTool);
}

export function getTool(id: string): RegisteredTool | undefined {
  return registry.get(id);
}

export function listTools(): RegisteredTool[] {
  return [...registry.values()];
}

export function listToolIds(): string[] {
  return [...registry.keys()];
}

/** Test seam only — the built-ins re-register on the next import. */
export function clearRegistryForTests(): void {
  registry.clear();
}

export interface ToolSelection {
  /** Registered definitions the manifest asked for, in manifest order. */
  tools: RegisteredTool[];
  /** Ids the manifest asked for that no longer exist — install refuses these,
   *  so at runtime they mean the app was downgraded under an installed agent. */
  missing: string[];
  /** Selected tools whose capability is not configured. They stay in the
   *  server (§1.8) and the system prompt says they are unavailable. */
  unavailable: Array<{ id: string; needs: AgentToolNeed }>;
}

export interface ToolCapabilities {
  imageProvider: boolean;
  videoProvider: boolean;
  audioProvider: boolean;
  /** W8 Stage 4: the active LLM provider can run a tool loop (`run_agent`).
   *  Optional so older callers' literals still type; absent = false. */
  agentProvider?: boolean;
}

/** Filter the registry by a manifest's allowlist. */
export function selectTools(toolIds: string[], capabilities: ToolCapabilities): ToolSelection {
  const tools: RegisteredTool[] = [];
  const missing: string[] = [];
  const unavailable: Array<{ id: string; needs: AgentToolNeed }> = [];
  const seen = new Set<string>();

  for (const id of toolIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const def = registry.get(id);
    if (!def) {
      missing.push(id);
      continue;
    }
    tools.push(def);
    const needs = def.needs;
    if (needs && !needMet(needs, capabilities)) {
      unavailable.push({ id: def.id, needs });
    }
  }
  return { tools, missing, unavailable };
}

// ---------------------------------------------------------------------------
// Nodes (flows plan §1.2, decision 2): a tool with `ports` is also a node.
// ---------------------------------------------------------------------------

/** The tool behind a node id — only tools that carry `ports`. */
export function getNode(toolId: string): RegisteredTool | undefined {
  const def = registry.get(toolId);
  return def?.ports ? def : undefined;
}

/**
 * Serialisable node descriptions for the canvas (`FLOWS_NODES_LIST`). No
 * handler travels; `available` is false when the tool's gate is unmet right
 * now, and `priceHint` is read at list time so the catalog can change.
 */
export function listNodeSpecs(capabilities: ToolCapabilities): NodeSpec[] {
  const specs: NodeSpec[] = [];
  for (const def of registry.values()) {
    const ports = def.ports;
    if (!ports) continue;
    const priceHint = ports.priceHint?.();
    specs.push({
      id: def.id,
      label: ports.label,
      description: def.description,
      category: ports.category,
      inputs: ports.inputs,
      outputs: ports.outputs,
      configSchema: ports.configSchema,
      defaultConfig: ports.defaultConfig,
      ...(def.needs ? { needs: [def.needs], available: needMet(def.needs, capabilities) } : {}),
      ...(ports.priced ? { priced: true } : {}),
      ...(priceHint ? { priceHint } : {}),
      ...(ports.nondeterministic ? { nondeterministic: true } : {}),
    });
  }
  return specs;
}
