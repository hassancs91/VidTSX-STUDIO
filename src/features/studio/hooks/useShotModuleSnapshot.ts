import { useSyncExternalStore } from 'react';
import type { ShotModuleLoader, ShotModuleSnapshot } from '../services/shot-module-loader';

/** Subscribe a component (the Player, the open overlay) to the shot-module
 *  loader — only subscribers re-render when modules arrive. */
export function useShotModuleSnapshot<C>(loader: ShotModuleLoader<C>): ShotModuleSnapshot<C> {
  return useSyncExternalStore(loader.subscribe, loader.getSnapshot, loader.getSnapshot);
}
