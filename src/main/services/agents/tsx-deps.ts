// The acceptance gate for an agent composition (agents plan §1.3, D14): the
// same three shared pieces Studio's shot gate is composed from, so
// "acceptable composition code" stays one rule — esbuild transpile, then the
// react/remotion/@vidtsx/kit single-file import lint, then a compositionConfig
// PARSE check (never the parser's silent 300-frame default). Agent and
// template packages check their compositions with it on install. The
// pipeline deps that lived here went with the one-shot pipeline (P3 part 8).

import type { TsxValidateResponse } from '../../../shared/ipc/types';
import { lintShotSource } from '../../../shared/studio/shot-lint';
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
