// The Assistant transcript as Markdown — what "Copy chat" / "Save chat…" in
// the panel produce (video-10 feedback item 9, 2026-09-12). Hasan pastes it
// into a Claude session to explain a problem, so the shape is for a reader:
// project + date + model up top, then each turn in order. Tool chips are
// always listed (they are one line each); the tools' raw arguments and
// results — the debugging gold, but long — only with `includeToolDetails`.

import type { StudioAgentChatMessage } from '@shared/ipc/types';

export interface AgentChatExportMeta {
  projectName: string;
  exportedAt: Date;
  /** The project's current assistant setting (the per-turn model on each
   *  assistant message wins when recorded). */
  providerId?: string | undefined;
  model?: string | undefined;
}

export interface AgentChatExportOptions {
  /** Append every tool call's arguments and result under its turn. */
  includeToolDetails: boolean;
}

function modelLabel(providerId?: string, model?: string): string | null {
  if (!providerId && !model) return null;
  return [providerId, model].filter(Boolean).join(' / ');
}

function clock(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

function fence(body: string, lang = ''): string {
  // A body containing ``` would close the fence early — widen it.
  const ticks = body.includes('```') ? '````' : '```';
  return `${ticks}${lang}\n${body}\n${ticks}`;
}

/**
 * Render the transcript. Pending (still streaming) rows are skipped — a
 * half-written reply is not part of the record.
 */
export function formatAgentChatMarkdown(
  messages: Array<StudioAgentChatMessage & { pending?: boolean }>,
  meta: AgentChatExportMeta,
  options: AgentChatExportOptions,
): string {
  const rows = messages.filter((m) => !m.pending);
  const lines: string[] = [];
  lines.push(`# Assistant chat — ${meta.projectName}`);
  lines.push('');
  const lastModel = [...rows].reverse().find((m) => m.role === 'assistant' && (m.providerId || m.model));
  const model =
    modelLabel(lastModel?.providerId, lastModel?.model) ?? modelLabel(meta.providerId, meta.model);
  lines.push(
    `Exported ${meta.exportedAt.toLocaleString()} · ${rows.length} message${rows.length === 1 ? '' : 's'}` +
      (model ? ` · model ${model}` : '') +
      (options.includeToolDetails ? ' · with tool arguments and results' : ''),
  );
  lines.push('');
  lines.push('---');

  for (const m of rows) {
    lines.push('');
    const when = clock(m.at);
    if (m.role === 'user') {
      lines.push(`### You${when ? ` · ${when}` : ''}`);
      lines.push('');
      lines.push(m.text);
      continue;
    }
    const turnModel = modelLabel(m.providerId, m.model);
    lines.push(`### Assistant${when ? ` · ${when}` : ''}${turnModel ? ` · ${turnModel}` : ''}`);
    lines.push('');
    for (const call of m.toolCalls ?? []) {
      lines.push(`- tool \`${call.tool}\`${call.detail ? ` — ${call.detail}` : ''}${call.isError ? ' — **failed**' : ''}`);
    }
    if (m.proposalNote) lines.push(`- proposal: ${m.proposalNote}`);
    if ((m.toolCalls?.length ?? 0) > 0 || m.proposalNote) lines.push('');
    if (m.error) lines.push(`**Error:** ${m.text}`);
    else if (m.text.trim().length > 0) lines.push(m.text);
    else lines.push('_(no text)_');

    if (options.includeToolDetails) {
      for (const call of m.toolCalls ?? []) {
        if (call.args === undefined && call.result === undefined) continue;
        lines.push('');
        lines.push(`<details><summary>${call.tool}${call.isError ? ' (failed)' : ''}</summary>`);
        lines.push('');
        if (call.args !== undefined) {
          lines.push('Arguments:');
          lines.push('');
          lines.push(fence(call.args, 'json'));
          lines.push('');
        }
        if (call.result !== undefined) {
          lines.push('Result:');
          lines.push('');
          lines.push(fence(call.result));
          lines.push('');
        }
        lines.push('</details>');
      }
    }
  }
  lines.push('');
  return lines.join('\n');
}

/** `<project>-assistant-YYYY-MM-DD-HHMM.md`, filesystem-safe. */
export function agentChatExportFileName(projectName: string, at: Date): string {
  const slug =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'project';
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `${slug}-assistant-${stamp}.md`;
}
