// The TSX pipeline deps agent compositions run with (agents plan §1.3:
// "generateTsxPipeline with buildShotEngineDeps-style deps, project-less").
//
// Deliberately a SIBLING of Studio's `buildShotEngineDeps`, not a call into it:
// plan decision 6 keeps `src/main/services/studio/` untouched, and the two
// differ where it matters — the usage row is `featureSource: 'agent'` and there
// is no project. The acceptance gate is composed from the same three shared
// pieces Studio composes, so "acceptable composition code" stays one rule:
// esbuild transpile, then the react/remotion/@vidtsx/kit single-file import
// lint, then a compositionConfig PARSE check. Folding all three into the
// `tsxValidate` dep is what makes a lint or config failure a fix-loop error the
// pipeline repairs, rather than a latent export failure or the parser's silent
// 300-frame default.

import type { TsxEngineDeps } from '../../../shared/tsx-engine';
import type { TsxValidateResponse } from '../../../shared/ipc/types';
import { lintShotSource } from '../../../shared/studio/shot-lint';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { validateTsxCode } from '../../ipc/tsx-handlers';
import { parseCompositionConfig } from '../composition-config-parser';

export async function validateAgentCompositionCode(code: string): Promise<TsxValidateResponse> {
  const transpile = await validateTsxCode(code);
  if (!transpile.success) return transpile;
  const lint = lintShotSource(code);
  if (!lint.ok) return { success: false, error: lint.errors.join(' ') };
  if (parseCompositionConfig(code) === null) {
    return {
      success: false,
      error:
        'compositionConfig could not be parsed — it must be `export const compositionConfig = { ... }` with literal number values only (no expressions, comments are ok).',
    };
  }
  return { success: true };
}

export function buildAgentTsxDeps(providerId: string | undefined, signal?: AbortSignal): TsxEngineDeps {
  return {
    llmGenerate: (req) =>
      runLlmGenerate(
        {
          ...req,
          ...(providerId && !req.providerId ? { providerId } : {}),
          featureSource: 'agent',
        },
        signal,
      ),
    tsxValidate: (req) => validateAgentCompositionCode(req.code),
  };
}
