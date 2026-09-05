import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GlbViewer, hasWebGL } from './GlbViewer';

/**
 * Viewer smoke (plan §5 step 8): vitest runs in Node (no DOM, no WebGL), so the
 * component must render its fallback without throwing — the same path an RDP session
 * or a headless VM without OpenGL takes. The R3F Canvas branch needs a real GPU and is
 * exercised by the CDP E2E run instead.
 */
describe('GlbViewer', () => {
  it('reports no WebGL outside a browser and renders the fallback without crashing', () => {
    expect(hasWebGL()).toBe(false);
    const html = renderToStaticMarkup(createElement(GlbViewer, { url: 'file:///C:/x/mesh.glb', className: 'w-10 h-10' }));
    expect(html).toMatch(/3D preview needs WebGL/);
    expect(html).toMatch(/w-10 h-10/);
  });
});
