/**
 * Which route a video request is composing. The three are mutually exclusive
 * on both providers — the frame route and the reference route cannot be
 * combined, so every surface picks one. Shared because the Videos panel and
 * the Flows node both narrow themselves by it.
 */
export type VideoRouteMode = 'generate' | 'frames' | 'reference';
