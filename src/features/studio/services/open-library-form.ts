// "Create brand…" / "Create preset…" in the Project settings panel (video-10
// feedback item 7). Studio never imports asset-library: the hop is the app's
// `vidtsx:navigate` event, then the Assets screen's own open event once it
// has had a tick to mount (the `vidtsx:creator-open` precedent, same delay).
// The editor's brand/preset lists re-read when the Studio screen is active again.

const MOUNT_DELAY_MS = 150;

export type LibraryForm = 'brand' | 'preset';

export function openLibraryForm(form: LibraryForm): void {
  window.dispatchEvent(new CustomEvent('vidtsx:navigate', { detail: { screen: 'assets' } }));
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('vidtsx:assets-open', { detail: { form } }));
  }, MOUNT_DELAY_MS);
}
