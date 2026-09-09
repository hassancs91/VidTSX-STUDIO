// `get_brand` (V1 completion plan §2.4, "brands in Agents"): the brand this
// session generates under — palette, fonts, logo paths, style notes and the
// vocabulary — through the same formatter the Studio agent's get_brand uses.
// Read-only; the brand itself is the session's (picked at creation or on
// the chip), never named by the model.

import { readBrand } from '../../library/brand-store';
import { formatBrandSummary } from '../../library/brand-summary';
import { getLibraryRoot } from '../../library/library-paths';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

export const getBrandTool: AgentToolDef<Record<string, never>> = {
  id: 'get_brand',
  description:
    "Read this session's brand: palette, fonts, logo paths (library-relative), the style notes every generated image and composition already follows, and the vocabulary — names spelled the brand's way, to use verbatim in any text you write. Read it before designing or picking colours; never restate its rules in briefs.",
  schema: {},
  async handler(_args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress('reading the brand');
    if (!ctx.brandId) {
      return toolText(
        'This session has no brand — output uses its own defaults. The user can pick one on the brand chip above the chat.',
      );
    }
    try {
      const brand = await readBrand(getLibraryRoot(), ctx.brandId);
      if (!brand) {
        return toolText(
          `The session's brand "${ctx.brandId}" no longer exists in the library — ask the user to pick another on the brand chip.`,
          true,
        );
      }
      return toolText(formatBrandSummary(brand));
    } catch (err) {
      return toolText(`Could not read the brand: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};
