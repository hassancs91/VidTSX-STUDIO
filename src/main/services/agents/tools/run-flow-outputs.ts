// A finished run's `outputs` as drafts for the CALLING session's store
// (flows plan §1.5, W8 Stage 4): copied, never linked. Media kinds (video,
// image-set, audio) already live in the asset library — the durable root every
// session shares — so their record is copied as is; workspace kinds (document,
// composition, web-page) are files in the run's `files/`, which the run
// retention prunes, so those files are COPIED into the session workspace under
// `flows/<runId>/` and the draft points there. Pure over its inputs apart from
// the copy itself, so the tool test runs it on a temp folder.

import fs from 'fs/promises';
import path from 'path';
import type { AgentArtifact, AgentArtifactDraft } from '../../../../shared/types/agents';
import type { FlowDoc, FlowPortValue, FlowRunDoc } from '../../../../shared/types/flows';
import { artifactRoot } from '../artifact-paths';

export interface RunOutputValue {
  label: string;
  value: FlowPortValue;
}

/** The run's declared outputs with the port values the run produced. */
export function collectRunOutputs(doc: FlowDoc, run: FlowRunDoc): RunOutputValue[] {
  const out: RunOutputValue[] = [];
  for (const output of doc.outputs) {
    const value = run.nodes[output.nodeId]?.outputs?.[output.handle];
    if (value) out.push({ label: output.label || output.handle, value });
  }
  return out;
}

export interface CopiedOutputs {
  drafts: AgentArtifactDraft[];
  /** Text and number outputs, for the tool's answer. */
  primitives: Array<{ label: string; text: string }>;
  /** Outputs whose artifact was missing from the run store. */
  missing: string[];
}

async function copyInto(runWorkspace: string, sessionWorkspace: string, runId: string, relPath: string): Promise<string> {
  const target = `flows/${runId}/${path.basename(relPath)}`;
  const abs = path.join(sessionWorkspace, target);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.copyFile(path.join(runWorkspace, relPath), abs);
  return target;
}

/** Strip the stored-only fields so the record can be filed again as a draft. */
function toDraft(artifact: AgentArtifact, title: string): AgentArtifactDraft {
  return { kind: artifact.kind, title, payload: structuredClone(artifact.payload) } as AgentArtifactDraft;
}

/**
 * Turn the run outputs into drafts the tool returns. `runWorkspace` is the
 * run's `files/`, `sessionWorkspace` the session's `work/`.
 */
export async function copyRunOutputs(input: {
  flowName: string;
  runId: string;
  outputs: RunOutputValue[];
  artifacts: AgentArtifact[];
  runWorkspace: string;
  sessionWorkspace: string;
}): Promise<CopiedOutputs> {
  const result: CopiedOutputs = { drafts: [], primitives: [], missing: [] };
  for (const { label, value } of input.outputs) {
    if (value.kind !== 'artifact') {
      result.primitives.push({ label, text: String(value.value) });
      continue;
    }
    const artifact = input.artifacts.find((a) => a.id === value.artifactId);
    if (!artifact) {
      result.missing.push(label);
      continue;
    }
    const title = `${input.flowName} — ${label}`;
    if (artifactRoot(artifact) === 'library' || artifact.kind === 'job') {
      result.drafts.push(toDraft(artifact, title));
      continue;
    }
    // Workspace kinds: copy the file(s) beside the session's own work files.
    switch (artifact.kind) {
      case 'document': {
        const relPath = await copyInto(input.runWorkspace, input.sessionWorkspace, input.runId, artifact.payload.relPath);
        const transcript = artifact.payload.transcript
          ? {
              ...artifact.payload.transcript,
              jsonRelPath: await copyInto(input.runWorkspace, input.sessionWorkspace, input.runId, artifact.payload.transcript.jsonRelPath),
            }
          : undefined;
        result.drafts.push({ kind: 'document', title, payload: { relPath, ...(transcript ? { transcript } : {}) } });
        break;
      }
      case 'composition': {
        const relPath = await copyInto(input.runWorkspace, input.sessionWorkspace, input.runId, artifact.payload.relPath);
        result.drafts.push({ kind: 'composition', title, payload: { relPath, config: { ...artifact.payload.config } } });
        break;
      }
      case 'web-page': {
        const relPath = await copyInto(input.runWorkspace, input.sessionWorkspace, input.runId, artifact.payload.relPath);
        result.drafts.push({ kind: 'web-page', title, payload: { ...structuredClone(artifact.payload), relPath } });
        break;
      }
      default:
        result.drafts.push(toDraft(artifact, title));
    }
  }
  return result;
}
