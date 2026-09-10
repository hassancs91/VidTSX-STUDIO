// `write_page` — one self-contained HTML document into the session, returned
// as a `web-page` artifact (V1 completion plan §2.9, W9).
//
// The model writes the whole page: markup, inline CSS, inline JS. Media it
// made earlier is referenced by artifact id, never by path or URL, and the
// store refuses anything that would reach the network (see web-page-store).

import { z } from 'zod';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { describeStoredPage, storeWebPage } from './web-page-store';

const schema = {
  title: z.string().min(1).describe('Short title, shown on the stage and used to name the file.'),
  html: z
    .string()
    .min(1)
    .describe(
      'ONE complete HTML document: <!doctype html> … </html>, with all CSS in <style> and all JS in <script>. No external scripts, stylesheets, fonts, images or fetches. Media from this session is referenced as artifact:<id> (a video or audio artifact) or artifact:<id>/<n> (the n-th image of an image-set), in src / poster / srcset or CSS url(). Ordinary <a href="https://…"> links are fine.',
    ),
};

interface WritePageArgs {
  title: string;
  html: string;
}

export const writePageTool: AgentToolDef<WritePageArgs> = {
  id: 'write_page',
  description:
    'Store one self-contained web page (HTML with inline CSS and JS) as a "web-page" artifact and show it to the user in a sandboxed preview. Media you generated in this session is referenced as artifact:<id>; the page must not load anything from the network — such a page is rejected with the reasons. With its media inlined the page must stay under 16 MB.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress(args.title);
    const stored = await storeWebPage(ctx, args.title, args.html);
    if (!stored.ok) return toolText(stored.error, true);
    return {
      ...toolText(
        `Page written: ${describeStoredPage(stored.relPath, stored.refs, stored.inlineBytes)}. Use capture_page to see it, edit_page to change it, export_site when it is done.`,
      ),
      artifact: stored.draft,
    };
  },
};
