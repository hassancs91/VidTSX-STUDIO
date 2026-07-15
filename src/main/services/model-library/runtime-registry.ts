/**
 * Runtime registry — the "special libraries" dimension (sd-cli, sherpa, llama,
 * pytorch, ffmpeg), kept separate from model categories because runtimes are
 * shared and independently installable. The Main dashboard's engine cards read
 * their state from here. No `electron` import — descriptors inject their own
 * availability checks.
 */
import type {
  RuntimeDescriptor,
  RuntimeId,
  RuntimeStatus,
} from '@shared/model-library/types';

const runtimes = new Map<RuntimeId, RuntimeDescriptor>();

export function registerRuntime(descriptor: RuntimeDescriptor): void {
  runtimes.set(descriptor.id, descriptor);
}

export function getRuntime(id: RuntimeId): RuntimeDescriptor | undefined {
  return runtimes.get(id);
}

export function listRuntimes(): RuntimeDescriptor[] {
  return [...runtimes.values()];
}

/**
 * Resolve a runtime's current status. An unregistered runtime reports
 * `available: false, installable: false`.
 */
export async function getRuntimeStatus(id: RuntimeId): Promise<RuntimeStatus> {
  const descriptor = runtimes.get(id);
  if (!descriptor) {
    return { id, available: false, installable: false };
  }

  const available = await descriptor.isAvailable();
  return {
    id,
    available,
    installable: !available && descriptor.install !== undefined,
    installSizeLabel: descriptor.install?.sizeLabel,
  };
}

/** Test-only: clear registered runtimes. */
export function __resetRuntimeRegistry(): void {
  runtimes.clear();
}
