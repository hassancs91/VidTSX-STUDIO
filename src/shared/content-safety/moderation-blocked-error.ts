import type { ContentSafetyBlockInfo, ContentSafetyCategory, ContentSafetyGate } from './types';
import { contentSafetyBlockMessage } from './block-message';

/**
 * Typed error thrown when either Content Safety gate blocks a visual
 * generation. Electron-free; destructured at the IPC boundary into
 * `blocked?: ContentSafetyBlockInfo` — never serialized as a class.
 */
export class ModerationBlockedError extends Error {
  readonly gate: ContentSafetyGate;
  readonly category: ContentSafetyCategory;

  constructor(gate: ContentSafetyGate, category: ContentSafetyCategory) {
    super(contentSafetyBlockMessage({ gate, category }));
    this.name = 'ModerationBlockedError';
    this.gate = gate;
    this.category = category;
  }

  toBlockInfo(): ContentSafetyBlockInfo {
    return { gate: this.gate, category: this.category };
  }
}
