// Paint an overlay stand-in UNDER the composition in the app's generated render
// wrapper, so a thumbnail of a transparent template shows the template.
//
// The wrapper registers `<Composition component={Name} …/>`; this swaps that
// component for one that draws the backdrop and then `Name` on top. Everything
// else the app's wrapper does (font-url rewrite, import normalisation) is kept.

import fs from 'fs/promises';
import { backdropCss, type TemplateBackdrop } from '../../src/shared/templates/backdrops';

export async function addBackdropToWrapper(
  wrapperPath: string,
  backdrop: TemplateBackdrop,
  canvas: { width: number; height: number },
): Promise<void> {
  const css = backdropCss(backdrop, canvas);
  if (!css) return;
  const source = await fs.readFile(wrapperPath, 'utf-8');
  const match = /component=\{(\w+)\}/.exec(source);
  if (!match || !source.includes('const Root')) {
    throw new Error(`Unexpected wrapper shape in ${wrapperPath} — cannot add a backdrop`);
  }
  const name = match[1];
  const backdropped = [
    `import { AbsoluteFill as __VerifyFill } from 'remotion';`,
    `const __VerifyBackdropped = (props: Record<string, unknown>) => (`,
    `  <__VerifyFill style={{ background: ${JSON.stringify(css)} }}>`,
    `    <${name} {...props} />`,
    `  </__VerifyFill>`,
    `);`,
    '',
  ].join('\n');
  const next = source
    .replace(match[0], 'component={__VerifyBackdropped}')
    .replace('const Root', `${backdropped}const Root`);
  await fs.writeFile(wrapperPath, next, 'utf-8');
}
