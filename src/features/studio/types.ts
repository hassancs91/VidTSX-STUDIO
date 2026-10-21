// The Studio timeline document schema lives in src/shared/types/studio.ts —
// it is shared with main-process services (project-store, media-import).
// Renderer-only Studio types can be added here as the feature grows.
export * from '@shared/types/studio';

/** The project's frame size as the undoable edit history holds it (A1):
 *  `settings.width/height` mirrored, so a size edit is one Ctrl+Z step. */
export interface StudioFrameSize {
  width: number;
  height: number;
}
