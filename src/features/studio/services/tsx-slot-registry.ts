import type { ComponentType } from 'react';

const registry = new Map<string, ComponentType>();

export function registerSlotComponent(slotId: string, component: ComponentType): void {
  registry.set(slotId, component);
}

export function getSlotComponent(slotId: string): ComponentType | undefined {
  return registry.get(slotId);
}

export function unregisterSlotComponent(slotId: string): void {
  registry.delete(slotId);
}

export function clearSlotRegistry(): void {
  registry.clear();
}
