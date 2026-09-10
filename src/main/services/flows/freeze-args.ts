// A recorded tool call's arguments, read back through the tool's ports
// (flows plan §1.5 step 2, W8 Stage 5) — the inverse of `flow-args.ts`.
//
// `flow-args` builds a handler's argument object from node config, bound
// params and edge values through each input port's `argKey`. A freeze does
// the reverse on a call the agent already made: every argument whose value
// names a session artifact (or an array of them) becomes an edge on the port
// whose `argKey` is that key; every other argument is a literal and becomes
// node config. Pure: no registry, no store — the caller says what counts as
// an artifact id.

import { isPortCompatible, type DataType, type PortDef, type ToolPorts } from '../../../shared/types/flows';
import type { ArtifactKind } from '../../../shared/types/agents';
import { portCarriesKind } from '../../../shared/flows/port-kinds';

export interface EdgeArg {
  port: PortDef;
  artifactIds: string[];
}

export interface ClassifiedArgs {
  /** Literal arguments, by key — the node's config. */
  config: Record<string, unknown>;
  /** Artifact references on keys an input port takes. */
  edges: EdgeArg[];
  /** Artifact references on keys no port takes — dropped, named in the notes. */
  unwired: Array<{ key: string; artifactIds: string[] }>;
}

/** The config key an input port fills (`flow-args` reads the same field). */
export function configKeyForPort(port: PortDef): string {
  return port.argKey ?? port.id;
}

/** The input port whose argument key is `key`, if any. */
export function inputPortForKey(ports: Pick<ToolPorts, 'inputs'>, key: string): PortDef | undefined {
  return ports.inputs.find((p) => configKeyForPort(p) === key);
}

function artifactRefs(value: unknown, isArtifactId: (id: string) => boolean): string[] | null {
  if (typeof value === 'string') return isArtifactId(value) ? [value] : null;
  if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string' && isArtifactId(v))) {
    return value as string[];
  }
  return null;
}

/** Every artifact id a call's arguments name, in argument order. */
export function artifactRefsIn(args: Record<string, unknown>, isArtifactId: (id: string) => boolean): string[] {
  const ids: string[] = [];
  for (const value of Object.values(args)) {
    for (const id of artifactRefs(value, isArtifactId) ?? []) if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Split a call's arguments into node config and port edges. */
export function classifyCallArgs(
  ports: Pick<ToolPorts, 'inputs'>,
  args: Record<string, unknown>,
  isArtifactId: (id: string) => boolean,
): ClassifiedArgs {
  const config: Record<string, unknown> = {};
  const edges: EdgeArg[] = [];
  const unwired: Array<{ key: string; artifactIds: string[] }> = [];
  for (const [key, value] of Object.entries(args)) {
    const refs = artifactRefs(value, isArtifactId);
    if (!refs) {
      config[key] = value;
      continue;
    }
    const port = inputPortForKey(ports, key);
    if (port) edges.push({ port, artifactIds: refs });
    else unwired.push({ key, artifactIds: refs });
  }
  return { config, edges, unwired };
}

/**
 * The output port of a producing node that can feed `target` with an
 * artifact of `kind`: it must carry that kind AND be type-compatible with the
 * target port (`image` → `images` widens, nothing else does).
 */
export function outputPortFor(
  ports: Pick<ToolPorts, 'outputs'>,
  kind: ArtifactKind,
  target: DataType,
): PortDef | undefined {
  // A primitive target (a document handed to a text port — the `input_text`
  // that stands for a `write_document`) takes the source's field port of the
  // same type; an artifact target takes the port that carries the kind.
  if (target === 'text' || target === 'number') return ports.outputs.find((p) => p.dataType === target);
  return ports.outputs.find((p) => portCarriesKind(p.dataType, kind) && isPortCompatible(p.dataType, target));
}

/** The first output port carrying an artifact of this kind — the flow's output. */
export function outputPortForKind(ports: Pick<ToolPorts, 'outputs'>, kind: ArtifactKind): PortDef | undefined {
  return ports.outputs.find((p) => portCarriesKind(p.dataType, kind));
}
