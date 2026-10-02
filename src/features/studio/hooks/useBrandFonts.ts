import { useEffect } from 'react';

/**
 * Load the project's brand fonts into the editor document (video-10 import
 * gap 10). Shots set `fontFamily` strings and nothing ever loaded the
 * families, so the preview fell back to Segoe UI. Main resolves the brand's
 * fonts to stylesheets on the local font proxy (cached, so it works offline
 * after the first time); this links them while the project is open and
 * unlinks them when the brand changes or the editor closes. No brand, or a
 * family that is not on Google Fonts, links nothing.
 */
export function useBrandFonts(projectId: string | undefined, brandId: string | undefined): void {
  useEffect(() => {
    // The editor mounts before its project has loaded; nothing to link yet.
    if (!projectId) return;
    let cancelled = false;
    const links: HTMLLinkElement[] = [];
    window.api
      .studioBrandFontsGet({ projectId, ...(brandId ? { brandId } : {}) })
      .then((res) => {
        if (cancelled || !res.success) return;
        for (const href of res.stylesheets ?? []) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          link.dataset.brandFont = brandId ?? 'project';
          document.head.appendChild(link);
          links.push(link);
        }
      })
      .catch(() => {
        // A font that cannot load is the old behaviour, not an error to show.
      });
    return () => {
      cancelled = true;
      for (const link of links) link.remove();
    };
  }, [projectId, brandId]);
}
