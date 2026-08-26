import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * CONTENT_SAFETY_DESIGN.md D4 — the LLM surface has ZERO moderation hooks,
 * as a recorded design decision: text false positives are structurally
 * impossible, not threshold-tuned away. This test asserts the ABSENCE stays
 * absent: no LLM/text surface may reference the moderation gates. (The one
 * allowed touch is prose — the policy clause is plain text, not a hook.)
 *
 * If this test fails, someone wired a word-list or classifier into a text
 * surface. Revisit D4 before "fixing" the test.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/** Every text/LLM surface named by D0/D4: chat, transcripts, TSX generation, captions. */
const LLM_SURFACES = [
  'src/engine', // cloud LLM engine + providers
  'src/llm-engine', // local LLM engine
  'src/main/ipc/llm-handlers.ts',
  'src/shared/tsx-engine', // TSX generation / edit / verify pipelines
  'src/main/services/stt', // transcripts
  'src/main/services/studio/studio-agent.ts',
  'src/main/services/studio/studio-agent-prompt.ts',
  'src/shared/studio/caption-words.ts',
];

/** Symbols that constitute a moderation hook. */
const FORBIDDEN = [
  'checkGenerationPrompt',
  'moderationEngine',
  'GENERATION_BLOCKLIST',
  'checkImageBuffer',
  'checkImageBase64',
  'checkVideoFile',
  'checkVideoBuffer',
  'ModerationBlockedError',
  'moderation-engine',
  'content-safety-engine',
];

function collectFiles(target: string): string[] {
  const abs = path.join(REPO_ROOT, target);
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [abs];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const child = path.join(abs, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(path.relative(REPO_ROOT, child)));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(child);
  }
  return out;
}

describe('LLM surfaces have no moderation hooks (D4)', () => {
  it('every listed surface exists (the list must track the codebase)', () => {
    for (const target of LLM_SURFACES) {
      expect(fs.existsSync(path.join(REPO_ROOT, target)), `${target} missing`).toBe(true);
    }
  });

  for (const target of LLM_SURFACES) {
    it(`${target} references no moderation gate`, () => {
      for (const file of collectFiles(target)) {
        const source = fs.readFileSync(file, 'utf-8');
        for (const symbol of FORBIDDEN) {
          expect(
            source.includes(symbol),
            `${path.relative(REPO_ROOT, file)} references "${symbol}" — LLM surfaces must stay hook-free (D4)`,
          ).toBe(false);
        }
      }
    });
  }
});
