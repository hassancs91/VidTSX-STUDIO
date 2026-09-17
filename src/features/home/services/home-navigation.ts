// Where Home's cards and tiles go. Home never imports another feature: every
// hop is the app's `vidtsx:navigate` event (App.tsx routes it and applies the
// feature flags), followed — for a card that opens a specific thing — by the
// target screen's own open event once it has had a tick to mount. The delay
// is the one `useArtifactActions` already uses for "Open in Creator".

const MOUNT_DELAY_MS = 150;

function dispatch(name: string, detail: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Plain screen change — the Start tiles and every "See all". */
export function goToScreen(screen: string, section?: string): void {
  dispatch('vidtsx:navigate', section ? { screen, section } : { screen });
}

/** A Studio card: the editor of that project (`vidtsx:studio-open`). */
export function openStudioProject(projectId: string): void {
  goToScreen('studio');
  setTimeout(() => dispatch('vidtsx:studio-open', { projectId }), MOUNT_DELAY_MS);
}

/** "Edit a video": the Studio browser with the New Project dialog open. */
export function startNewStudioProject(): void {
  goToScreen('studio');
  setTimeout(() => dispatch('vidtsx:studio-open', { newProject: true }), MOUNT_DELAY_MS);
}

/** A TSX card: the Creator with that project's newest version loaded
 *  (`vidtsx:creator-open`, the agents "Open in Creator" hand-off). */
export function openMotionProject(folderPath: string, versionPath: string): void {
  goToScreen('creator');
  setTimeout(() => dispatch('vidtsx:creator-open', { folderPath, versionPath }), MOUNT_DELAY_MS);
}

/** An agent-session card: that agent's workspace on that session. */
export function openAgentSession(agentId: string, sessionId: string): void {
  goToScreen('agents');
  setTimeout(() => dispatch('vidtsx:agents-open', { agentId, sessionId }), MOUNT_DELAY_MS);
}
